import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, resolvePattern } from '../src/logic/patterns.js';
import { SCHEDULE } from '../src/logic/config.js';

test('すべての出方と summon が定義されている', () => {
  for (const k of [...Object.keys(SCHEDULE.weights), 'summon']) assert.ok(PATTERNS[k]?.durationMs > 0, k);
});

test('寝ているクジラはマッコウクジラ、鳴き声だけはモデル不要', () => {
  assert.equal(PATTERNS.sleeping.needs, 'sperm');
  assert.equal(PATTERNS.voice.needs, null);
});

test('モデルがなければ鳴き声だけに置き換える', () => {
  assert.equal(resolvePattern('breach', { humpback: null, sperm: {} }), 'voice');
  assert.equal(resolvePattern('sleeping', { humpback: {}, sperm: null }), 'voice');
  assert.equal(resolvePattern('breach', { humpback: {}, sperm: null }), 'breach');
});

test('呼んだクジラの歌は到着してから(最初から鳴らさない)', () => {
  assert.equal(PATTERNS.summon.sound, null);
  assert.ok(PATTERNS.summon.songAtMs >= 30000 && PATTERNS.summon.songAtMs < PATTERNS.summon.durationMs);
});

test('呼んだクジラはモデルがなくても歌だけは届く', () => {
  assert.equal(resolvePattern('summon', { humpback: null, sperm: null }), 'voice');
});
