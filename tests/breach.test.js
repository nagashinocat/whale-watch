import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breachPose, BREACH, groupBreachPlan, calfBreachPlan, podPlan, POD } from '../src/logic/breach.js';
import { PATTERNS } from '../src/logic/patterns.js';

const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const peak = k => Math.max(...Array.from({ length: 200 }, (_, i) => breachPose(i * 0.05, k).y));

test('ジャンプの形は体の大きさに合わせる(子どもは小さく跳ぶ)', () => {
  assert.ok(peak(0.4) < peak(1) * 0.5);
  assert.ok(breachPose(-3, 1).y < -6, 'deep before the jump');
  assert.ok(breachPose(BREACH.air + 8, 1).y < -6, 'gone after the jump');
});

test('群れでジャンプ: 2〜3頭が、少しずつずれて並んで跳ぶ(ぶつからない間隔)', () => {
  for (let k = 1; k < 20; k++) {
    const g = groupBreachPlan(seeded(k));
    assert.ok(g.length >= 2 && g.length <= 3);
    const t = g.map(w => w.launch).sort((a, b) => a - b);
    assert.ok(t.at(-1) - t[0] <= 2 && t.every((x, i) => i === 0 || x - t[i - 1] >= 0.25));
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) assert.ok(Math.abs(g[i].side - g[j].side) >= 8);
    assert.ok(t.at(-1) + BREACH.air + 8 <= PATTERNS.groupBreach.durationMs / 1000);
  }
});

test('親子でジャンプ: 子どもが何度も練習して跳び、最後は母親といっしょに跳ぶ', () => {
  const p = calfBreachPlan();
  assert.ok(p.calf.length >= 3);
  for (let i = 1; i < p.calf.length; i++) assert.ok(p.calf[i] - p.calf[i - 1] >= BREACH.air + 3, 'calf needs time to dive again');
  assert.ok(Math.abs(p.calf.at(-1) - p.mother) <= 1, 'together at the end');
  assert.ok(p.mother + BREACH.air + 8 <= PATTERNS.calfBreach.durationMs / 1000);
});

test('群れで泳ぐ: 母親・子ども・付きそいのオスなど3〜5頭が、ずれて息をしながら、ゆっくり進む', () => {
  for (let k = 1; k < 20; k++) {
    const g = podPlan(seeded(k));
    assert.ok(g.length >= 3 && g.length <= 5);
    assert.ok(g.some(w => w.role === 'calf') && g.some(w => w.role === 'mother') && g.some(w => w.role === 'escort'));
    const calf = g.find(w => w.role === 'calf'), mom = g.find(w => w.role === 'mother'), esc = g.find(w => w.role === 'escort');
    assert.ok(Math.hypot(calf.offset[0] - mom.offset[0], calf.offset[1] - mom.offset[1]) < 7, 'calf stays close');
    assert.ok(esc.offset[1] > mom.offset[1], 'escort follows behind');
    const firsts = g.map(w => w.blows[0]).sort((a, b) => a - b);
    assert.ok(new Set(firsts.map(x => x.toFixed(1))).size === firsts.length, 'not all at once');
    // 1頭ずつ、尾びれを上げて潜っていく
    const dives = g.filter(w => w.role !== 'calf').map(w => w.dive).sort((a, b) => a - b);
    for (let i = 1; i < dives.length; i++) assert.ok(dives[i] - dives[i - 1] >= 2);
    assert.ok(Math.max(...g.map(w => w.dive)) + 12 <= PATTERNS.pod.durationMs / 1000);
  }
  assert.ok(POD.speed <= 1.5, 'slow');
});
