import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foamPixels } from '../src/logic/foam.js';

const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('白波の模様は端と端がつながる', () => {
  const size = 64;
  const px = foamPixels(size, seeded(3));
  assert.equal(px.length, size * size * 4);
  const at = (x, y) => px[(y * size + x) * 4];
  let interior = 0, seam = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size - 1; x++) interior = Math.max(interior, Math.abs(at(x, y) - at(x + 1, y)));
    seam = Math.max(seam, Math.abs(at(size - 1, y) - at(0, y)));
  }
  assert.ok(seam <= interior);
});

test('白波はところどころにだけ立つ(海全体が白くならない)', () => {
  const size = 128;
  const px = foamPixels(size, seeded(5));
  let high = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] > 200) high++;
  const ratio = high / (size * size);
  assert.ok(ratio > 0.01 && ratio < 0.15, `ratio ${ratio}`);
});

test('白波は波の頭に沿って横長(縦方向に変化が大きい)', () => {
  const size = 128;
  const px = foamPixels(size, seeded(9));
  const at = (x, y) => px[(y * size + x) * 4];
  let dx = 0, dy = 0;
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    dx += Math.abs(at(x, y) - at(x + 1, y));
    dy += Math.abs(at(x, y) - at(x, y + 1));
  }
  assert.ok(dy > dx * 1.3, `dx ${dx} dy ${dy}`);
});
