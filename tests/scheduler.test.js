import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler, pickPattern } from '../src/logic/scheduler.js';
import { SCHEDULE } from '../src/logic/config.js';

const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const MIN = 60000;

test('次の出現は30〜90分後', () => {
  const rng = seeded(7);
  for (let i = 0; i < 500; i++) {
    const s = createScheduler({ now: 0, rng });
    assert.ok(s.nextAt >= 30 * MIN && s.nextAt <= 90 * MIN);
  }
});

test('出方の割合がおおむね重みどおり(直前と同じは出ない)', () => {
  const rng = seeded(3); const count = {}; let prev = null;
  for (let i = 0; i < 20000; i++) {
    const p = pickPattern(prev, rng);
    assert.notEqual(p, prev);
    count[p] = (count[p] ?? 0) + 1;
    prev = p;
  }
  // 設定の重みから計算した割合と、6ポイント以内で合う(直前と同じは出ないぶん、少しずれる)
  const total = Object.values(SCHEDULE.weights).reduce((x, y) => x + y, 0);
  for (const [k, w] of Object.entries(SCHEDULE.weights)) {
    const pct = (count[k] ?? 0) / 200, want = (w / total) * 100;
    assert.ok(Math.abs(pct - want) < 6, `${k} ${pct.toFixed(1)}% want ${want.toFixed(1)}%`);
  }
});

test('時刻前はnull、時刻を過ぎたら1件だけ', () => {
  const s = createScheduler({ now: 0, rng: seeded(5) });
  assert.equal(s.tick(s.nextAt - 1), null);
  const e = s.tick(s.nextAt);
  assert.equal(e.kind, 'natural');
  assert.equal(s.tick(s.nextAt + 1), null);
});

test('何時間も止まっていても一度に出るのは1件', () => {
  const s = createScheduler({ now: 0, rng: seeded(9) });
  assert.ok(s.tick(10 * 60 * MIN));
  assert.equal(s.tick(10 * 60 * MIN + 1000), null);
  s.endEvent(10 * 60 * MIN + 5000);
  assert.ok(s.nextAt >= 10 * 60 * MIN + 5000 + 30 * MIN);
});

test('呼ぶと10〜30秒後に来て、来ている間は二重に呼べない', () => {
  const s = createScheduler({ now: 0, rng: seeded(11) });
  assert.equal(s.summon(1000), true);
  assert.equal(s.summon(2000), false);
  assert.equal(s.tick(1000 + 9999), null);
  const e = s.tick(1000 + 30000);
  assert.deepEqual(e, { kind: 'summon', pattern: 'summon' });
  assert.equal(s.isSummoning(), true);
});

test('呼んだクジラが帰ったら自然出現タイマーは残り時間から再開', () => {
  const s = createScheduler({ now: 0, rng: seeded(13) });
  const remaining = s.nextAt - 1000;
  s.summon(1000); s.tick(31000); s.endEvent(100000);
  assert.equal(s.isSummoning(), false);
  assert.equal(s.nextAt, 100000 + (remaining - 30000));
});

test('自然のクジラが出ている最中に呼ぶと、帰ってから来る', () => {
  const s = createScheduler({ now: 0, rng: seeded(17) });
  const t = s.nextAt; s.tick(t);
  assert.equal(s.summon(t + 1000), true);
  assert.equal(s.tick(t + 60000), null);
  s.endEvent(t + 70000);
  assert.deepEqual(s.tick(t + 70001), { kind: 'summon', pattern: 'summon' });
});

test('intervalScaleで間隔を縮められる', () => {
  const s = createScheduler({ now: 0, rng: seeded(19), intervalScale: 1 / 30 });
  assert.ok(s.nextAt >= MIN && s.nextAt <= 3 * MIN);
});

test('シーズンに合わせて、出やすさと出方を変えられる', () => {
  const s = createScheduler({ now: 0, rng: seeded(23) });
  s.setSeason({ intervalScale: 4, weights: { sleeping: 1 } });
  const e = s.tick(s.nextAt);
  assert.equal(e.pattern, 'sleeping');
  s.endEvent(1000);
  // 次は4倍まれ(30〜90分の4倍)
  assert.ok(s.nextAt - 1000 >= 4 * 30 * MIN && s.nextAt - 1000 <= 4 * 90 * MIN);
});
