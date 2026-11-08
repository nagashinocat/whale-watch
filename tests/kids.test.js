import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KIDS, KIDS_PATTERNS, pickKidsPattern, kidsPosition, whalesToRemove, loadKids, saveKids } from '../src/logic/kids.js';
import { PATTERNS } from '../src/logic/patterns.js';
import { CAMERA_PRESETS } from '../src/scene/cameras.js';
import { isVisibleFrom } from '../src/logic/view.js';

const memory = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('子供用モードで一度に海にいられるクジラは6頭まで', () => {
  assert.equal(KIDS.maxWhales, 6);
});

test('子供用モードで出るのは、姿が見える出方だけ(鳴き声だけ・呼んだクジラ・寝ているクジラ・目が合う は出ない)', () => {
  assert.ok(KIDS_PATTERNS.length >= 10);
  for (const n of KIDS_PATTERNS) assert.ok(PATTERNS[n].needs, `${n} は姿が見えない`);
  for (const n of ['voice', 'summon', 'sleeping', 'eyeContact']) assert.ok(!KIDS_PATTERNS.includes(n), `${n} が入っている`);
  assert.ok(KIDS_PATTERNS.includes('bigBreach') && KIDS_PATTERNS.includes('spout'));
});

test('出方はランダムで、さっき出た2つは続けて出さない', () => {
  const seq = [0.99, 0.0, 0.5, 0.25, 0.75];
  let i = 0;
  const rng = () => seq[i++ % seq.length];
  const recent = [];
  for (let k = 0; k < 30; k++) {
    const p = pickKidsPattern(rng, recent);
    assert.ok(KIDS_PATTERNS.includes(p));
    assert.ok(!recent.slice(-2).includes(p), `${p} が続けて出た`);
    recent.push(p);
  }
  // いろいろな出方が出る
  const many = new Set();
  for (let k = 0; k < 400; k++) many.add(pickKidsPattern(Math.random, []));
  assert.equal(many.size, KIDS_PATTERNS.length);
});

test('呼ぶたびに出る場所をずらし、どの場所も3つのカメラから見える', () => {
  const spots = Array.from({ length: KIDS.maxWhales }, (_, i) => kidsPosition(i));
  assert.equal(new Set(spots.map(p => p.join(','))).size, KIDS.maxWhales, '場所が重なっている');
  // 7回目は1回目と同じ場所にもどる(そのころには1回目のクジラは潜っていなくなる)
  assert.deepEqual(kidsPosition(KIDS.maxWhales), kidsPosition(0));
  for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
    for (const p of spots) assert.ok(isVisibleFrom(preset, p), `${name} から ${p} が見えない`);
  }
});

test('6頭をこえるときは、こえる分だけ古いクジラに潜ってもらう', () => {
  assert.equal(whalesToRemove(0, 1), 0);
  assert.equal(whalesToRemove(5, 1), 0);
  assert.equal(whalesToRemove(6, 1), 1);
  assert.equal(whalesToRemove(4, 3), 1);   // 群れ(3頭)を呼んだとき
  assert.equal(whalesToRemove(6, 9), 6);   // 6頭より多い群れでも、ほかのクジラを全部どかせば足りる
});

test('子供用モードかどうかを覚えておく(読めないときは、ふつうのモード)', () => {
  const s = memory();
  assert.equal(loadKids(s).on, false);
  saveKids(s, { on: true });
  assert.equal(loadKids(s).on, true);
  s.setItem(KIDS.storageKey, '{こわれた');
  assert.equal(loadKids(s).on, false);
  assert.equal(loadKids({ getItem() { throw new Error('x'); } }).on, false);
});

test('大人がもどすときは、長押し(2秒)', () => {
  assert.equal(KIDS.exitHoldMs, 2000);
});
