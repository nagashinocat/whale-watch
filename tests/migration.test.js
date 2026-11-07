import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIGRATION, TIME_SCALE, ROUTES, routeFor, pointAt, whereNow, tagOnSighting, tripSummary, cleanMigration, ROUTE_HOME, progress } from '../src/logic/migration.js';
import { onLand, distanceKm, LAND, ISLETS, MAP_BOUNDS } from '../src/logic/northPacific.js';
import { recordSighting, loadBook, saveBook } from '../src/logic/flukeId.js';
import { mergeBooks } from '../src/logic/backup.js';

const H = 3600000;
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('地図: 陸地と島は地図の中。沖縄の海・北海道の沖・カムチャツカの沖は海、本州・北海道・カムチャツカは陸', () => {
  for (const poly of Object.values(LAND)) for (const [x, y] of poly) assert.ok(x >= MAP_BOUNDS.west && x <= MAP_BOUNDS.east && y >= MAP_BOUNDS.south && y <= MAP_BOUNDS.north);
  assert.ok(ISLETS.length > 20);
  for (const p of [ROUTE_HOME, [144.6, 42.4], [163.8, 54], [150, 40]]) assert.equal(onLand(p), false, `${p}`);
  for (const p of [[139, 36], [142.5, 43.5], [159, 56], [127.9, 26.5], [121, 24]]) assert.equal(onLand(p), true, `${p}`);
  assert.ok(Math.abs(distanceKm([127.5, 26.5], [144.6, 42.4]) - 2300) < 200, '沖縄から釧路まで約2,300km');
});

test('回遊ルートは、どの子も沖縄を出て北の餌場まで行き、沖縄へもどる。陸の上は通らない', () => {
  const kinds = new Set();
  for (let seed = 1; seed < 300; seed++) {
    const r = routeFor(seed * 7919);
    kinds.add(r.kind);
    assert.deepEqual(r.line[0], ROUTE_HOME); assert.deepEqual(r.line.at(-1), ROUTE_HOME);
    for (let k = 0; k <= 1; k += 0.002) assert.equal(onLand(pointAt(r, k)), false, `seed ${seed} k ${k.toFixed(3)} ${pointAt(r, k)}`);
    // 北の海(北緯50度より北)まで行く。長さは本物の回遊くらい(片道4,000km前後、1周で9,000〜14,000km)
    assert.ok(Math.max(...r.line.map(p => p[1])) > 52, `seed ${seed}`);
    assert.ok(r.length > 8000 && r.length < 15000, `${r.length}`);
  }
  assert.deepEqual([...kinds].sort(), Object.keys(ROUTES).sort(), 'ルートの種類はどれも出る');
});

test('調べた数値: 南へ下るとき北海道の釧路沖を通るルートがある', () => {
  const ok = Object.values(ROUTES).some(r => r.path.indexOf('KUSHIRO', r.path.indexOf('*')) > 0);
  assert.ok(ok);
});

test('時間: 本物は1年で1周。このアプリでは早回しで、3日で1周(およそ120倍)', () => {
  assert.equal(MIGRATION.loopHours, 72);
  assert.ok(Math.abs(TIME_SCALE - 121.67) < 0.1);
  const tag = { at: 0, seed: 123 };
  assert.equal(whereNow(tag, 0).stage, 'leaving');
  // 1日たつと北へ、2日目に餌場、3日目に南へ下る
  assert.equal(whereNow(tag, 20 * H).stage, 'north');
  assert.equal(whereNow(tag, 36 * H).stage, 'feeding');
  assert.equal(whereNow(tag, 55 * H).stage, 'south');
  assert.ok(whereNow(tag, 36 * H).fromHomeKm > 2500, '餌場は遠い');
  assert.ok(whereNow(tag, 0.2 * H).fromHomeKm < 300);
  assert.equal(whereNow(tag, 72 * H + 1).laps, 1);
  assert.ok(whereNow(tag, 36 * H).region.ja.length > 0);
  // 進み方の速さ(クジラの時間で1日あたり)は、本物(100km前後)と同じくらい
  const r = routeFor(123);
  const perDay = r.length / 365;
  assert.ok(perDay > 20 && perDay < 45, `平均 ${perDay.toFixed(0)}km/日(餌場で寄り道する時間もふくむ)`);
  assert.ok(progress(tag, 36 * H) === 0.5);
});

test('はじめて会ったときにタグを付け、また会ったら、そのあいだの旅が記録される', () => {
  let r = recordSighting({}, 5, 1000);
  const e1 = r.book[5];
  assert.ok(e1.tag && e1.tag.at === 1000 && !e1.trips);
  r = recordSighting(r.book, 5, 1000 + 30 * H);
  const e2 = r.book[5];
  assert.equal(e2.trips.length, 1);
  assert.deepEqual(e2.trips[0], { from: 1000, to: 1000 + 30 * H, seed: e1.tag.seed });
  assert.equal(e2.tag.at, 1000 + 30 * H, '会ったところから、新しい旅が始まる');
  assert.notEqual(e2.tag.seed, e1.tag.seed);
  // 旅のようす: とちゅうで会ったら、そこから沖縄へもどってくる
  const s = tripSummary(e2.trips[0]);
  assert.ok(s.km > 3000 && s.farKm > 1500, JSON.stringify({ km: s.km, far: s.farKm }));
  assert.deepEqual(s.back.at(-1), ROUTE_HOME, '道すじの残りをたどって、あなたの海へもどる');
  for (const p of s.back) assert.equal(onLand(p), false);
  assert.ok(Math.abs(s.whaleDays - (30 / 24) * TIME_SCALE) < 0.01);
  // 1周より長く会わなかったら、ルート全体を回ってきた
  const long = tripSummary({ from: 0, to: 80 * H, seed: 9 });
  assert.equal(long.laps, 1); assert.deepEqual(long.back, []);
  // 旅の記録は5つまで
  let b = r.book;
  for (let k = 0; k < 8; k++) b = recordSighting(b, 5, 2000 + (k + 2) * 40 * H).book;
  assert.equal(b[5].trips.length, MIGRATION.maxTrips);
});

test('タグと旅の記録は保存して読みなおせる。こわれた記録は捨てる。バックアップを合わせても残る', () => {
  let book = recordSighting({}, 3, 1000).book;
  book = recordSighting(book, 3, 1000 + 10 * H).book;
  const st = mem();
  saveBook(st, book);
  assert.deepEqual(loadBook(st)[3].trips, book[3].trips);
  assert.deepEqual(loadBook(st)[3].tag, book[3].tag);
  assert.deepEqual(cleanMigration({ tag: { at: 'x' }, trips: [{ from: 5, to: 1, seed: 1 }, null] }), {});
  const older = recordSighting({}, 3, 500).book;
  const merged = mergeBooks(book, older);
  assert.deepEqual(merged[3].tag, book[3].tag, 'あとで会ったほうのタグ');
  assert.equal(merged[3].trips.length, 1);
});
