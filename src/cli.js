#!/usr/bin/env node --harmony
/**
 * Copyright (C) 2016 Swift Navigation Inc.
 * Contact: Joshua Gross <josh@swift-nav.com>
 * This source is subject to the license found in the file 'LICENSE' which must
 * be distributed together with this source. All other rights reserved.
 *
 * THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND,
 * EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A PARTICULAR PURPOSE.
 */

"use strict";

import http from 'http';
import commander from 'commander';
import parseDuration from 'parse-duration';
import lib, { LLA } from './index';

function parsePorts (s) {
  return s.split(',').map(function (d) {
    return parseInt(d);
  });
}

function parseLLAs (s) {
  return s.split(';').map(function (llaStr) {
    const llaStrSplit = llaStr.split(',');
    const lat = parseFloat(llaStrSplit[0]);
    const lng = parseFloat(llaStrSplit[1]);
    const alt = parseFloat(llaStrSplit[2]);
    const latPole = llaStrSplit[0][llaStrSplit[0].length - 1];
    const lngPole = llaStrSplit[1][llaStrSplit[1].length - 1];
    return new LLA(lat, latPole, lng, lngPole, alt);
  });
}

commander
  .version(lib.version)
  .option('-s, --path <p1,p2,p3>', 'Points to interpolate between, semicolon-separated, in LLA format: lat, long, altitude (meters)', parseLLAs)
  .option('-p, --ports <p1,p2,p3>', 'Port(s) to open HTTP server on local machine, comma-separated', parsePorts)
  .option('-n, --num-streams <n>', 'Number of SBP streams', parseInt)
  .option('-z, --hz <n>', 'Speed in hertz of updates', parseInt)
  .option('-d, --duration <s>', 'Time to finish streams', parseDuration)
  .parse(process.argv);

const streams = lib(commander.path, commander.numStreams, commander.hz, commander.duration);

// Start up optional HTTP streams
for (let i = 0; i < (commander.ports && commander.ports.length || 0); i++) {
  const port = commander.ports[i];
  const stream = streams[i];
  const responder = function (req, res) {
    stream.pipe(res);
  };
  const server = http.createServer(responder).listen(port);

  // `finish` is called because `.end` is called on the stream.
  stream.on('finish', () => server.close());
}
