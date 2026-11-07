import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIMER, afterMinutes, atClock, remainingText, clockText, timerState, loadTimer, saveTimer } from '../src/logic/timer.js';
import { countsForZukan } from '../src/logic/zukan.js';

const now = new Date(2026, 10, 7, 9, 58, 20).getTime();

test('「○分後」は、その分だけ先の時刻。1分〜24時間におさめる', () => {
  assert.equal(afterMinutes(10, now), now + 10 * 60000);
  assert.equal(afterMinutes(0, now), now + 60000);
  assert.equal(afterMinutes(99999, now), now + TIMER.maxMinutes * 60000);
});

test('「○時○分」は次に来るその時刻。過ぎていたら明日', () => {
  const t = new Date(atClock('10:30', now));
  assert.deepEqual([t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds()], [7, 10, 30, 0]);
  const tomorrow = new Date(atClock('07:00', now));
  assert.deepEqual([tomorrow.getDate(), tomorrow.getHours()], [8, 7]);
  assert.equal(new Date(atClock('9:58', now)).getDate(), 8, '同じ分でも、もう過ぎていたら明日');
  assert.equal(atClock('25:00', now), null);
  assert.equal(atClock('abc', now), null);
});

test('残り時間と時刻のことば', () => {
  assert.equal(remainingText(45 * 1000), 'あと45秒');
  assert.equal(remainingText(11 * 60000 + 1000), 'あと12分');
  assert.equal(remainingText(65 * 60000), 'あと1時間5分');
  assert.equal(remainingText(120 * 60000), 'あと2時間');
  assert.equal(clockText(new Date(2026, 0, 1, 7, 5).getTime()), '7:05');
});

test('時間になったら鳴らす。だいぶ過ぎてから気づいたときは、鳴らさずにお知らせだけ', () => {
  assert.equal(timerState(null, now), 'none');
  assert.equal(timerState(now + 1000, now), 'wait');
  assert.equal(timerState(now - 1000, now), 'ring');
  assert.equal(timerState(now - TIMER.lateLimitMs - 1, now), 'missed');
});

test('ページを開きなおしても、タイマーが続く(壊れた保存はタイマーなし)', () => {
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveTimer(storage, { at: now + 5000 });
  assert.deepEqual(loadTimer(storage), { at: now + 5000 });
  saveTimer(storage, null);
  assert.equal(loadTimer(storage), null);
  store.set(TIMER.storageKey, '{oops');
  assert.equal(loadTimer(storage), null);
});

test('タイマーで来たクジラは、図鑑に数えない', () => {
  assert.equal(countsForZukan({ kind: 'timer', pattern: 'spyhop' }), false);
});
