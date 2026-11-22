import { test } from 'node:test';
import assert from 'node:assert/strict';
import { surfaceRadius, riseSpeed, riseTime, bubbleBurst, popJet, foamRadius, foamAlpha } from '../src/logic/bubbles.js';

const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('深いところの泡は、上がるほどふくらむ(水深10mで吹いた泡は、水面で体積がほぼ2倍)', () => {
  const r = surfaceRadius(0.01, 10.3);
  assert.ok(Math.abs((r / 0.01) ** 3 - 2) < 1e-9);
  assert.equal(surfaceRadius(0.01, 0), 0.01);
});

test('大きい泡ほど速く上がり、先に水面へ着く', () => {
  assert.ok(riseSpeed(0.03) > riseSpeed(0.002));
  assert.ok(riseSpeed(0.002) >= 0.2 && riseSpeed(0.002) <= 0.3);
  assert.ok(riseTime(0.03, 12) < riseTime(0.002, 12));
  // 12m から小さい泡は 1分弱、大きい泡は 30秒たらず
  assert.ok(riseTime(0.002, 12) > 40 && riseTime(0.002, 12) < 55, String(riseTime(0.002, 12)));
});

test('一度に吹いた泡は、時間をずらして、広がりながら水面に着く', () => {
  const list = bubbleBurst([5, 0, -3], { depth: 12, count: 200, radius: 0.5, rng: seeded(7) });
  assert.equal(list.length, 200);
  assert.equal(list[0].at, 0);
  for (let i = 1; i < list.length; i++) assert.ok(list[i].at >= list[i - 1].at);
  const last = list[list.length - 1].at;
  assert.ok(last > 5, `いちばんおそい泡 ${last}秒`);
  // 先に着く泡は大きい
  const early = list.slice(0, 20).reduce((s, p) => s + p.r, 0), late = list.slice(-20).reduce((s, p) => s + p.r, 0);
  assert.ok(early > late);
  const far = Math.max(...list.map(p => Math.hypot(p.x - 5, p.z + 3)));
  assert.ok(far > 0.5 && far < 0.5 + 0.12 * 12 * 2.1);
});

test('大きい泡ほど、はじけたときにたくさん高く水滴を飛ばす', () => {
  assert.ok(popJet(0.04).n > popJet(0.003).n);
  assert.ok(popJet(0.04).speed > popJet(0.003).speed);
});

test('着水の泡はふちに寄り、まん中はうすい', () => {
  const rs = Array.from({ length: 2000 }, (_, i) => foamRadius((i + 0.5) / 2000));
  const inner = rs.filter(r => r < 0.4).length, outer = rs.filter(r => r > 0.6).length;
  assert.ok(outer > inner * 3, `${inner} / ${outer}`);
  assert.ok(rs.every(r => r >= 0 && r <= 1));
  assert.ok(Math.abs(foamRadius(0.25, 0) - 0.5) < 1e-9);
});

test('泡の粒をたくさん重ねても、真っ白にならないこさにする', () => {
  const a = foamAlpha(500, 6, 1.4);
  assert.ok(a * (500 * 1.4 * 1.4) / (Math.PI * 36) <= 1.31);
  assert.equal(foamAlpha(10, 6, 1), 0.6);
});
