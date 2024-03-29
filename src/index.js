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

import net from 'net';
import { PassThrough } from 'stream';
import projector from 'ecef-projector';
import { utcTimestampToWnTow } from 'gpstime';
import pkg from '../package.json';
import constructMsg from'libsbp/javascript/sbp/construct';
import libsbpNavigation from 'libsbp/javascript/sbp/navigation';

const { MsgPosLlh, MsgPosEcef, MsgGpsTime } = libsbpNavigation;

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
export function LLA (lat, latPole, lng, lngPole, alt) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof alt !== 'number') {
    throw new Error('lat, lng, alt must all be Numbers: '
                    + typeof lat + ' ' + typeof lng + ' ' + typeof alt);
  }

  // we expect everything to be N, E
  const latPrime = lat * (latPole === 'S' ? -1 : 1);
  const lngPrime = lng * (lngPole === 'W' ? -1 : 1);

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
function ECEF (x, y, z) {
  this.x = x;
  this.y = y;
  this.z = z;
}

/**
 * @param {LLA} lla
 * @returns {ECEF}
 */
function lla2ecef(lla) {
  const v = projector.project(lla.lat, lla.lng, lla.alt);
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
 * Ensure that points passed with `lng` or `lon` both work.
 */
function normalizePoint (pt) {
  if (!pt) {
    return pt;
  }

  return Object.assign({}, pt, {
    lng: pt.lng || pt.lon,
    lon: pt.lng || pt.lon
  });
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
export default function sbpSyntheticStream (points, numStreams, hz, timeDuration, jflat=0.001, jflng=0.001, jfalt=0.01) {
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

  const streams = new Array(numStreams).fill(0).map(function () {
    return new PassThrough();
  });

  const hertzDelay = 1000 / hz;
  const numPoints = points.length;
  const startTime = new Date();

  const hertzInterval = setInterval(function () {
    const currentTime = new Date();
    const { tow, wn } = utcTimestampToWnTow(currentTime);
    const progress = (currentTime - startTime) / timeDuration;
    const unroundedCurrentPoint = progress * (numPoints - 1);
    const currentPoint = Math.floor(unroundedCurrentPoint);
    const nextPoint = currentPoint + 1;
    const transitionFactor = 1 - (nextPoint - unroundedCurrentPoint);

    const currentLLA = normalizePoint(points[currentPoint]);
    const nextLLA = normalizePoint(points[nextPoint]);

    if (!(currentLLA && nextLLA)) {
      return;
    }

    const lat = (currentLLA.lat + (nextLLA.lat - currentLLA.lat) * transitionFactor);
    const lng = (currentLLA.lng + (nextLLA.lng - currentLLA.lng) * transitionFactor);
    const alt = (currentLLA.alt + (nextLLA.alt - currentLLA.alt) * transitionFactor);

    const timeMsg = constructMsg(MsgGpsTime, {
      wn: wn,
      tow: parseInt(tow),
      ns: (tow - parseInt(tow)) * 1e9,
      flags: 0
    }).toBuffer();

    const jitterPositionMsg = function () {
      const lla = new LLA(lat + jitterLat(jflat), 'N',
                          lng + jitterLng(jflng), 'E',
                          alt + jitterAlt(jfalt));
      const ecef = lla2ecef(lla);

      const msgLla = constructMsg(MsgPosLlh, {
        tow: tow,
        lat: lla.lat,
        lon: lla.lng,
        height: lla.alt,
        h_accuracy: 1, // TODO
        v_accuracy: 1, // TODO
        n_sats: 10, // TODO
        flags: 0 // TODO

      }).toBuffer();

      const msgEcef = constructMsg(MsgPosEcef, {
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
    streams.map(s => s.end());
  }, timeDuration);

  return streams;
};

export const version = pkg.version;
