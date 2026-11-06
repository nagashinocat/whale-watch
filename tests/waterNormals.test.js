import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterNormalPixels, waveSet } from '../src/logic/waterNormals.js';

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

test('波は風の向き(横方向)にそろっている', () => {
  const size = 128;
  const px = waterNormalPixels(size, seeded(7));
  // R が横方向の傾き、G が縦方向の傾き。風に沿った波は横方向の傾きが大きい
  let sx = 0, sy = 0;
  for (let i = 0; i < px.length; i += 4) {
    sx += Math.abs(px[i] - 128);
    sy += Math.abs(px[i + 1] - 128);
  }
  assert.ok(sx > sy * 1.6, `x ${sx} y ${sy}`);
});

test('細かい波も含まれる(大きなうねりだけにならない)', () => {
  const size = 128;
  const px = waterNormalPixels(size, seeded(11));
  // 隣の画素との差の平均が、ある程度の大きさを持つ
  let diff = 0, n = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size - 1; x++) {
    diff += Math.abs(px[(y * size + x) * 4] - px[(y * size + x + 1) * 4]); n++;
  }
  assert.ok(diff / n > 6, `avg ${diff / n}`);
});

test('縦横にぴったりそろった波はない(格子模様に見えないように)', () => {
  const waves = waveSet(seeded(13));
  assert.ok(waves.length >= 40);
  for (const w of waves) {
    assert.notEqual(w.kx, 0);
    assert.notEqual(w.ky, 0);
  }
});
