import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH, researchRound, loadResearch, saveResearch, answerResearch, rankOf } from '../src/logic/research.js';
import { WHISPER, HYDROPHONE, whisperBout, nextWhisperSec } from '../src/logic/whisper.js';
import { population } from '../src/logic/flukeId.js';

const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('研究者ごっこ: 図鑑に3頭以上いると、3つの中から正解をえらぶ問題ができる', () => {
  const all = population().filter(i => !i.special);
  assert.equal(researchRound(all.slice(0, 2), seeded(1)), null);
  const rng = seeded(7);
  const seen = new Set();
  for (let k = 0; k < 200; k++) {
    const r = researchRound(all.slice(0, 8), rng);
    assert.equal(r.choices.length, RESEARCH.choices);
    assert.equal(new Set(r.choices).size, RESEARCH.choices);
    assert.ok(r.choices.includes(r.answer));
    seen.add(r.choices.indexOf(r.answer));
    assert.ok(Math.abs(r.photo.rot) <= 0.2 && r.photo.zoom >= 1 && r.photo.dark < 0.5);
  }
  assert.equal(seen.size, 3, '正解の場所はばらばら');
});

test('研究者ごっこ: 当てた数で肩書きが上がる。記録は保存できる', () => {
  let s = loadResearch(mem());
  s = answerResearch(s, true); s = answerResearch(s, true); s = answerResearch(s, false); s = answerResearch(s, true);
  assert.deepEqual(s, { played: 4, correct: 3, streak: 1, best: 2 });
  assert.equal(rankOf(0).rank.ja, '見習い研究員');
  assert.equal(rankOf(4).next.more, 1);
  assert.equal(rankOf(30).rank.ja, 'クジラ博士');
  assert.equal(rankOf(99).next, null);
  const st = mem(); saveResearch(st, s); assert.deepEqual(loadResearch(st), s);
  assert.deepEqual(loadResearch({ getItem: () => '{bad' }), { played: 0, correct: 0, streak: 0, best: 0 });
});

test('ささやき: 数秒のあいだに、短くて低い、小さな声がいくつか', () => {
  const rng = seeded(3);
  for (let k = 0; k < 50; k++) {
    const b = whisperBout(rng);
    assert.ok(b.length >= WHISPER.calls[0] && b.length <= WHISPER.calls[1]);
    for (const c of b) {
      assert.ok(c.duration >= 0.25 && c.duration <= 0.6 && c.rate < 1);
      assert.ok(c.offset >= 0 && c.offset + c.duration <= WHISPER.sourceSec);
      assert.ok(c.at >= 0 && c.at <= WHISPER.spanSec[1]);
    }
    const t = nextWhisperSec(rng);
    assert.ok(t >= 90 && t <= 240);
  }
  assert.ok(WHISPER.level < 0.3, 'とても小さい');
  assert.ok(HYDROPHONE.waveLowpassHz < 600 && HYDROPHONE.whaleBoost > 1, '水中マイク: 波はこもり、クジラは近い');
});
