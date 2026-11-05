import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterNormalPixels } from '../src/logic/waterNormals.js';

const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('RGBAの画素が並び、法線はすべて上向き(青が128以上)', () => {
  const size = 64;
  const px = waterNormalPixels(size, seeded(3));
  assert.equal(px.length, size * size * 4);
  for (let i = 0; i < px.length; i += 4) {
    assert.equal(px[i + 3], 255);
    assert.ok(px[i + 2] >= 128);
  }
});

test('端と端がつながる(タイルにしても継ぎ目が出ない)', () => {
  const size = 64;
  const px = waterNormalPixels(size, seeded(5));
  const at = (x, y) => (y * size + x) * 4;
  // 右端と左端の差が、隣り合う画素どうしの差の最大値を超えない
  let interior = 0, seam = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size - 1; x++) interior = Math.max(interior, Math.abs(px[at(x, y)] - px[at(x + 1, y)]));
    seam = Math.max(seam, Math.abs(px[at(size - 1, y)] - px[at(0, y)]));
  }
  assert.ok(seam <= interior);
});
