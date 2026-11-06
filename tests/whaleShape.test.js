import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WHALE_SPECS, bodySection, skinColor, ventralGroove, headKnobs, buildWhaleGeometry, finGeometry, flukeGeometry,
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
  // ゆっくり泳ぐときの尾の上下は、体長の数%くらい
  assert.ok(tail > 0.02 && tail < 0.06, `tail ${tail}`);
  assert.equal(swimBend(1, 1.2, 0), 0);
});
