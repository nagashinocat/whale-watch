import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EYE, lidOffset, eyeFrame, eyePatch, applyLid, eyeScreenFraction } from '../src/logic/eyeShape.js';
import { eyeHole, faceFeatures } from '../src/logic/whaleShape.js';

test('目の玉は直径約13cm(調べた値)。目の開きはそれより小さい', () => {
  assert.ok(Math.abs(EYE.eyeball * 2 - 0.13) < 0.01);
  assert.ok(EYE.width < EYE.eyeball * 2 && EYE.height < EYE.width);
});

test('まぶた: 開いているときは目の開きの中がへこみ(穴)、ふちは盛り上がる', () => {
  assert.ok(lidOffset(0, 0, 1) < -0.03, 'opening goes in');
  const rim = lidOffset(0, EYE.height / 2 + 0.01, 1);
  assert.ok(rim > 0.008 && rim < 0.03, `rim ${rim}`);
});

test('まぶたを閉じると穴がなくなる(まぶたが合わさる)', () => {
  assert.ok(lidOffset(0, 0, 0) > -0.005, `${lidOffset(0, 0, 0)}`);
  assert.ok(lidOffset(0, EYE.height / 4, 0) > 0);
});

test('目の形はアーモンド形: 目じりの先は開いていない', () => {
  assert.ok(lidOffset(EYE.width / 2 + 0.01, 0, 1) > 0);
  assert.ok(lidOffset(EYE.width / 2 - 0.02, 0, 1) < -0.03);
});

test('目のまわりのしわは数mm。離れると体の表面にもどる(つなぎ目が出ない)', () => {
  for (let x = -0.3; x <= 0.3; x += 0.013) {
    for (let y = -0.3; y <= 0.3; y += 0.017) {
      const r = Math.hypot(x / (EYE.width / 2), y / (EYE.height / 2));
      if (r > 3) assert.ok(Math.abs(lidOffset(x, y, 1)) < 0.005, `${x} ${y}`);
    }
  }
  assert.ok(Math.abs(lidOffset(0.45, 0.4, 1)) < 1e-4);
});

test('目の場所: 体の横で、外向きの向きは横を向いている', () => {
  for (const side of [1, -1]) {
    const f = eyeFrame(side);
    assert.ok(Math.sign(f.normal[0]) === side && Math.abs(f.normal[0]) > 0.7, `${f.normal}`);
    assert.ok(f.up[1] > 0.5, 'up is toward the back');
    assert.ok(Math.abs(f.along[2]) > 0.9, 'along the body');
  }
});

test('体の目のところには穴をあけ、目の部品(パッチ)がそれより広くおおう', () => {
  const e = faceFeatures('humpback').eye;
  assert.equal(eyeHole('humpback', e.u, e.theta), true);
  assert.equal(eyeHole('humpback', e.u, 2 * Math.PI - e.theta), true);
  assert.equal(eyeHole('humpback', e.u + 0.05, e.theta), false);
  assert.equal(eyeHole('sperm', faceFeatures('sperm').eye.u, faceFeatures('sperm').eye.theta), false);
  // パッチは、まぶたまで入れた目よりずっと広い
  const p = eyePatch(1, 40, 30);
  assert.ok(p.sizeMeters[0] > 0.8 && p.sizeMeters[1] > 0.7, `${p.sizeMeters}`);
});

test('パッチは開け閉めで頂点が動き、ふちの頂点は体の表面のまま', () => {
  const p = eyePatch(1, 40, 30);
  const open = applyLid(new Float32Array(p.base.length), p, 1);
  const shut = applyLid(new Float32Array(p.base.length), p, 0);
  let moved = 0;
  for (let i = 0; i < open.length; i++) if (Math.abs(open[i] - shut[i]) > 1e-5) moved++;
  assert.ok(moved > 0);
  // いちばん外のふち(最初の列)は動かない
  for (let j = 0; j < 30 * 3; j++) assert.ok(Math.abs(open[j] - p.base[j]) < 1e-6 + 2e-5);
});

test('目が合う距離では、まぶたまで入れた目が画面の高さの半分以上をしめる', () => {
  const f = eyeScreenFraction(EYE.contactDistance, 55);
  assert.ok(f > 0.5 && f < 0.85, `${f}`);
});

test('まばたき: 閉じて、またふだんの開きにもどる', async () => {
  const { blinkOpen } = await import('../src/logic/eyeShape.js');
  assert.equal(blinkOpen(-1), EYE.relaxedOpen);
  assert.equal(blinkOpen(0.5), 0);
  assert.equal(blinkOpen(2), EYE.relaxedOpen);
});

test('パッチのふちは、体の網目の頂点とぴったり同じ場所(すきまが出ない)', async () => {
  const { bodyPoint, ringU, aroundTheta, eyeCells } = await import('../src/logic/whaleShape.js');
  const c = eyeCells('humpback');
  const p = eyePatch(1, 41, 31);
  const corner = bodyPoint('humpback', ringU(c.i0), aroundTheta(c.right[0]));
  for (let m = 0; m < 3; m++) assert.ok(Math.abs(p.base[m] - corner[m]) < 1e-6);
  const last = (41 * 31 - 1) * 3;
  const corner2 = bodyPoint('humpback', ringU(c.i1), aroundTheta(c.right[1]));
  for (let m = 0; m < 3; m++) assert.ok(Math.abs(p.base[last + m] - corner2[m]) < 1e-6);
});

test('目の玉の向き(前後・上下・外向き)は、鏡に映した向きになっていない(右目も左目も)', async () => {
  const { eyeballPlacement } = await import('../src/logic/eyeShape.js');
  for (const side of [1, -1]) {
    const { basis } = eyeballPlacement(side);
    const [x, y, z] = basis;
    const det = x[0] * (y[1] * z[2] - y[2] * z[1]) - x[1] * (y[0] * z[2] - y[2] * z[0]) + x[2] * (y[0] * z[1] - y[1] * z[0]);
    assert.ok(Math.abs(det - 1) < 1e-6, `side ${side} det ${det}`);
  }
});
