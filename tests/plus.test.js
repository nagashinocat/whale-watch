import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLUS, PICKABLE, loadPlus, savePlus, intervalLocked, usableInterval, pickableWhales } from '../src/logic/plus.js';
import { createScheduler } from '../src/logic/scheduler.js';
import { INTERVALS } from '../src/logic/config.js';
import { PATTERNS, patternLabel } from '../src/logic/patterns.js';
import { population } from '../src/logic/flukeId.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('プラス: はじめは使えない。使えるようにしたら、保存して読みなおしても使える', () => {
  const st = memory();
  assert.equal(loadPlus(st).unlocked, false);
  savePlus(st, { unlocked: true });
  assert.equal(loadPlus(st).unlocked, true);
  st.setItem(PLUS.storageKey, '{こわれた');
  assert.equal(loadPlus(st).unlocked, false);
  assert.equal(loadPlus({ getItem() { throw new Error('x'); } }).unlocked, false);
});

test('「よく来る」だけがプラス。プラスでないときに保存されていたら「たくさん来る」にする', () => {
  assert.deepEqual(Object.keys(INTERVALS).filter(k => intervalLocked(k, false)), ['often']);
  assert.ok(Object.keys(INTERVALS).every(k => !intervalLocked(k, true)));
  assert.equal(usableInterval('often', false), 'more');
  assert.equal(usableInterval('often', true), 'often');
  assert.equal(usableInterval('normal', false), 'normal');
  assert.ok(INTERVALS[PLUS.fallbackInterval]);
});

test('えらんで呼ぶ: どの出かたも選べ、名前は日本語と英語の両方ある', () => {
  assert.equal(PICKABLE.length, Object.keys(PATTERNS).length - 1);
  assert.ok(!PICKABLE.includes('summon'));
  for (const n of PICKABLE) {
    assert.ok(patternLabel(n, 'ja') && patternLabel(n, 'en'), n);
    assert.notEqual(patternLabel(n, 'ja'), patternLabel(n, 'en'));
  }
});

test('えらんで呼ぶと、その出かたで3〜6秒後に来る。来ているあいだは、ほかに呼べない', () => {
  const s = createScheduler({ now: 0, rng: () => 0.5 });
  assert.equal(s.summon(1000, 'bigBreach', PLUS.pickDelayMs), true);
  assert.equal(s.summon(1100, 'breach', PLUS.pickDelayMs), false);
  assert.equal(s.tick(1000 + PLUS.pickDelayMs[0] - 1), null);
  assert.deepEqual(s.tick(1000 + PLUS.pickDelayMs[1]), { kind: 'pick', pattern: 'bigBreach' });
  s.endEvent(20000);
  // つぎのふつうの「呼ぶ」は、ふつうのクジラ
  s.summon(30000);
  assert.deepEqual(s.tick(70000), { kind: 'summon', pattern: 'summon' });
});

test('来てほしいクジラに選べるのは、図鑑にのっている子だけ', () => {
  const [a, b] = population();
  assert.deepEqual(pickableWhales({}), []);
  const list = pickableWhales({ [a.id]: { count: 2, first: 1, last: 2 }, [b.id]: { count: 0, first: 0, last: 0, photographed: true } });
  assert.deepEqual(list.map(w => w.id), [a.id]);
  assert.ok(list[0].name);
});
