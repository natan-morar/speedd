/*
 *  __   ___   ____  ____  ___   ___
 * ( (` | |_) | |_  | |_  | | \ | | \
 * _)_) |_|   |_|__ |_|__ |_|_/ |_|_/
 *
 * SPEEDD project (www.speedd-project.eu)
 * Machine Learning module
 *
 * Copyright (c) Complex Event Recognition Group (cer.iit.demokritos.gr)
 *
 * NCSR Demokritos
 * Institute of Informatics and Telecommunications
 * Software and Knowledge Engineering Laboratory
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published
 * by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with program. If not, see <http://www.gnu.org/licenses/>.
 */

package org.speedd.ml.app

import auxlib.opt.OptionParser

trait CommonOptions extends OptionParser {

  protected var cassandraConnectionHost = "127.0.0.1"
  protected var cassandraConnectionPort = "9042"

  // -------------------------------------------------------------------------------------------------------------------
  // --- Command line interface options
  // -------------------------------------------------------------------------------------------------------------------


  opt("C", "Cassandra-host", s"Specify the IP connection to Cassandra DB (default is '$cassandraConnectionHost}').", {
    v: String => cassandraConnectionHost = v
  })

  opt("P", "Cassandra-port", s"Specify the port connection to Cassandra DB (default is '$cassandraConnectionPort}').", {
    v: String => cassandraConnectionPort = v
  })

}
