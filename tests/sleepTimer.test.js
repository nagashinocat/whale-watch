import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLEEP_TIMER, fadeLevel, fadeStartAt, sleepPhase, sleepTimerFor } from '../src/logic/sleepTimer.js';

test('おやすみタイマー: 前半はそのまま、後半で少しずつ小さくなって、最後は止まる', () => {
  const t = sleepTimerFor(30, 0);
  assert.equal(fadeStartAt(t), 15 * 60000);
  assert.equal(fadeLevel(10 * 60000, t), 1);
  assert.equal(sleepPhase(10 * 60000, t), 'playing');
  assert.equal(sleepPhase(20 * 60000, t), 'fading');
  assert.equal(fadeLevel(30 * 60000, t), 0);
  assert.equal(sleepPhase(30 * 60000, t), 'done');
  // 小さくなっていくだけで、もどらない。急に下がらない(1分で10%より大きくは下がらない)
  let prev = 1;
  for (let m = 15; m <= 30; m += 0.5) {
    const v = fadeLevel(m * 60000, t);
    assert.ok(v <= prev + 1e-12 && prev - v < 0.1, `${m}分 ${v}`);
    prev = v;
  }
});

test('短いタイマーでも、5分はかけて小さくする', () => {
  const t = sleepTimerFor(SLEEP_TIMER.presets[0], 0);
  assert.equal(t.end - fadeStartAt(t), 7.5 * 60000);
  const tiny = sleepTimerFor(4, 0);
  assert.equal(fadeStartAt(tiny), 0, '5分より短いときは、はじめから小さくしていく');
  assert.equal(fadeLevel(0, null), 1);
  assert.equal(sleepPhase(0, null), 'idle');
});

test('はじめての案内は、海をタップする案内 → パネルの案内の順に、1回ずつ出る', async () => {
  const { loadHints, markHint, nextHint, HINT_TEXT } = await import('../src/logic/hints.js');
  const m = new Map(); const st = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  let done = loadHints(st);
  assert.equal(nextHint(done, false), 'tap');
  assert.equal(nextHint(done, true), 'panel');
  markHint(st, done, 'tap'); markHint(st, done, 'panel');
  done = loadHints(st);
  assert.equal(nextHint(done, false), null);
  assert.equal(nextHint(done, true), null);
  assert.ok(HINT_TEXT.tap() && HINT_TEXT.panel());
  assert.equal(loadHints({ getItem: () => '{bad' }).size, 0);
});
