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

// ---- 画面全体のチカチカを防ぐ ----
import { createQualityControl, QUALITY_CONTROL } from '../src/logic/quality.js';

// fps のコマ数で seconds 秒すすめ、きめ細かさが変わった回数と最後の値
function run(ctrl, fps, seconds) {
  let changes = 0, ratio = ctrl.ratio;
  for (let t = 0; t < seconds; t += 1 / fps) {
    const next = ctrl.sample(1 / fps);
    if (next !== null) { changes++; ratio = next; }
  }
  return { changes, ratio };
}

test('起動してすぐ(重い準備のあいだ)は、かくついても画面のきめ細かさを変えない', () => {
  const c = createQualityControl(2);
  assert.equal(run(c, 20, QUALITY_CONTROL.warmup - 0.5).changes, 0);
});

test('上げ下げを行ったり来たりしない: 一度かくついた細かさには、もう上げない', () => {
  const c = createQualityControl(2);
  run(c, 60, QUALITY_CONTROL.warmup + 1);
  const start = c.ratio;
  // 速いときと遅いときが交互に来ても、何度も切りかえない
  let changes = 0;
  for (let k = 0; k < 20; k++) {
    changes += run(c, 30, 4).changes;
    changes += run(c, 60, 12).changes;
  }
  assert.ok(changes <= 4, `changes ${changes}`);
  assert.ok(c.ratio < start || start === QUALITY.minRatio);
});

test('切りかえたあとは、しばらく次の切りかえをしない', () => {
  const c = createQualityControl(2, 1);
  run(c, 60, QUALITY_CONTROL.warmup + 0.1);
  let last = -Infinity, t = 0, minGap = Infinity;
  for (; t < 120; t += 1 / 60) {
    if (c.sample(1 / 60) !== null) { minGap = Math.min(minGap, t - last); last = t; }
  }
  assert.ok(minGap >= QUALITY_CONTROL.cooldown, `${minGap}`);
});

test('タブを裏にしていたときの長い止まりは、かくつきに数えない', () => {
  const c = createQualityControl(2);
  run(c, 60, QUALITY_CONTROL.warmup + 3);
  const r = c.ratio;
  for (let k = 0; k < 10; k++) c.sample(2.5);
  assert.equal(c.ratio, r);
});
