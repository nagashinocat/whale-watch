import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BREATH, diveSurfacing, calfBreaths } from '../src/logic/breathing.js';
import { PATTERNS } from '../src/logic/patterns.js';

const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

test('深く潜る前に、何回か続けて潮を吹く(本物は6〜7回。アプリでは3〜6回に縮める)', () => {
  for (let k = 1; k < 30; k++) {
    const s = diveSurfacing(seeded(k));
    assert.ok(s.blows.length >= 3 && s.blows.length <= 6, `${s.blows.length}`);
    for (let i = 1; i < s.blows.length; i++) {
      const d = s.blows[i] - s.blows[i - 1];
      assert.ok(d >= BREATH.interval[0] && d <= BREATH.interval[1], `interval ${d}`);
    }
    // 最後の潮吹きのあとで背中を丸め、尾びれを上げて潜る。出方の時間内に終わる
    assert.ok(s.round > s.blows.at(-1) && s.dive > s.round);
    assert.ok(s.dive + 12 <= PATTERNS.fluke.durationMs / 1000, `dive ${s.dive}`);
  }
});

test('子クジラは母親より短い間隔で、何度も息をする', () => {
  const { calf, mother } = calfBreaths();
  assert.ok(calf.length >= 2 * mother.length, `${calf.length} vs ${mother.length}`);
  const gap = a => (a.at(-1) - a[0]) / Math.max(1, a.length - 1);
  assert.ok(gap(calf) < gap(mother) || mother.length === 1);
  for (const t of [...calf, ...mother]) assert.ok(t > 0 && t < PATTERNS.motherCalf.durationMs / 1000 - 6);
});

test('子クジラの潮吹きは小さく、息の音も小さい', () => {
  assert.ok(BREATH.calfScale < 0.6);
  assert.ok(BREATH.gain.calf < BREATH.gain.adult);
});
