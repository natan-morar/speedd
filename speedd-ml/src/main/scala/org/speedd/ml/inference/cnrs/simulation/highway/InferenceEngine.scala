package org.speedd.ml.inference.cnrs.simulation.highway

import java.io.File

import auxlib.log.Logging
import lomrf.logic.AtomSignature
import lomrf.mln.grounding.MRFBuilder
import lomrf.mln.inference.ILP
import lomrf.mln.model._
import lomrf.util.evaluation._
import org.speedd.ml.inference.Reasoner
import org.speedd.ml.loaders.InferenceBatch
import org.speedd.ml.loaders.cnrs.simulation.highway.InferenceBatchLoader
import org.speedd.ml.util.data.DomainMap
import org.speedd.ml.util.logic.{Term2SQLParser, TermMapping}

final class InferenceEngine private(kb: KB,
                                    kbConstants: ConstantsDomain,
                                    predicateSchema: PredicateSchema,
                                    evidencePredicates: Set[AtomSignature],
                                    queryPredicates: Set[AtomSignature],
                                    termMappings: List[TermMapping]) extends Reasoner {

  private lazy val batchLoader =
    new InferenceBatchLoader(kb, kbConstants, predicateSchema, evidencePredicates, queryPredicates, termMappings)

  /**
    * Perform inference in the MLN model for the specified interval using the given batch size. Furthermore,
    * a set of simulation id can be provided in case of simulation data. The inference is performed in steps,
    * were each step is considered a test case.
    *
    * @param startTs       start time point
    * @param endTs         end time point
    * @param batchSize     batch size for each inference step
    * @param useOnlyConstants a subset of constant domain to be used (optional)
    * @param simulationIds a set of simulation ids to be used for inference
    */
  override def inferFor(startTs: Int, endTs: Int, batchSize: Int,
                        useOnlyConstants: Option[DomainMap] = None,
                        simulationIds: List[Int]) = {

    // For all given simulation ids
    for (id <- simulationIds) {
      info(s"Simulation id $id")

      val range = startTs to endTs by batchSize
      val intervals = if (!range.contains(endTs)) range :+ endTs else range

      val microIntervals = intervals.sliding(2).map(i => (i.head, i.last)).toList

      info(s"Number of micro-intervals: ${microIntervals.size}")

      // Keep the evaluation statistics for each test batch
      var results = Vector[EvaluationStats]()

      for ( ((currStartTime, currEndTime), idx) <- microIntervals.zipWithIndex) {
        info(s"Loading micro-batch training data no. $idx, for the temporal interval [$currStartTime, $currEndTime]")
        val batch: InferenceBatch = batchLoader.forInterval(currStartTime, currEndTime, Some(id), useOnlyConstants)

        info {
          s"""
             |${batch.evidence.constants.map(e => s"Domain '${e._1}' contains '${e._2.size}' constants.").mkString("\n")}
             |Total number of 'True' evidence atom instances: ${batch.evidence.db.values.map(_.numberOfTrue).sum}
             |Total number of 'True' non-evidence atom instances: ${batch.annotation.values.map(_.numberOfTrue).sum}
          """.stripMargin
        }

        val domainSpace = PredicateSpace(batch.mlnSchema, queryPredicates, batch.evidence.constants)

        val mln = new MLN(batch.mlnSchema, domainSpace, batch.evidence, batch.clauses)
        info(mln.toString())

        info("Creating MRF...")
        val mrfBuilder = new MRFBuilder(mln, createDependencyMap = true)
        val mrf = mrfBuilder.buildNetwork

        // Produce an inferred state
        val state = new ILP(mrf).infer()

        val atoms = (state.mrf.queryAtomStartID until state.mrf.queryAtomEndID)
          .map(id => state.mrf.fetchAtom(id)).par

        val result = Evaluate(atoms, batch.annotation)(mln)
        results +:= result
      }

      val stats = (results.map(_._1).sum, results.map(_._2).sum, results.map(_._3).sum, results.map(_._4).sum)

      info(s"Statistics: $stats")
      info(s"Precision: ${Metrics.precision(stats._1, stats._3, stats._4)}")
      info(s"Recall: ${Metrics.recall(stats._1, stats._3, stats._4)}")
      info(s"F1: ${Metrics.f1(stats._1, stats._3, stats._4)}")
    }
  }

}

object InferenceEngine extends Logging {

  def apply(inputKB: File,
            sqlFunctionMappingsFile: File,
            evidencePredicates: Set[AtomSignature],
            queryPredicates: Set[AtomSignature]): InferenceEngine = {

    // ---
    // --- Prepare the KB:
    // ---
    info(s"Processing the given input KB '${inputKB.getPath}'.")
    val (kb, kbConstants) = KB.fromFile(inputKB.getPath)

    // ---
    // --- Parse term mappings to SQL queries:
    // ---
    info(s"Processing the given term mappings '${sqlFunctionMappingsFile.getPath}'")
    val sqlFunctionMappings = Term2SQLParser.parseFunctionTermFrom(sqlFunctionMappingsFile)

    whenDebug {
      debug(sqlFunctionMappings.mkString("\n"))
    }

    new InferenceEngine(kb, kbConstants, kb.predicateSchema,
      evidencePredicates, queryPredicates, sqlFunctionMappings)
  }

}
