import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLEEP, sleepingGroup, headBob } from '../src/logic/sleep.js';
import { PATTERNS } from '../src/logic/patterns.js';

const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

test('マッコウクジラは5〜6頭の群れで、縦になって眠る', () => {
  for (let k = 1; k < 20; k++) {
    const g = sleepingGroup(seeded(k));
    assert.ok(g.length >= 5 && g.length <= 6);
    // 頭は水面すれすれ(少し出るか、少し沈むくらい)
    for (const w of g) assert.ok(w.top >= -0.5 && w.top <= 0.8, `${w.top}`);
    // 体がぶつからない間隔
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      assert.ok(Math.hypot(g[i].offset[0] - g[j].offset[0], g[i].offset[1] - g[j].offset[1]) >= 6);
    }
    // 群れは画面に入る広さ
    for (const w of g) assert.ok(Math.hypot(...w.offset) <= 10);
  }
});

test('見やすさ: はじめは水面に横になって潮を吹き、眠っているあいだも、ときどき頭が水面に出る', () => {
  const g = sleepingGroup(seeded(5));
  for (const w of g) {
    assert.ok(w.logBlows.length >= 1 && w.logBlows.every(b => b < SLEEP.logEnd));
    let hi = -Infinity;
    for (let t = SLEEP.sleepAt; t < w.wake; t += 0.2) hi = Math.max(hi, w.top + headBob(w, t));
    assert.ok(hi >= w.top + 0.3 && hi <= 1.4, `head ${hi}`);
  }
  assert.ok(SLEEP.slicks.every(t => t > SLEEP.sleepAt && t < g[0].wake));
});

test('眠っているあいだは音を出さない。目をさますと、ひとりずつ横になって息をし、カチカチ鳴きはじめる', () => {
  assert.equal(PATTERNS.sleeping.sound, null);
  const g = sleepingGroup(seeded(3));
  const D = PATTERNS.sleeping.durationMs / 1000;
  const wakes = g.map(w => w.wake).sort((a, b) => a - b);
  assert.ok(wakes[0] >= 0.6 * D, 'sleeps most of the time');
  assert.ok(wakes.at(-1) + SLEEP.wakeTurn + 8 <= D);
  assert.ok(new Set(wakes.map(w => w.toFixed(1))).size === wakes.length, 'one by one');
});
