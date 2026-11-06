import { test } from 'node:test';
import assert from 'node:assert/strict';
import { population } from '../src/logic/flukeId.js';
import { lengthOf, weightOf, commentFor, zukanInfo, ZUKAN_LEVELS } from '../src/logic/zukan.js';

test('全長はおとなのザトウクジラの大きさ(12〜16m)。大きい子は長く、小さめの子は短い', () => {
  for (const i of population()) {
    const L = lengthOf(i);
    assert.ok(L >= 12 && L <= 16.2, `${i.name} ${L}`);
  }
  const big = population().find(i => i.traits.size === 'big'), small = population().find(i => i.traits.size === 'small');
  assert.ok(lengthOf(big) > lengthOf(small) + 2);
});

test('体重は長さから(15mで約35トン、長さの3乗に比例)', () => {
  const i = population()[0];
  const w = weightOf(i), L = lengthOf(i);
  assert.ok(Math.abs(w - 35 * (L / 15) ** 3) <= 0.5);
  for (const j of population()) assert.ok(weightOf(j) >= 17 && weightOf(j) <= 45);
});

test('特徴のコメントは日本語の文で、尾びれの裏の白さと、目立つ個性が入る', () => {
  for (const i of population()) {
    const c = commentFor(i);
    assert.ok(c.includes('尾びれの裏') && c.endsWith('。'), c);
  }
  const white = population().find(i => i.traits.coat === 'white');
  assert.ok(commentFor(white).includes('真っ白'));
});

test('会えた回数で、図鑑の情報が少しずつわかっていく', () => {
  const ind = population()[2];
  const one = zukanInfo(ind, { count: 1 });
  assert.equal(one.open.fluke, true);
  assert.equal(one.open.portrait, false);
  assert.equal(one.open.weight, false);
  assert.equal(one.next.count, ZUKAN_LEVELS[1].at);
  const two = zukanInfo(ind, { count: 2 });
  assert.equal(two.open.portrait, true); assert.equal(two.open.length, true); assert.equal(two.open.weight, false);
  const all = zukanInfo(ind, { count: 9 });
  assert.ok(Object.values(all.open).every(Boolean));
  assert.equal(all.next, null);
  assert.ok(/[ぁ-んァ-ン一-龥]/.test(one.next.text));
});

test('お知らせ: 1頭のとき、何頭もいっしょに来たとき(1つにまとめる)', async () => {
  const { sightingMessage } = await import('../src/logic/zukan.js');
  assert.equal(sightingMessage([{ name: 'ユキ', first: false, count: 3 }]), '「ユキ」がまた来ました(3回目)');
  assert.ok(sightingMessage([{ name: 'ポチ', first: true, count: 1 }]).includes('はじめて見るクジラ'));
  const m = sightingMessage([{ name: 'A', first: true, count: 1 }, { name: 'B', first: true, count: 1 }, { name: 'ユキ', first: false, count: 4 }]);
  assert.ok(m.includes('はじめて見るクジラが2頭') && m.includes('「A」「B」') && m.includes('「ユキ」がまた来ました'), m);
  assert.equal(sightingMessage([]), '');
});
