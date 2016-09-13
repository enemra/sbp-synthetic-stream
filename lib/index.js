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

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.LLA = LLA;
exports.default = sbpSyntheticStream;
var net = require('net');
var pkg = require('../package.json');
var PassThru = require('stream').PassThrough;

var projector = require('ecef-projector');

var constructMsg = require('libsbp/javascript/sbp/construct');
var libsbpNavigation = require('libsbp/javascript/sbp/navigation');
var MsgPosLlh = libsbpNavigation.MsgPosLlh;
var MsgPosEcef = libsbpNavigation.MsgPosEcef;
var MsgGpsTime = libsbpNavigation.MsgGpsTime;

var moment = require('moment');

/**
 * Convert GPS moment timestamp (in GPS time, without leap seconds) to { wn, tow }.
 *
 * @param {moment} gpsTimestamp - A `moment` object representing a GPS timestamp, without leap-seconds.
 * @return {object} { wn, tow }
 */
function momentGpsTimestampToWnTow(gpsTimestamp) {
  var gpsEpochSeconds = 315964800;
  var weekSeconds = 60 * 60 * 24 * 7;
  var gpsTimeMs = gpsTimestamp.unix() - gpsEpochSeconds;
  var wn = Math.floor(gpsTimeMs / weekSeconds);
  var tow = gpsTimeMs - wn * weekSeconds;
  return { wn: wn, tow: tow };
}

/**
 * lat, long, ellipsoid altitude
 *
 * altitude is in meters
 *
 * @param {Number} lat - latitude in degrees
 * @param {String} latPole - latitude pole: 'N' or 'S'
 * @param {Number} lng - longitude in degrees
 * @param {String} lngPole - longitude pole: 'W' or 'E'
 */
function LLA(lat, latPole, lng, lngPole, alt) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof alt !== 'number') {
    throw new Error('lat, lng, alt must all be Numbers: ' + (typeof lat === 'undefined' ? 'undefined' : _typeof(lat)) + ' ' + (typeof lng === 'undefined' ? 'undefined' : _typeof(lng)) + ' ' + (typeof alt === 'undefined' ? 'undefined' : _typeof(alt)));
  }

  // we expect everything to be N, E
  var latPrime = lat * (latPole === 'S' ? -1 : 1);
  var lngPrime = lng * (lngPole === 'W' ? -1 : 1);

  this.lat = latPrime;
  this.latPole = 'N';
  this.lng = lngPrime;
  this.lngPole = 'E';
  this.alt = alt;
}

/**
 * ECEF: x, y, z
 *
 * TODO: associate a datum and epoch-of-datum
 *
 * @param {Number} x - X parameter in meters
 * @param {Number} y - Y parameter in meters
 * @param {Number} z - Z parameter in meters
 */
function ECEF(x, y, z) {
  this.x = x;
  this.y = y;
  this.z = z;
}

/**
 * @param {LLA} lla
 * @returns {ECEF}
 */
function lla2ecef(lla) {
  var v = projector.project(lla.lat, lla.lng, lla.alt);
  return new ECEF(v[0], v[1], v[2]);
}

function jitterLat(factor) {
  return Math.random() * factor;
}

function jitterLng(factor) {
  return Math.random() * factor;
}

function jitterAlt(factor) {
  return Math.random() * factor;
}

/**
 * Start N SBP streams, interpolating between LLA points.
 * Will open HTTP ports as well, if specified.
 *
 * @param {Array} points - a list of LLA objects 
 * @param {Number} numStreams A number representing the number of SBP readable streams to generate
 * @param {Number} hz The frequency in hertz of stream updates
 * @param {Number} timeDuration The time to complete streams. In milliseconds.
 * @param {Number} jflat Jitter factor for latitude
 * @param {Number} jflng Jitter factor for longitude
 * @param {Number} jfalt Jitter factor for altitude
 */
function sbpSyntheticStream(points, numStreams, hz, timeDuration) {
  var jflat = arguments.length <= 4 || arguments[4] === undefined ? 0.001 : arguments[4];
  var jflng = arguments.length <= 5 || arguments[5] === undefined ? 0.001 : arguments[5];
  var jfalt = arguments.length <= 6 || arguments[6] === undefined ? 0.01 : arguments[6];

  if (!Array.isArray(points)) {
    throw new Error('`points` must be an array');
  }
  if (parseInt(numStreams) != numStreams) {
    throw new Error('`numStreams` must be an integer value');
  }
  if (parseFloat(hz) != hz) {
    throw new Error('`hz` must be a number');
  }
  if (parseFloat(jflat) != jflat) {
    throw new Error('`jflat` must be a number');
  }
  if (parseFloat(jflng) != jflng) {
    throw new Error('`jflng` must be a number');
  }
  if (parseFloat(jfalt) != jfalt) {
    throw new Error('`jfalt` must be a number');
  }
  if (parseInt(timeDuration) != timeDuration) {
    throw new Error('`timeDuration` must be an integer value');
  }

  var streams = new Array(numStreams).fill(0).map(function () {
    return new PassThru();
  });

  var hertzDelay = 1000 / hz;
  var numPoints = points.length;
  var startTime = Date.now();

  var hertzInterval = setInterval(function () {
    var currentTime = Date.now();

    var _momentGpsTimestampTo = momentGpsTimestampToWnTow(moment(currentTime));

    var tow = _momentGpsTimestampTo.tow;
    var wn = _momentGpsTimestampTo.wn;

    var progress = (currentTime - startTime) / timeDuration;
    var unroundedCurrentPoint = progress * (numPoints - 1);
    var currentPoint = Math.floor(unroundedCurrentPoint);
    var nextPoint = currentPoint + 1;
    var transitionFactor = 1 - (nextPoint - unroundedCurrentPoint);

    var currentLLA = points[currentPoint];
    var nextLLA = points[nextPoint];

    if (!(currentLLA && nextLLA)) {
      return;
    }

    var lat = currentLLA.lat + (nextLLA.lat - currentLLA.lat) * transitionFactor;
    var lng = currentLLA.lng + (nextLLA.lng - currentLLA.lng) * transitionFactor;
    var alt = currentLLA.alt + (nextLLA.alt - currentLLA.alt) * transitionFactor;

    var timeMsg = constructMsg(MsgGpsTime, {
      wn: wn,
      tow: parseInt(tow),
      ns: (tow - parseInt(tow)) * 1e9,
      flags: 0
    }).toBuffer();

    var jitterPositionMsg = function jitterPositionMsg() {
      var lla = new LLA(lat + jitterLat(jflat), 'N', lng + jitterLng(jflng), 'E', alt + jitterAlt(jfalt));
      var ecef = lla2ecef(lla);

      var msgLla = constructMsg(MsgPosLlh, {
        tow: tow,
        lat: lla.lat,
        lon: lla.lng,
        height: lla.alt,
        h_accuracy: 1, // TODO
        v_accuracy: 1, // TODO
        n_sats: 10, // TODO
        flags: 0 // TODO

      }).toBuffer();

      var msgEcef = constructMsg(MsgPosEcef, {
        tow: tow,
        x: ecef.x,
        y: ecef.y,
        z: ecef.z,
        accuracy: 1, // TODO
        n_sats: 10, // TODO
        flags: 0 // TODO
      }).toBuffer();

      return Buffer.concat([msgLla, msgEcef]);
    };

    // Write messages to each stream
    streams.map(function (s) {
      s.write(timeMsg);
      s.write(jitterPositionMsg());
    });
  }, hertzDelay);

  setTimeout(function () {
    clearInterval(hertzInterval);
    streams.map(function (s) {
      s.end();
    });
  }, timeDuration);

  return streams;
};

var version = exports.version = pkg.version;