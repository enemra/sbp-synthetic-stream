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

const commander = require('commander');
const httpPlayback = require('./index.js');

commander
  .version(httpPlayback.version)
  .option('-p, --port <n>', 'Port to open HTTP server on local machine', parseInt)
  .option('-f, --filename <f>', 'File to replay over HTTP')
  .option('-c, --chunk-size <n>', 'Size of chunk (in byte) to stream between delays', parseInt)
  .option('-d, --delay <n>', 'Delay in milliseconds between sending chunks', parseInt)
  .option('-q, --quiet', 'If true, don\'t output anything to console. Default false.')
  .option('-n, --no-repeat', 'File will repeat endlessly unless this switch is provided.')
  .parse(process.argv);

httpPlayback(commander, function (err, server) {
  if (err) {
    console.log(err);
    commander.help();
  }
});
