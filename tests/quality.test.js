import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPixelRatio, followFactor, QUALITY } from '../src/logic/quality.js';

test('なめらかに動いているときは、画面のきめ細かさを端末のいちばんまで上げていく', () => {
  let r = 1;
  for (let i = 0; i < 20; i++) r = nextPixelRatio(r, 60, 3);
  assert.equal(r, Math.min(3, QUALITY.maxRatio));
});

test('かくつくときは、きめ細かさを少しずつ下げる。ただし下げすぎない', () => {
  let r = 2;
  r = nextPixelRatio(r, 30, 2);
  assert.ok(r < 2);
  for (let i = 0; i < 20; i++) r = nextPixelRatio(r, 20, 2);
  assert.equal(r, QUALITY.minRatio);
});

test('ちょうどいい速さのときは変えない(行ったり来たりしない)', () => {
  assert.equal(nextPixelRatio(1.5, 52, 2), 1.5);
});

test('クジラの動きをなめらかにする追いかけ方: 時間がたつほど近づき、画面の速さが変わっても同じ動きになる', () => {
  // 1秒を、60コマで進めても30コマで進めても、追いつく量は同じ
  const after = (fps) => { let x = 0; for (let i = 0; i < fps; i++) x += (1 - x) * followFactor(1 / fps); return x; };
  assert.ok(Math.abs(after(60) - after(30)) < 1e-9);
  assert.ok(after(60) > 0.99, 'catches up within a second');
  assert.ok(followFactor(1 / 60) < 0.2, 'but not instantly (smooths sudden changes)');
  assert.equal(followFactor(0), 0);
});
