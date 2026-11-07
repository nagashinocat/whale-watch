import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOUR_STEPS, tourSteps, loadTourDone, markTourDone } from '../src/logic/tour.js';

const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

test('はじめはまだ見ていない。見たら覚えておく(2回目からは出さない)', () => {
  const s = mem();
  assert.equal(loadTourDone(s), false);
  markTourDone(s);
  assert.equal(loadTourDone(s), true);
});

test('保存できない端末でも止まらない', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(loadTourDone(bad), false);
  assert.doesNotThrow(() => markTourDone(bad));
});

test('最初はあいさつ、最後は「使い方」ボタン。かくれているボタンのステップはとばす', () => {
  assert.equal(TOUR_STEPS[0].target, null);
  assert.equal(TOUR_STEPS.at(-1).target, 'help');
  assert.ok(TOUR_STEPS.every(s => s.text.ja && s.text.en));
  const steps = tourSteps(t => t !== 'dark');
  assert.equal(steps.length, TOUR_STEPS.length - 1);
  assert.ok(!steps.some(s => s.target === 'dark'));
});
