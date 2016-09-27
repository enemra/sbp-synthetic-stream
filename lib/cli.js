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

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _commander = require('commander');

var _commander2 = _interopRequireDefault(_commander);

var _parseDuration = require('parse-duration');

var _parseDuration2 = _interopRequireDefault(_parseDuration);

var _index = require('./index');

var _index2 = _interopRequireDefault(_index);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parsePorts(s) {
  return s.split(',').map(function (d) {
    return parseInt(d);
  });
}

function parseLLAs(s) {
  return s.split(';').map(function (llaStr) {
    var llaStrSplit = llaStr.split(',');
    var lat = parseFloat(llaStrSplit[0]);
    var lng = parseFloat(llaStrSplit[1]);
    var alt = parseFloat(llaStrSplit[2]);
    var latPole = llaStrSplit[0][llaStrSplit[0].length - 1];
    var lngPole = llaStrSplit[1][llaStrSplit[1].length - 1];
    return new _index.LLA(lat, latPole, lng, lngPole, alt);
  });
}

_commander2.default.version(_index2.default.version).option('-s, --path <p1,p2,p3>', 'Points to interpolate between, semicolon-separated, in LLA format: lat, long, altitude (meters)', parseLLAs).option('-p, --ports <p1,p2,p3>', 'Port(s) to open HTTP server on local machine, comma-separated', parsePorts).option('-n, --num-streams <n>', 'Number of SBP streams', parseInt).option('-z, --hz <n>', 'Speed in hertz of updates', parseInt).option('-d, --duration <s>', 'Time to finish streams', _parseDuration2.default).parse(process.argv);

var streams = (0, _index2.default)(_commander2.default.path, _commander2.default.numStreams, _commander2.default.hz, _commander2.default.duration);

// Start up optional HTTP streams

var _loop = function _loop(i) {
  var port = _commander2.default.ports[i];
  var stream = streams[i];
  var responder = function responder(req, res) {
    stream.pipe(res);
  };
  _http2.default.createServer(responder).listen(port);
};

for (var i = 0; i < (_commander2.default.ports && _commander2.default.ports.length || 0); i++) {
  _loop(i);
}