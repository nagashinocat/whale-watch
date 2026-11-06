import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, resolvePattern, voiceSound } from '../src/logic/patterns.js';
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

test('鳴き声だけのときは、長い歌と短い一声をまぜて選ぶ', () => {
  let s = 3; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const both = { humpback: true, 'humpback-call': true };
  const picks = Array.from({ length: 1000 }, () => voiceSound(rng, both));
  const calls = picks.filter(p => p === 'humpback-call').length;
  assert.ok(calls > 250 && calls < 550, `calls ${calls}`);
  assert.ok(picks.every(p => p === 'humpback' || p === 'humpback-call'));
});

test('片方の音しかなければ、ある方を使う', () => {
  const rng = () => 0.99;
  assert.equal(voiceSound(rng, { humpback: true, 'humpback-call': false }), 'humpback');
  assert.equal(voiceSound(() => 0, { humpback: false, 'humpback-call': true }), 'humpback-call');
});
