package org.speedd.ml.loaders.cnrs.collected

import lomrf.logic._
import lomrf.mln.learning.structure.TrainingEvidence
import lomrf.mln.model._
import lomrf.util.Cartesian.CartesianIterator
import org.speedd.ml.loaders.{BatchLoader, InferenceBatch}
import org.speedd.ml.model.cnrs.collected.InputData
import org.speedd.ml.util.data.DatabaseManager._
import org.speedd.ml.util.data.DomainMap
import slick.driver.PostgresDriver.api._
import org.speedd.ml.util.logic._

final class InferenceBatchLoader(kb: KB,
                                kbConstants: ConstantsDomain,
                                predicateSchema: PredicateSchema,
                                evidencePredicates: Set[AtomSignature],
                                queryPredicates: Set[AtomSignature],
                                sqlFunctionMappings: List[TermMapping]) extends BatchLoader {

  /**
    * Loads a (micro) batch, either training [[org.speedd.ml.loaders.TrainingBatch]] or
    * inference [[org.speedd.ml.loaders.InferenceBatch]], that holds the data for the
    * specified interval. Furthermore, a simulation id can be provided in case of
    * simulation data.
    *
    * @param startTs starting time point
    * @param endTs end time point
    * @param simulationId simulation id (optional)
    * @param useOnlyConstants a subset of constant domain to be used (optional)
    *
    * @return a batch [[org.speedd.ml.loaders.Batch]] subclass specified during implementation
    */
  def forInterval(startTs: Int, endTs: Int, simulationId: Option[Int] = None,
                  useOnlyConstants: Option[DomainMap] = None): InferenceBatch = {

    val (constantsDomain, functionMappings, annotatedLocations) =
      loadAll[Int, Long, String, Option[String]](kbConstants, kb.functionSchema, useOnlyConstants, startTs, endTs, simulationId, loadFor)

    // ---
    // --- Create a new evidence builder
    // ---
    // Evidence builder can incrementally create an evidence database for LoMRF
    val annotatedDB = EvidenceBuilder(predicateSchema, kb.functionSchema, queryPredicates, hiddenPredicates = Set.empty, constantsDomain)
      .withDynamicFunctions(predef.dynFunctions).withCWAForAll(true)

    // ---
    // --- Store previously computed function mappings
    // ---
    for ((_, fm) <- functionMappings)
      annotatedDB.functions ++= fm

    val functionMappingsMap = annotatedDB.functions.result()

    // ---
    // --- Create 'Next' predicates and give them as evidence facts:
    // ---
    info(s"Generating 'Next' predicates for the temporal interval [$startTs, $endTs]")
    (startTs to endTs).sliding(2).foreach {
      case pair => annotatedDB.evidence ++= EvidenceAtom.asTrue("Next", pair.map(t => Constant(t.toString)).reverse.toVector)
    }

    for (sqlFunction <- sqlFunctionMappings) {

      val domain = sqlFunction.domain
      val arity = sqlFunction.domain.length
      val symbol = sqlFunction.symbol
      val eventSignature = AtomSignature(symbol, arity)

      val argDomainValues = domain.map(t => constantsDomain.get(t).get).map(_.toIterable)

      val iterator = CartesianIterator(argDomainValues)

      val happensAtInstances = iterator.map(_.map(Constant))
        .flatMap { case constants =>

          val timeStamps = blockingExec {
            sql"""select timestamp from #${InputData.baseTableRow.schemaName.get}.#${InputData.baseTableRow.tableName}
                  where #${bindSQLVariables(sqlFunction.sqlConstraint, constants)}
                  AND timestamp between #$startTs AND #$endTs""".as[Int]
          }

          for {
            t <- timeStamps
            mapper <- functionMappingsMap.get(eventSignature)
            resultingSymbol <- mapper.get(constants.map(_.toText).toVector)
            groundTerms = Vector(Constant(resultingSymbol), Constant(t.toString))
          } yield EvidenceAtom.asTrue("HappensAt", groundTerms)
        }

      for (happensAt <- happensAtInstances)
        annotatedDB.evidence += happensAt
    }

    // ---
    // --- Create ground-truth predicates (HoldsAt/2)
    // ---
    info(s"Generating annotation predicates for the temporal interval [$startTs, $endTs]")

    // Find all function signatures that have a fluent return type in the given KB
    val fluents = kb.formulas.flatMap(_.toCNF(kbConstants)).flatMap { c =>
      c.literals.filter(l => queryPredicates.contains(l.sentence.signature)).map(_.sentence.terms.head).flatMap {
        case TermFunction(symbol, terms, "fluent") => Some((symbol, terms, kb.functionSchema(AtomSignature(symbol, terms.length))._2))
        case _ => None
      }
    }

    for ((symbol, terms, domain) <- fluents) {

      val holdsAtInstances = annotatedLocations.flatMap { r =>

        val domainMap = Map[String, Constant](
          "timestamp" -> Constant(r._1.toString),
          "loc_id" -> Constant(r._2.toString),
          "lane" -> Constant(r._3.toString)
        )

        val constantsExist =
          for { t <- terms
                d <- domain
                if t.isConstant
          } yield domainMap(d) == t

        val theta = terms.withFilter(_.isVariable)
          .map(_.asInstanceOf[Variable])
          .map(v => v -> domainMap(v.domain))
          .toMap[Term, Term]

        val substitutedTerms = terms.map(_.substitute(theta))

        val fluentSignature = AtomSignature(symbol, substitutedTerms.size)

        if(r._4.isDefined && r._4.get == fluentSignature.symbol && constantsExist.forall(_ == true))
          for {
            mapper <- functionMappingsMap.get(fluentSignature)
            resultingSymbol <- mapper.get(substitutedTerms.map(_.toText))
            groundTerms = Vector(Constant(resultingSymbol), Constant(r._1.toString))
          } yield EvidenceAtom.asTrue("HoldsAt", groundTerms)
        else None
      }

      for (holdsAt <- holdsAtInstances) try {
        annotatedDB.evidence += holdsAt
      } catch {
        case ex: java.util.NoSuchElementException =>
          val fluent = holdsAt.terms.head
          val timestamp = holdsAt.terms.last

          constantsDomain("fluent").get(fluent.symbol) match {
            case None => error(s"fluent constant ${fluent.symbol} is missing from constants domain}")
            case _ =>
          }

          constantsDomain("timestamp").get(timestamp.symbol) match {
            case None => error(s"timestamp constant ${timestamp.symbol} is missing from constants domain}")
            case _ =>
          }
      }
    }

    // ---
    // --- Extract evidence and annotation
    // ---
    val (evidence, annotationDB) = extractAnnotation(annotatedDB.result(), evidencePredicates, queryPredicates)

    // ---
    // --- Compile clauses
    // ---
    val clauses = NormalForm
      .compileCNF(kb.formulas)(evidence.constants)
      .toVector

    InferenceBatch(
      mlnSchema = MLNSchema(predicateSchema, kb.functionSchema, kb.dynamicPredicates, kb.dynamicFunctions),
      evidence,
      annotationDB,
      queryPredicates,
      clauses)
  }

  /**
    * Loads a training evidence batch [[lomrf.mln.learning.structure.TrainingEvidence]] that holds
    * the data for the specified interval. Furthermore, a simulation id can be provided in case of
    * simulation data. Should be used only for loading data during structure learning.
    *
    * @param startTs starting time point
    * @param endTs end time point
    * @param simulationId simulation id (optional)
    * @param useOnlyConstants a constant domain to be used (optional)
    *
    * @return a training evidence batch [[lomrf.mln.learning.structure.TrainingEvidence]]
    */
  override def forIntervalSL(startTs: Int, endTs: Int, simulationId: Option[Int] = None,
                             useOnlyConstants: Option[DomainMap] = None): TrainingEvidence =
    fatal("Cannot load structure learning training batch during inference.")
}
