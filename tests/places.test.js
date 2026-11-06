import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS, seasonInfo, realSky } from '../src/logic/places.js';
import { pickPattern } from '../src/logic/scheduler.js';

const jst = (y, m, d, h, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 9, min));

test('場所は沖縄(慶良間)と小笠原(父島)', () => {
  assert.deepEqual(Object.keys(LOCATIONS).sort(), ['ogasawara', 'okinawa']);
  for (const p of Object.values(LOCATIONS)) assert.ok(/[ぁ-んァ-ン一-龥]/.test(p.label));
});

test('慶良間のザトウクジラは冬(12〜2月)と春(3〜5月)がシーズン', () => {
  for (const m of [12, 1, 2, 3, 4, 5]) assert.notEqual(seasonInfo('okinawa', jst(2026, m, 15, 12)).state, 'off', `month ${m}`);
  for (const m of [7, 8, 9]) assert.equal(seasonInfo('okinawa', jst(2026, m, 15, 12)).state, 'off', `month ${m}`);
});

test('小笠原のザトウクジラは11月下旬から来て、2〜4月がいちばん多い', () => {
  assert.equal(seasonInfo('ogasawara', jst(2026, 3, 10, 12)).state, 'peak');
  assert.equal(seasonInfo('ogasawara', jst(2026, 11, 25, 12)).state, 'season');
  assert.equal(seasonInfo('ogasawara', jst(2026, 11, 5, 12)).state, 'off');
});

test('シーズン外はクジラがずっとまれに出て、いちばん多い時期はよく出る', () => {
  const off = seasonInfo('okinawa', jst(2026, 8, 15, 12)).intervalScale;
  const on = seasonInfo('okinawa', jst(2026, 1, 15, 12)).intervalScale;
  const peak = seasonInfo('ogasawara', jst(2026, 3, 10, 12)).intervalScale;
  assert.ok(off > on * 2 && peak < on);
});

test('小笠原ではマッコウクジラ(メスと子ども)が一年中いるので、ザトウクジラのいない夏はマッコウクジラだけ出る', () => {
  const w = seasonInfo('ogasawara', jst(2026, 8, 15, 12)).weights;
  assert.deepEqual(Object.keys(w), ['sleeping']);
  // 出方が1種類しかなくても、選べる(同じ出方が続いてもよい)
  assert.equal(pickPattern('sleeping', Math.random, w), 'sleeping');
});

test('本物の空: 1月の慶良間の夕方は、夕日がほぼ正面(カメラは西南西を向いている)に沈む', () => {
  const s = realSky('okinawa', jst(2026, 1, 15, 18, 0));
  assert.equal(s.rising, false);
  assert.ok(Math.abs(s.hours - 18) < 0.5, `hours ${s.hours}`);
  assert.ok(Math.abs(s.sunAzimuth - 180) < 15, `scene azimuth ${s.sunAzimuth}`);
  assert.ok(s.moon.illumination >= 0 && s.moon.illumination <= 1);
});

test('本物の空: 真夜中は夜の色、昼は昼の色の時刻になる', () => {
  assert.ok(realSky('okinawa', jst(2026, 1, 15, 0)).hours < 3 || realSky('okinawa', jst(2026, 1, 15, 0)).hours > 21);
  const noon = realSky('okinawa', jst(2026, 1, 15, 12, 30)).hours;
  assert.ok(noon > 10 && noon < 14, `noon ${noon}`);
});

test('設定で選べる場所と、場所の一覧がそろっている', async () => {
  const { PLACES } = await import('../src/logic/config.js');
  assert.deepEqual([...PLACES].sort(), Object.keys(LOCATIONS).sort());
});
