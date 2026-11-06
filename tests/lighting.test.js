import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whaleLights, LIGHTING } from '../src/logic/lighting.js';

const norm = v => { const n = Math.hypot(...v); return v.map(x => x / n); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const forward = norm([0, -0.1, -1]);   // カメラは -z(西南西)を向いている

test('太陽が正面(逆光)のときは、クジラを照らす光をカメラのうしろ側へ移す(順光)', () => {
  const sun = norm([0.2, 0.15, -1]);   // 正面の低い夕日
  const { key, rim } = whaleLights(sun, forward);
  assert.ok(dot(key, forward) < -0.3, 'key light from behind the camera');
  // こちらを向いた尾びれの裏(カメラのほうを向いた面)に光が当たる
  assert.ok(dot(key, forward.map(x => -x)) > 0.3);
  // 太陽と同じ側(右)から当てる
  assert.ok(key[0] > 0);
  // 本物の太陽の向きからは、ふちを照らす弱い光
  assert.ok(dot(rim, sun) > 0.99);
});

test('光は低すぎない(20度以上の高さから)', () => {
  const { key } = whaleLights(norm([0, 0.02, -1]), forward);
  assert.ok(Math.asin(key[1]) >= (LIGHTING.minElevation - 0.5) * Math.PI / 180);
});

test('太陽がもともとうしろ側にあるときは、そのまま', () => {
  const sun = norm([0.3, 0.6, 1]);
  const { key } = whaleLights(sun, forward);
  assert.ok(dot(key, sun) > 0.99);
});

test('ふちの光は、正面からの光より弱い', () => {
  assert.ok(LIGHTING.rim < LIGHTING.key);
});
