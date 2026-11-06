import { test } from 'node:test';
import assert from 'node:assert/strict';
import { underwaterTint, shadowLook, UNDERWATER } from '../src/logic/underwater.js';

test('水の中では赤い光から先に消え、5mより深いと赤はほとんど見えない', () => {
  const [r, g, b] = underwaterTint([1, 1, 1], 5);
  assert.ok(r < 0.15, `red ${r}`);
  assert.ok(b > 0.7 && b > g && g > r, `${r} ${g} ${b}`);
});

test('深いほど、青っぽく、うすく見える', () => {
  const a2 = underwaterTint([1, 1, 1], 2), a6 = underwaterTint([1, 1, 1], 6);
  assert.ok(a6[3] < a2[3], 'fainter');
  assert.ok(a6[2] / a6[0] > a2[2] / a2[0], 'bluer');
  assert.equal(underwaterTint([1, 1, 1], 0)[3], 1);
  assert.ok(underwaterTint([1, 1, 1], UNDERWATER.visibleDepth)[3] < 0.15, 'gone at visible depth');
});

test('水の中の姿は影のようにぼやける: 深いほどふちが広くぼやけ、濃さもうすい', () => {
  const s1 = shadowLook(1), s6 = shadowLook(6);
  assert.ok(s6.edge > s1.edge, 'blurrier edge deeper');
  assert.ok(s1.edge >= 0.3 && s6.edge <= 1, `${s1.edge} ${s6.edge}`);
  assert.ok(s1.maxAlpha <= 0.6, 'never a solid silhouette');
  assert.ok(s6.maxAlpha < s1.maxAlpha);
});

test('模様は消えて、明るい所と暗い所の差だけが少し残る', () => {
  assert.ok(shadowLook(1).contrast > shadowLook(6).contrast);
  assert.ok(shadowLook(1).contrast <= 0.5);
});

test('波で形がゆらぐ(数十cm)', () => {
  assert.ok(UNDERWATER.wobble > 0.1 && UNDERWATER.wobble < 0.6);
});
