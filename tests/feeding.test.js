import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jawWeights, jawHinge, jawPoint, bodyPoint, bodyZ, faceFeatures, buildWhaleGeometry } from '../src/logic/whaleShape.js';
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

test('バブルネット: 5〜7頭で、直径15〜30mの泡の輪のまん中から、少しずつずれて次々に飛び出す', async () => {
  const { BUBBLE_NET, bubbleNetGroup } = await import('../src/logic/feeding.js');
  const g = bubbleNetGroup(() => 0.5);
  assert.ok(g.length >= 5 && g.length <= 7);
  assert.ok(BUBBLE_NET.ringRadius * 2 >= 15 && BUBBLE_NET.ringRadius * 2 <= 30);
  const delays = g.map(w => w.delay).sort((a, b) => a - b);
  const spread = delays.at(-1) - delays[0];
  assert.ok(spread >= 1.2 && spread <= 4.5, `spread ${spread}`);
  for (let i = 1; i < delays.length; i++) assert.ok(delays[i] - delays[i - 1] >= 0.3, 'one after another');
  for (const w of g) assert.ok(Math.hypot(...w.offset) < BUBBLE_NET.ringRadius * 0.6, 'inside the ring');
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    assert.ok(Math.hypot(g[i].offset[0] - g[j].offset[0], g[i].offset[1] - g[j].offset[1]) >= 3.2, 'mouths do not overlap');
  }
});

test('バブルネットのあとは、何回か潮を吹いて、1頭ずつ潜っていく', async () => {
  const { BUBBLE_NET, bubbleNetGroup } = await import('../src/logic/feeding.js');
  const g = bubbleNetGroup(Math.random);
  const dives = g.map(w => w.dive).sort((a, b) => a - b);
  for (let i = 1; i < dives.length; i++) assert.ok(dives[i] - dives[i - 1] >= 2, 'one by one');
  for (const w of g) {
    assert.ok(w.blows.length >= 2 && w.blows.every(b => b < w.dive && b > FEEDING.closed));
  }
  assert.ok(dives.at(-1) + 12 <= PATTERNS.bubbleNet.durationMs / 1000);
  assert.equal(BUBBLE_NET.surface, FEEDING.surface);
});

test('調べた形: のどの袋はあごの関節の下がいちばん深く、前は急に、うしろはおへそへなだらかに細くなる(オタマジャクシの形)', async () => {
  const { pouchAlong, pouchAcross, ENGULF, POUCH_SWELL } = await import('../src/logic/whaleShape.js');
  const peak = corner.u;
  let best = 0, bestU = 0;
  for (let u = 0; u <= 1; u += 0.002) { const v = pouchAlong(u); if (v > best) { best = v; bestU = u; } }
  assert.ok(Math.abs(bestU - peak) < 0.01 && best > 0.99, `peak ${bestU}`);
  assert.equal(pouchAlong(0.01), 0);
  assert.equal(pouchAlong(0.6), 0, 'おへそより後ろはふくらまない');
  assert.ok(pouchAlong(0.07) > 0.3, '前はあごの先の近くまで深い');
  assert.ok(pouchAlong(0.52) < 0.15, 'うしろはなだらかに消える');
  // 畝のある範囲は体長の5〜6割
  assert.ok(ENGULF.to - ENGULF.from >= 0.5 && ENGULF.to - ENGULF.from <= 0.6);
  // 横から見ると丸い船底: おなかのまん中が深く、横へなめらかに消える(平らな板のようにならない)
  assert.equal(pouchAcross(Math.PI), 1);
  assert.ok(pouchAcross(2.3) < 0.5 && pouchAcross(1.6) === 0);
  for (let a = 1.6; a < Math.PI; a += 0.05) assert.ok(pouchAcross(a + 0.05) >= pouchAcross(a));
  // いちばん深いところは14mのクジラで約2m
  assert.ok(POUCH_SWELL * 14 > 1.6 && POUCH_SWELL * 14 < 2.4);
});

test('のどがいっぱいのとき、おなかの線はなめらかなふくらみ(段や角がない)', () => {
  const ys = [];
  for (let u = 0.02; u <= 0.62; u += 0.01) ys.push(jawPoint('humpback', u, Math.PI, 0, 0, 1)[1]);
  for (let i = 1; i < ys.length - 1; i++) {
    const curve = ys[i - 1] - 2 * ys[i] + ys[i + 1];
    assert.ok(Math.abs(curve) < 0.02, `u ${0.02 + i * 0.01} curve ${curve}`);
  }
  // 袋の底は、体のいちばん太いところより下まで出る
  const bottomBody = bodyPoint('humpback', 0.32, Math.PI)[1];
  assert.ok(Math.min(...ys) < bottomBody - 0.1);
});

test('口を開けると、左右の下あごが外へ広がる(関節で頭の幅の約1.2倍まで)', () => {
  const closed = jawPoint('humpback', 0.15, 2.3, 0);
  const open = jawPoint('humpback', 0.15, 2.3, FEEDING.lowerJaw);
  const r = open[0] / closed[0];
  assert.ok(r > 1.1 && r < 1.3, `${r}`);
});

test('ひげ板は上あごから下がり、長さは0.7m以下。口を閉じると下あごの中に隠れる', () => {
  const g = buildWhaleGeometry('humpback');
  const from = g.fluke.start + g.fluke.s.length;
  const n = g.positions.length / 3 - from;
  assert.ok(n > 100, `baleen vertices ${n}`);
  let maxLen = 0;
  for (let k = from; k < from + n; k++) {
    assert.equal(g.jaw[k * 4], 0, '下あごといっしょに動かない');
    assert.ok(g.jaw[k * 4 + 2] <= 0, 'のどといっしょにふくらまない');
  }
  // 列ごとの、口を開けたときの長さ(上の点と下の点の高さの差 + のびる長さ)
  for (let k = from; k + 4 < from + n; k += 5) maxLen = Math.max(maxLen, g.positions[k * 3 + 1] - g.positions[(k + 4) * 3 + 1] - g.jaw[(k + 4) * 4 + 2]);
  assert.ok(maxLen * 14 > 0.4 && maxLen * 14 <= 0.7, `${maxLen * 14} m`);
  // 閉じているときは、どの点も体の外へ出ない(左右の幅と、あごの底より上)
  for (let k = from; k < from + n; k++) {
    const z = g.positions[k * 3 + 2], x = g.positions[k * 3], y = g.positions[k * 3 + 1];
    const u = (z - bodyZ(0)) / (bodyZ(1) - bodyZ(0));
    const bottom = bodyPoint('humpback', u, Math.PI)[1];
    assert.ok(y > bottom, `below chin at u ${u}`);
    assert.ok(Math.abs(x) < bodyPoint('humpback', u, Math.PI / 2)[0] * 1.05, `outside at u ${u}`);
  }
});

test('口を開けたりとじたりするあいだ、のどの皮が前後に折れかえらない(段ができない)', () => {
  for (const t of [12.4, 13.2, 14, 16, 18.8, 19.6, 20.4]) {
    const { gape, pouch } = feedingPose(t);
    for (const theta of [1.95, 2.2, 2.5, 2.8, Math.PI]) {
      let prev = null, prevDir = null;
      for (let u = 0.02; u <= 0.5; u += 0.005) {
        const p = jawPoint('humpback', u, theta, gape * FEEDING.lowerJaw, gape * FEEDING.upperJaw, pouch);
        if (prev) {
          assert.ok(p[2] > prev[2], `t=${t} θ=${theta} u=${u.toFixed(3)}: folds back (${prev[2]} -> ${p[2]})`);
          const dir = [p[1] - prev[1], p[2] - prev[2]]; const n = Math.hypot(...dir);
          if (prevDir) {
            const cos = (dir[0] * prevDir[0] + dir[1] * prevDir[1]) / n;
            assert.ok(cos > Math.cos((60 * Math.PI) / 180), `t=${t} θ=${theta} u=${u.toFixed(3)}: sharp crease`);
          }
          prevDir = dir.map(v => v / n);
        }
        prev = p;
      }
    }
  }
});
