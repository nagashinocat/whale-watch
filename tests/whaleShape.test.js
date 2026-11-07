import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WHALE_SPECS, bodySection, humpbackNares, NARES, skinColor, ventralGroove, headKnobs, buildWhaleGeometry, finGeometry, flukeGeometry,
} from '../src/logic/whaleShape.js';

// 体長を1としたときの比率で確かめる(頭が z = -0.5、尾びれの先が z = +0.5)
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  return { min, max };
}

for (const kind of ['humpback', 'sperm']) {
  test(`${kind}: 形のデータが正しく並んでいる(頭から尾まで体長1)`, () => {
    const g = buildWhaleGeometry(kind);
    assert.equal(g.positions.length % 3, 0);
    assert.equal(g.colors.length, g.positions.length);
    const n = g.positions.length / 3;
    for (const i of g.indices) assert.ok(i >= 0 && i < n);
    for (const v of g.positions) assert.ok(Number.isFinite(v));
    const { min, max } = bounds(g.positions);
    assert.ok(Math.abs(min[2] + 0.5) < 0.01 && Math.abs(max[2] - 0.5) < 0.01, `z ${min[2]}..${max[2]}`);
  });
}

test('ザトウクジラの胸びれは体長の約3分の1', () => {
  const fin = finGeometry('humpback', 1);
  assert.ok(fin.length > 0.28 && fin.length < 0.36, `fin ${fin.length}`);
});

test('ザトウクジラの胸びれは白く、前のふちにこぶが並ぶ', () => {
  const fin = finGeometry('humpback', 1);
  assert.ok(fin.leadingEdgeKnobs >= 8);
  let white = 0, n = 0;
  for (let i = 0; i < fin.colors.length; i += 3) { n++; if (lum(fin.colors.slice(i, i + 3)) > 0.55) white++; }
  assert.ok(white / n > 0.6, `white ${white / n}`);
});

test('尾びれの幅: ザトウクジラは体長の約3分の1、マッコウクジラはそれより狭い', () => {
  const hb = flukeGeometry('humpback').span;
  const sp = flukeGeometry('sperm').span;
  assert.ok(hb > 0.29 && hb < 0.36, `humpback ${hb}`);
  assert.ok(sp > 0.2 && sp < hb, `sperm ${sp}`);
});

test('ザトウクジラの尾びれのうしろのふちはギザギザ、マッコウクジラはまっすぐ', () => {
  assert.ok(flukeGeometry('humpback').trailingRoughness > 3 * flukeGeometry('sperm').trailingRoughness);
});

test('ザトウクジラはずんぐりした体で、いちばん太いのは体の前から3〜4割のところ', () => {
  let best = 0, at = 0;
  for (let u = 0; u <= 1; u += 0.005) {
    const s = bodySection('humpback', u);
    if (s.halfWidth > best) { best = s.halfWidth; at = u; }
  }
  assert.ok(at > 0.28 && at < 0.45, `max at ${at}`);
  assert.ok(best > 0.08, `girth ${best}`);
});

test('尾の付け根は横からつぶれたように細い', () => {
  for (const kind of ['humpback', 'sperm']) {
    const s = bodySection(kind, 0.9);
    assert.ok(s.halfHeight > 1.6 * s.halfWidth, `${kind} ${s.halfHeight} / ${s.halfWidth}`);
  }
});

test('マッコウクジラの頭は体長の約3分の1で、四角く、前が切り立っている', () => {
  const spec = WHALE_SPECS.sperm;
  assert.ok(spec.headLength > 0.28 && spec.headLength < 0.38);
  const max = Math.max(...Array.from({ length: 30 }, (_, i) => bodySection('sperm', i / 100).halfHeight));
  assert.ok(bodySection('sperm', 0.02).halfHeight > 0.6 * max, 'blunt front');
  assert.ok(bodySection('sperm', 0.15).squareness > 3, 'boxy head');
  assert.ok(bodySection('humpback', 0.15).squareness < 2.6, 'humpback head is rounded');
});

test('背中のいちばん高いところ: ザトウクジラの背びれもマッコウクジラのこぶも、体の約3分の2', () => {
  for (const kind of ['humpback', 'sperm']) {
    let best = -Infinity, at = 0;
    for (let u = 0.5; u <= 0.85; u += 0.002) {
      const s = bodySection(kind, u);
      const top = s.centerY + s.halfHeight + s.dorsal;
      // 体の太さが細くなるぶんを差し引いて、上に出っぱった分だけを比べる
      if (s.dorsal > best) { best = s.dorsal; at = u; }
    }
    assert.ok(best > 0.008, `${kind} dorsal ${best}`);
    assert.ok(at > 0.6 && at < 0.72, `${kind} at ${at}`);
  }
});

test('ザトウクジラは背中が黒く、のどからおなかが白い', () => {
  assert.ok(lum(skinColor('humpback', 0.4, 0)) < 0.12, 'back');
  assert.ok(lum(skinColor('humpback', 0.25, Math.PI)) > 0.5, 'throat');
});

test('マッコウクジラは濃い灰色で、口のまわりが白い', () => {
  const body = skinColor('sperm', 0.5, Math.PI / 2);
  assert.ok(lum(body) > 0.05 && lum(body) < 0.3, `body ${lum(body)}`);
  assert.ok(lum(skinColor('sperm', 0.12, Math.PI)) > 0.5, 'mouth');
});

test('のどの畝の数: ザトウクジラは14〜35本、マッコウクジラは2〜10本', () => {
  const count = kind => {
    // おなか側を細かく横切って、溝(へこみ)の数を数える
    let n = 0, prev = 0;
    for (let i = 0; i <= 4000; i++) {
      const theta = Math.PI / 2 + (i / 4000) * Math.PI;
      const g = ventralGroove(kind, 0.2, theta);
      if (g > 0.5 && prev <= 0.5) n++;
      prev = g;
    }
    return n;
  };
  const hb = count('humpback'), sp = count('sperm');
  assert.ok(hb >= 14 && hb <= 35, `humpback ${hb}`);
  assert.ok(sp >= 2 && sp <= 10, `sperm ${sp}`);
});

test('ザトウクジラの頭にはこぶが並び、マッコウクジラにはない', () => {
  const knobs = headKnobs('humpback');
  assert.ok(knobs.length >= 20);
  for (const k of knobs) assert.ok(k.u > 0 && k.u < 0.25);
  assert.equal(headKnobs('sperm').length, 0);
});

test('泳ぐときは、頭はほとんど動かず、尾ほど大きく上下する', async () => {
  const { swimBend } = await import('../src/logic/whaleShape.js');
  let head = 0, tail = 0;
  for (let p = 0; p < Math.PI * 2; p += 0.05) {
    head = Math.max(head, Math.abs(swimBend(0.05, p, 1)));
    tail = Math.max(tail, Math.abs(swimBend(1, p, 1)));
  }
  assert.ok(head < 0.001, `head ${head}`);
  // 尾の先の片側へのふれは、体長の6〜10%(本気で泳ぐと約10%)
  assert.ok(tail > 0.06 && tail <= 0.1, `tail ${tail}`);
  assert.equal(swimBend(1, 1.2, 0), 0);
});

// ---- 本物の資料とくらべて足した特徴 ----
import { faceFeatures, flukeOutline, bodyPoint, WHALE_SPECS as SPECS2 } from '../src/logic/whaleShape.js';

test('ザトウクジラはがっしりした胴体(ほかのナガスクジラの仲間より太い)', () => {
  let best = 0;
  for (let u = 0; u <= 1; u += 0.01) {
    const s = bodySection('humpback', u);
    best = Math.max(best, s.halfWidth + s.halfHeight);
  }
  assert.ok(best > 0.22, `girth ${best}`);
});

test('ザトウクジラの頭は上が平ら(上半分のほうが角ばっている)', () => {
  const s = bodySection('humpback', 0.15);
  assert.ok(s.squarenessTop > s.squareness + 0.6, `${s.squarenessTop} vs ${s.squareness}`);
  assert.ok(bodySection('humpback', 0.6).squarenessTop < s.squarenessTop, 'body is rounder');
});

test('ザトウクジラのこぶは下あごにもあり、あごの先にひとつ大きなこぶがある', () => {
  const knobs = headKnobs('humpback');
  const jawSides = knobs.filter(k => Math.abs(Math.abs(k.theta) - 2.3) < 0.35);
  assert.ok(jawSides.length >= 8, `jaw ${jawSides.length}`);
  const chin = knobs.filter(k => k.u < 0.03 && Math.abs(Math.abs(k.theta) - Math.PI) < 0.1);
  assert.ok(chin.some(k => k.size >= 2), 'big chin knob');
});

test('口の線と目: 目は口の端のすぐ上・すぐうしろにある', () => {
  for (const kind of ['humpback', 'sperm']) {
    const f = faceFeatures(kind);
    const corner = f.mouth[f.mouth.length - 1];
    assert.ok(f.eye.u > corner.u && f.eye.u < corner.u + 0.05, `${kind} eye u ${f.eye.u} corner ${corner.u}`);
    assert.ok(Math.abs(f.eye.theta) < Math.abs(corner.theta), `${kind} eye is above the mouth corner`);
    // 目と口の線は、まわりより暗い
    // (ザトウクジラの目は別の部品で作るので、ここではマッコウクジラだけ。eyeShape.test.js)
    if (kind !== 'humpback') {
      const eye = lum(skinColor(kind, f.eye.u, f.eye.theta));
      const near = lum(skinColor(kind, f.eye.u, f.eye.theta - 0.3));
      assert.ok(eye < near * 0.8 + 0.01, `${kind} eye ${eye} near ${near}`);
    }
    const m = f.mouth[Math.floor(f.mouth.length / 2)];
    assert.ok(lum(skinColor(kind, m.u, m.theta)) < lum(skinColor(kind, m.u, m.theta + 0.25)), `${kind} mouth line`);
  }
});

test('マッコウクジラの鼻の穴はひとつで、頭の前の左寄りにある', () => {
  const b = faceFeatures('sperm').blowhole;
  assert.ok(b.u < 0.05, `u ${b.u}`);
  assert.ok(b.theta < 0 && b.theta > -1.0, `theta ${b.theta}`);   // 左(-x)寄りの上
  assert.ok(lum(skinColor('sperm', b.u, b.theta)) < lum(skinColor('sperm', b.u, b.theta + 0.4)));
});

test('ザトウクジラの鼻の穴は2つ並び、頭のこぶのうしろのてっぺんにあって、前にスプラッシュガードがある', () => {
  const b = faceFeatures('humpback').blowhole;
  assert.ok(b.pair);
  // 頭(体長の約3割)の中で、頭のこぶの列(まん中の列)より後ろ
  const lastKnob = Math.max(...headKnobs('humpback').filter(k => k.theta === 0).map(k => k.u));
  assert.ok(b.u > lastKnob && b.u < 0.3, `u ${b.u}`);
  // 左右に1つずつ: まん中(θ=0)は鼻の穴ではなく、少し横が鼻の穴
  let best = 0, bestTheta = 0;
  for (let th = 0; th < 0.3; th += 0.001) {
    const v = humpbackNares(b.u, th).slit;
    if (v > best) { best = v; bestTheta = th; }
  }
  assert.ok(best > 0.9, `slit ${best}`);
  assert.ok(humpbackNares(b.u, 0).slit < 0.2, 'まん中は仕切り');
  assert.ok(Math.abs(humpbackNares(b.u, -bestTheta).slit - best) < 1e-9, '左右対称');
  // 横の位置で左右のまん中どうしが 0.3〜0.5m(14m のクジラ)
  const L = WHALE_SPECS.humpback.lengthMeters;
  const x = bodyPoint('humpback', b.u, bestTheta)[0] * L;
  assert.ok(x > 0.15 && x < 0.25, `x ${x}`);
  // 前のほうが寄っている(V字)
  const front = b.u - NARES.length * 0.35, back = b.u + NARES.length * 0.35;
  const centerAt = u => { let bv = 0, bt = 0; for (let th = 0; th < 0.3; th += 0.0005) { const v = humpbackNares(u, th).slit; if (v > bv) { bv = v; bt = th; } } return bodyPoint('humpback', u, bt)[0]; };
  assert.ok(centerAt(front) < centerAt(back), 'V字');
  // 鼻の穴はへこんで暗く、スプラッシュガードは盛り上がる
  assert.ok(lum(skinColor('humpback', b.u, bestTheta)) < lum(skinColor('humpback', b.u, bestTheta + 0.1)));
  assert.ok(humpbackNares(NARES.guardU, 0).guard > 0.95);
  const rise = (bodyPoint('humpback', NARES.guardU, 0)[1] - (bodyPoint('humpback', NARES.guardU - 0.02, 0)[1] + bodyPoint('humpback', NARES.guardU + 0.02, 0)[1]) / 2) * L;
  assert.ok(humpbackNares(NARES.guardU - 0.03, 0).guard < 0.01 && humpbackNares(b.u + 0.03, 0).guard < 0.01);
  assert.ok(rise > 0.04 && rise < 0.15, `guard ${rise}`);
  // 体の横や下には出ない
  assert.equal(humpbackNares(b.u, Math.PI / 2).slit, 0);
});

test('尾びれ: ザトウクジラはうしろのふちに丸いこぶが並び、切れこみが深い', () => {
  // 先から先までのあいだで、うしろのふちのでっぱりを数える
  let peaks = 0;
  for (let a = 0.25; a < 0.9; a += 0.002) {
    const p = flukeOutline('humpback', a - 0.002).trailing, c = flukeOutline('humpback', a).trailing, n = flukeOutline('humpback', a + 0.002).trailing;
    if (c > p && c > n) peaks++;
  }
  assert.ok(peaks >= 6, `knobs ${peaks}`);
  assert.ok(SPECS2.humpback.fluke.notchDepth >= 0.025);
});

test('尾びれ: マッコウクジラの先は丸い', () => {
  const chord = (k, a) => flukeOutline(k, a).trailing - flukeOutline(k, a).leading;
  assert.ok(chord('sperm', 0.95) > 0.45 * chord('sperm', 0.8), 'sperm tips rounded');
});

test('ザトウクジラのあごの先や胸びれのまわりには、フジツボの白い点がある', () => {
  let spots = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const u = 0.005 + (i % 20) * 0.002, theta = Math.PI - 0.6 + (Math.floor(i / 20) / 20) * 1.2;
    const c = skinColor('humpback', u, theta);
    n++; if (lum(c) > 0.55 && c[2] < c[0] + 0.05) spots++;
  }
  assert.ok(spots / n > 0.05, `chin ${spots / n}`);
  // 背中にはほとんどない
  let back = 0;
  for (let i = 0; i < 200; i++) if (lum(skinColor('humpback', 0.4 + i * 0.001, (i % 10 - 5) * 0.05)) > 0.4) back++;
  assert.ok(back / 200 < 0.02, `back ${back / 200}`);
});

test('マッコウクジラ(大人のメス)の背中のこぶには白っぽいたこがある', () => {
  assert.ok(lum(skinColor('sperm', 0.66, 0)) > lum(skinColor('sperm', 0.55, 0)) + 0.08);
});

test('浮かんだときは、背中が決めた高さだけ海面から出る(体が太くても沈まない)', async () => {
  const { surfacedCenterY } = await import('../src/logic/whaleShape.js');
  for (const [kind, len] of [['humpback', 14], ['humpback', 5.6], ['sperm', 15]]) {
    const y = surfacedCenterY(kind, len, 0.8);
    let top = -Infinity;
    for (let u = 0; u <= 1; u += 0.005) {
      const s = bodySection(kind, u);
      top = Math.max(top, (s.centerY + s.halfHeight) * len);
    }
    assert.ok(Math.abs(y + top - 0.8) < 1e-6, `${kind} ${len}m: top ${y + top}`);
  }
});

test('胸びれの先の位置: 付け根から胸びれの長さだけ離れている', async () => {
  const { finTip, finGeometry: fg } = await import('../src/logic/whaleShape.js');
  for (const side of [1, -1]) {
    const t = finTip('humpback', side);
    assert.ok(Math.sign(t.tip[0]) === side, 'tip on its own side');
    const d = Math.hypot(t.tip[0] - t.root[0], t.tip[1] - t.root[1], t.tip[2] - t.root[2]);
    assert.ok(Math.abs(d - fg('humpback', side).length) < 1e-9);
  }
});

test('体のしなりの傾き: 曲がり具合(陰のつけ方に使う)が、しなりの形と合っている', async () => {
  const { swimBend, swimSlope } = await import('../src/logic/whaleShape.js');
  for (const s of [0.2, 0.5, 0.8, 0.95]) {
    for (const ph of [0, 1, 2.5, 4]) {
      const h = 1e-5;
      const numeric = (swimBend(s + h, ph, 1) - swimBend(s - h, ph, 1)) / (2 * h);
      assert.ok(Math.abs(numeric - swimSlope(s, ph, 1)) < 1e-6, `${s} ${ph}`);
    }
  }
});

test('泳ぐときの尾のふれと速さは、記録計の研究の数値に近い', async () => {
  const { SWIM: S, strokesPerSecond: f, swimBend: bend } = await import('../src/logic/whaleShape.js');
  // 尾の先の上下のふれ幅(山から谷まで): 体長の 1/8〜1/5(水面近くのゆっくり泳ぎは本気のときより少し小さめ)
  let hi = -1, lo = 1;
  for (let p = 0; p < Math.PI * 2; p += 0.01) { const y = bend(1, p, 1); hi = Math.max(hi, y); lo = Math.min(lo, y); }
  assert.ok(hi - lo > 1 / 8 && hi - lo <= 0.21, `${hi - lo}`);
  // 11mでおよそ0.25回/秒、大きいほどゆっくり
  assert.ok(Math.abs(f(11.09) - 0.25) < 0.02, `${f(11.09)}`);
  assert.ok(f(14) < f(11) && f(5) > f(14));
  assert.ok(S.amplitude > 0);
});

test('口を大きく開けても、上あごと下あごをつなぐ紐のような面はできない(口先も切れ目でわかれている)', async () => {
  const { buildWhaleGeometry, jawHinge, ENGULF } = await import('../src/logic/whaleShape.js');
  const { FEEDING } = await import('../src/logic/feeding.js');
  const g = buildWhaleGeometry('humpback');
  const [hy, hz] = jawHinge('humpback');
  // シェーダーと同じあごの動かし方(のどのふくらみとひげ板ののびは、ここでは見ない)
  const moved = i => {
    let x = g.positions[3 * i], y = g.positions[3 * i + 1], z = g.positions[3 * i + 2];
    const wl = g.jaw[4 * i], wu = g.jaw[4 * i + 1];
    x *= 1 + ENGULF.splay * FEEDING.lowerJaw * wl;
    const a = FEEDING.lowerJaw * wl - FEEDING.upperJaw * wu, c = Math.cos(a), s = Math.sin(a);
    return [x, hy + (y - hy) * c + (z - hz) * s, hz - (y - hy) * s + (z - hz) * c];
  };
  let longest = 0;
  for (let t = 0; t < g.indices.length; t += 3) {
    const v = [g.indices[t], g.indices[t + 1], g.indices[t + 2]].map(moved);
    for (let k = 0; k < 3; k++) longest = Math.max(longest, Math.hypot(...v[k].map((q, d) => q - v[(k + 1) % 3][d])));
  }
  // 直す前は、口先から下あごの先まで体長の3割ほどの面がのびていた。口の端の皮ののびは、体長の2%ほどまで
  assert.ok(longest < 0.03, `いちばん長くのびた辺 ${longest.toFixed(3)}`);
});
