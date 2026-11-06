import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOW, FOOTPRINT, blowSpeed, blowDirection, divingYaw } from '../src/logic/behavior.js';

test('ザトウクジラの潮吹きは、もこもこした形で高さ3〜5m', () => {
  assert.ok(BLOW.humpback.height >= 3 && BLOW.humpback.height <= 5);
  assert.ok(BLOW.humpback.spread > BLOW.sperm.spread, 'bushy');
  assert.equal(BLOW.humpback.tiltDeg, 0);
});

test('噴き上げる速さから計算した高さが、決めた高さになる', () => {
  // 画面の粒子と同じ動き方(上向きには空気の抵抗をかけず、重力だけで止まる)で確かめる
  for (const kind of ['humpback', 'sperm']) {
    const g = BLOW[kind].gravity;
    const dir = blowDirection(kind, [0, 0, -1]);
    let v = blowSpeed(kind) * dir[1], y = 0, top = 0;
    for (let i = 0; i < 2000; i++) { const dt = 1 / 240; v -= g * dt; y += v * dt; top = Math.max(top, y); }
    const want = BLOW[kind].height;
    assert.ok(Math.abs(top - want) < want * 0.06, `${kind} top ${top} want ${want}`);
  }
});

test('マッコウクジラの潮吹きは、左前に45度かたむく', () => {
  // 頭が -z を向いているとき、左は -x
  const d = blowDirection('sperm', [0, 0, -1]);
  const len = Math.hypot(...d);
  assert.ok(Math.abs(len - 1) < 1e-9);
  const up = Math.asin(d[1]) * 180 / Math.PI;
  assert.ok(Math.abs(up - 45) < 1, `up ${up}`);
  assert.ok(d[2] < 0, 'forward');
  assert.ok(d[0] < 0, 'left');
  // ザトウクジラはまっすぐ上
  assert.deepEqual(blowDirection('humpback', [0, 0, -1]), [0, 1, 0]);
});

test('潜ったあとの足あと(フットプリント)は数分残る', () => {
  assert.ok(FOOTPRINT.lastsMs >= 60000 && FOOTPRINT.lastsMs <= 300000);
  assert.ok(FOOTPRINT.lengthMeters > FOOTPRINT.widthMeters, 'oval');
});

test('尾びれを上げて潜るときは、カメラから遠ざかる向きに進む(尾びれの裏がこちらを向く)', () => {
  let s = 3; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 500; i++) {
    const yaw = divingYaw(rng);
    assert.ok(yaw >= -30 && yaw <= 30, `yaw ${yaw}`);
  }
});

test('近くで大きな水しぶきが上がると、画面が少し揺れる。遠いと揺れない', async () => {
  const behavior = await import('../src/logic/behavior.js');
  const { cameraShake } = behavior;
  assert.ok(cameraShake(10) > 0.5);
  assert.equal(cameraShake(80), 0);
  for (let d = 0; d < 100; d += 1) {
    assert.ok(cameraShake(d) <= 1);
    assert.ok(cameraShake(d + 1) <= cameraShake(d) + 1e-9, 'never stronger farther away');
  }
  // 画面にかかるしずくは、シャボン玉のように見えたのでなくした
  assert.equal(behavior.lensSplash, undefined);
});
