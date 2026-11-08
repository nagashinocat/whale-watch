import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_WHALE, firstWhaleText, needsFirstWhale, markFirstWhaleDone, nextStage } from '../src/logic/firstWhale.js';
import { nextVisitor, individual, FLUKE_ID } from '../src/logic/flukeId.js';
import { BREACH } from '../src/logic/breach.js';

test('なじみの子(シロ)は、ほかのどの子よりもよく来る', () => {
  assert.equal(individual(FIRST_WHALE.id).name, 'シロ');
  assert.ok(!individual(FIRST_WHALE.id).special);
  let seed = 7; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const book of [{}, { 3: { count: 2 }, 11: { count: 1 }, 5: { count: 1 } }]) {
    const n = {};
    for (let i = 0; i < 6000; i++) { const id = nextVisitor(book, rng); n[id] = (n[id] ?? 0) + 1; }
    const guide = n[FLUKE_ID.guideId];
    for (const [id, c] of Object.entries(n)) if (Number(id) !== FLUKE_ID.guideId) assert.ok(guide > c * 1.5, `${id}: ${c} vs ${guide}`);
  }
});

test('ジャンプの前に「もうすぐ」を出す(飛び出すより前、来てすぐではない)', () => {
  assert.ok(FIRST_WHALE.readyAtMs > 1000 && FIRST_WHALE.readyAtMs < BREACH.approach * 1000);
});

test('はじめての人だけ: 図鑑にだれもいなくて、まだ見ていない', () => {
  const m = {}; const st = { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } };
  assert.equal(needsFirstWhale(st, {}), true);
  assert.equal(needsFirstWhale(st, { 3: { count: 1 } }), false);
  assert.equal(needsFirstWhale(st, { 3: { count: 0, photo: true } }), true);   // 写真だけ(会っていない)
  markFirstWhaleDone(st);
  assert.equal(needsFirstWhale(st, {}), false);
  assert.equal(needsFirstWhale({ getItem: () => { throw new Error('x'); } }, {}), true);
});

test('案内の進み方: 撮れたら点数 → 図鑑 → シロのページ → おしまい', () => {
  let s = 'arrive';
  s = nextStage(s, 'ready'); assert.equal(s, 'ready');
  s = nextStage(s, 'photo'); assert.equal(s, 'shot');
  s = nextStage(s, 'actEnd'); assert.equal(s, 'shot');   // 帰っても、点数の説明はそのまま
  s = nextStage(s, 'next'); assert.equal(s, 'book');
  s = nextStage(s, 'zukan'); assert.equal(s, 'page');
  s = nextStage(s, 'next'); assert.equal(s, 'done');
  assert.equal(nextStage('shot', 'zukan'), 'page');   // 先に自分で図鑑を開いてもよい
});

test('撮れなかったら、もう一度跳ぶ(3回まで)。それでもだめなら、また今度', () => {
  assert.equal(nextStage('ready', 'actEnd', { jumps: 1 }), 'again');
  assert.equal(nextStage('again', 'ready'), 'ready');
  assert.equal(nextStage('ready', 'actEnd', { jumps: FIRST_WHALE.maxJumps }), 'missed');
  assert.equal(nextStage('missed', 'next'), 'book');
});

test('案内の文に、クジラの名前と点数が入る', () => {
  assert.match(firstWhaleText('arrive', { name: 'シロ' }), /シロ/);
  assert.match(firstWhaleText('shot', { score: { total: 88, rank: 'A' } }), /88点・Aランク/);
  assert.match(firstWhaleText('shot', {}), /100点/);
  assert.match(firstWhaleText('page', { name: 'シロ' }), /タグ/);
});
