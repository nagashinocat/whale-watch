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

test('星は日が沈んでしばらくしてから見え始め、夜にいちばん多い', () => {
  assert.equal(sunForTime(12).starlight, 0);
  assert.equal(sunForTime(18).starlight, 0);
  const dusk = sunForTime(18.6).starlight;
  assert.ok(dusk > 0 && dusk < 0.6, `dusk ${dusk}`);
  assert.equal(sunForTime(23).starlight, 1);
});

test('月は日没後に見え始める', () => {
  assert.equal(sunForTime(15).moonlight, 0);
  assert.equal(sunForTime(22).moonlight, 1);
});

test('夕日と朝日はカメラの正面寄り(海に光の道ができる向き)に沈む・昇る', () => {
  // カメラは方位180度(-Z)を向いている。縦長画面でも見えるよう、正面から12度以内
  for (const h of [6, 18]) assert.ok(Math.abs(sunForTime(h).azimuth - 180) <= 12, `${h}`);
});
