import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jawWeights, jawHinge, jawPoint, bodyPoint, faceFeatures, buildWhaleGeometry } from '../src/logic/whaleShape.js';
import { FEEDING, feedingPose } from '../src/logic/feeding.js';
import { PATTERNS } from '../src/logic/patterns.js';

const corner = faceFeatures('humpback').mouth.at(-1);

test('口の線より下(下あご)は下あごといっしょに、上(上あご)は上あごといっしょに動く', () => {
  const [lower] = jawWeights('humpback', 0.1, 2.4);
  const [, upper] = jawWeights('humpback', 0.1, 1.0);
  assert.ok(lower > 0.95 && upper > 0.95, `${lower} ${upper}`);
});

test('目・背中・胴の後ろは、口を開けても動かない', () => {
  const e = faceFeatures('humpback').eye;
  assert.deepEqual(jawWeights('humpback', e.u, e.theta).slice(0, 3).map(v => +v.toFixed(3)), [0, 0, 0]);
  assert.deepEqual(jawWeights('humpback', 0.7, 2.8).slice(0, 3), [0, 0, 0]);
  assert.equal(jawWeights('humpback', 0.35, 0.2)[2], 0, 'no pouch on the back');
});

test('のどからおなか(畝のあるところ)が大きくふくらむ', () => {
  assert.ok(jawWeights('humpback', 0.35, Math.PI)[2] > 0.8);
  assert.ok(jawWeights('humpback', 0.6, Math.PI)[2] === 0, 'grooves end at the navel');
});

test('マッコウクジラは口を動かさない', () => {
  assert.deepEqual(jawWeights('sperm', 0.1, 2.6), [0, 0, 0, 0]);
});

test('あごの軸は口の端', () => {
  const h = jawHinge('humpback');
  const c = bodyPoint('humpback', corner.u, corner.theta);
  assert.ok(Math.abs(h[0] - c[1]) < 1e-9 && Math.abs(h[1] - c[2]) < 1e-9);
});

test('下あごを開くと、あごの先は下へ動く', () => {
  const closed = jawPoint('humpback', 0.02, Math.PI, 0);
  const open = jawPoint('humpback', 0.02, Math.PI, FEEDING.lowerJaw);
  assert.ok(open[1] < closed[1] - 0.05, `${closed[1]} -> ${open[1]}`);
});

test('体の形には、頂点ごとのあごの重みが入っている', () => {
  const g = buildWhaleGeometry('humpback');
  assert.equal(g.jaw.length, (g.positions.length / 3) * 4);
});

test('調べた数値: 口は大きく開き(上下あわせて約80度)、水をのみこむのは10秒以内、水をこし出すのは約46秒', () => {
  const deg = r => (r * 180) / Math.PI;
  assert.ok(Math.abs(deg(FEEDING.lowerJaw + FEEDING.upperJaw) - 80) < 6);
  let openFrom = null, openTo = null;
  for (let t = 0; t <= FEEDING.end; t += 0.05) {
    const p = feedingPose(t);
    if (p.gape > 0.05 && openFrom === null) openFrom = t;
    if (openFrom !== null && openTo === null && p.gape < 0.05 && t > openFrom) openTo = t;
  }
  assert.ok(openTo - openFrom < 10, `mouth open ${openTo - openFrom}s`);
  assert.ok(Math.abs(FEEDING.filterEnd - FEEDING.filterStart - 46) < 3);
});

test('流れの順番: 泡の輪 → 口を開けて飛び出す → 口を閉じる → 水をこし出す → 潮吹きで終わり', () => {
  const F = FEEDING;
  assert.ok(F.ringEnd <= F.lunge && F.lunge < F.surface && F.surface < F.closeStart && F.closeStart < F.filterStart && F.filterEnd <= F.blow && F.blow < F.end);
  assert.equal(PATTERNS.feeding.durationMs, F.end * 1000);
  // のどはこし出しているあいだ少しずつしぼみ、潮吹きのときはもとにもどっている
  assert.ok(feedingPose(F.filterStart + 1).pouch > 0.8);
  assert.ok(feedingPose(F.blow).pouch < 0.05);
});

test('水面を割るときは、秒速2〜4mで上がってくる(調べた突進の速さ)', () => {
  const s = (feedingPose(FEEDING.surface).tipY - feedingPose(FEEDING.surface - 1).tipY);
  assert.ok(s >= 2 && s <= 4.5, `${s} m/s`);
  const top = Math.max(...Array.from({ length: 400 }, (_, i) => feedingPose(i * 0.1).tipY));
  assert.ok(top > 3.5 && top < 7, `head out ${top}m`);
});
