import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunForTime } from '../src/logic/sky.js';

test('昼は太陽が高く、夜は沈んでいる', () => {
  assert.ok(sunForTime(12).elevation > 30);
  assert.ok(sunForTime(0).elevation < 0);
  assert.equal(sunForTime(1).isNight, true);
  assert.equal(sunForTime(12).isNight, false);
});

test('日中の度合いは昼に1、夜に0', () => {
  assert.ok(sunForTime(12).daylight > 0.99);
  assert.ok(sunForTime(10).daylight > 0.9);
  assert.equal(sunForTime(1).daylight, 0);
  const evening = sunForTime(17.5).daylight;
  assert.ok(evening > 0 && evening < 0.6);
});

test('夜は昼より暗い', () => {
  assert.ok(sunForTime(1).exposure < sunForTime(12).exposure / 2);
});

test('0時をまたいでも急に変わらない', () => {
  const a = sunForTime(23.999), b = sunForTime(0);
  assert.ok(Math.abs(a.elevation - b.elevation) < 0.5);
  assert.ok(Math.abs(a.exposure - b.exposure) < 0.01);
});

test('どの時刻でも1分の差で大きく変わらない', () => {
  for (let h = 0; h < 24; h += 1 / 60) {
    assert.ok(Math.abs(sunForTime(h).exposure - sunForTime(h + 1 / 60).exposure) < 0.02);
  }
});
