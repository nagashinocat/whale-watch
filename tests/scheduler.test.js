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


test('タイマーのあいだは、自然にはクジラが出てこない。呼んだクジラは来る。終わったら、そこからまた30〜90分待つ', () => {
  const s = createScheduler({ now: 0, rng: () => 0.5 });
  s.setQuiet(true, 0);
  for (let t = 0; t < 5 * 3600e3; t += 1000) assert.equal(s.tick(t), null);
  // 呼ぶボタンは使える
  assert.ok(s.summon(5 * 3600e3));
  let ev = null;
  for (let t = 5 * 3600e3; !ev && t < 5 * 3600e3 + 60e3; t += 1000) ev = s.tick(t);
  assert.equal(ev.kind, 'summon');
  s.endEvent(5 * 3600e3 + 200e3);
  // タイマーが終わった
  const end = 6 * 3600e3;
  s.setQuiet(false, end);
  assert.equal(s.tick(end + 1000), null, '知らせのすぐあとには来ない');
  assert.ok(s.nextAt >= end + SCHEDULE.minIntervalMs && s.nextAt <= end + SCHEDULE.maxIntervalMs);
  assert.equal(s.tick(s.nextAt).kind, 'natural');
});

test('来る間隔は自分で選べる。選びなおすと、次に来るまでの時間もその間隔で決めなおす', async () => {
  const { INTERVALS } = await import('../src/logic/config.js');
  // ふつうは、これまでと同じ30〜90分
  assert.deepEqual([INTERVALS.normal.min, INTERVALS.normal.max], [SCHEDULE.minIntervalMs / 60000, SCHEDULE.maxIntervalMs / 60000]);
  for (const [name, r] of Object.entries(INTERVALS)) {
    const s = createScheduler({ now: 0, rng: seeded(7), frequency: name });
    assert.ok(s.nextAt >= r.min * 60000 && s.nextAt <= r.max * 60000, name);
    // 帰ったあとも同じ間隔
    s.tick(s.nextAt);
    s.endEvent(1e9);
    assert.ok(s.nextAt >= 1e9 + r.min * 60000 && s.nextAt <= 1e9 + r.max * 60000, name);
  }
  const s = createScheduler({ now: 0, rng: seeded(3), frequency: 'rare' });
  s.setFrequency('often', 1000);
  assert.ok(s.nextAt >= 1000 + 5 * 60000 && s.nextAt <= 1000 + 15 * 60000);
  // よく来るほど、間隔は短い
  assert.ok(INTERVALS.often.max <= INTERVALS.more.min * 1 + INTERVALS.more.max && INTERVALS.often.max < INTERVALS.normal.max && INTERVALS.normal.max < INTERVALS.rare.max);
});

test('待つ時間が長いほど、めずらしい出方が出やすくなる(よく来る=いつもどおり、長いほど ★★★ が最大5倍)', async () => {
  const { weightsForWait } = await import('../src/logic/scheduler.js');
  const { RARITY, RARE_BOOST } = await import('../src/logic/config.js');
  const w = SCHEDULE.weights;
  // どの出方にも、めずらしさ(1〜3)がついている
  for (const k of Object.keys(w)) assert.ok([1, 2, 3].includes(RARITY[k]), k);
  // 待ち時間が短いと(よく来るの平均ぐらいまで)いつもどおり
  assert.deepEqual(weightsForWait(w, 5), { ...w });
  assert.deepEqual(weightsForWait(w, RARE_BOOST.fromMin), { ...w });
  // 長く待つと、★★ と ★★★ が増える。★ は変わらない
  const long = weightsForWait(w, RARE_BOOST.toMin);
  for (const [k, v] of Object.entries(w)) {
    const times = long[k] / v;
    if (RARITY[k] === 1) assert.equal(times, 1, k);
    if (RARITY[k] === 2) assert.ok(Math.abs(times - RARE_BOOST.tier2) < 1e-9, k);
    if (RARITY[k] === 3) assert.ok(Math.abs(times - RARE_BOOST.tier3) < 1e-9, k);
  }
  // それより長く待っても、ふえすぎない
  assert.deepEqual(weightsForWait(w, 600), long);
  // 待つほど、めずらしい出方の割合が少しずつ上がる
  const share = m => { const x = weightsForWait(w, m); const all = Object.values(x).reduce((a, b) => a + b, 0); return Object.entries(x).filter(([k]) => RARITY[k] === 3).reduce((a, [, v]) => a + v, 0) / all; };
  assert.ok(share(10) < share(45) && share(45) < share(90) && share(90) < share(120));
});

test('「ときどき」にすると、「よく来る」よりめずらしい出方によく会える', () => {
  const rare = new Set(['groupBreach', 'groupSpyhop', 'feeding', 'bubbleNet', 'eyeContact', 'bubbleRing']);
  const count = frequency => {
    let seed = 7;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const s = createScheduler({ now: 0, rng, frequency });
    let t = 0, n = 0;
    for (let i = 0; i < 3000; i++) {
      t = s.nextAt;
      const ev = s.tick(t);
      if (rare.has(ev.pattern)) n++;
      s.endEvent(t);
    }
    return n;
  };
  assert.ok(count('rare') > count('often') * 2.5, `${count('rare')} / ${count('often')}`);
});
