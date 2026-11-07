import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONG, seasonKey, songVersion, songPlan, loadSongs, recordSong } from '../src/logic/songs.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const months = (from, n) => Array.from({ length: n }, (_, i) => { const d = new Date(from[0], from[1] - 1 + i, 1); return seasonKey(d); });

test('歌は月ごとに少しずつ変わる(テーマが入れかわる・ふえる・へる)', () => {
  const list = months([2026, 1], 6).map(songVersion);
  assert.deepEqual(list[0].order, [0, 1, 2, 3, 4, 5]);
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1].order, b = list[i].order;
    // 1か月で変わるのは少しだけ(長さの差は1まで、同じテーマが多く残る)
    assert.ok(Math.abs(a.length - b.length) <= 1);
    const same = b.filter(t => a.includes(t)).length;
    assert.ok(same >= b.length - 1, `${a} → ${b}`);
  }
  assert.ok(new Set(list.map(v => v.order.join(''))).size >= 4, 'ほとんどの月で、どこか変わる');
});

test('毎年7月に、まったく新しい歌に入れかわる(歌の革命)。テーマの名前も新しくなる', () => {
  const june = songVersion('2026-06'), july = songVersion('2026-07');
  assert.equal(july.changed, 'revolution');
  assert.equal(july.generation, june.generation + 1);
  assert.notEqual(july.letters.join(''), june.letters.join(''));
  assert.ok(!july.letters.some(l => june.letters.includes(l)), 'テーマの名前の組が変わる');
  assert.equal(songVersion('2027-07').generation, 2);
});

test('歌の高さは、年をへるごとに少しずつ低くなる', () => {
  const a = songVersion('2026-03'), b = songVersion('2029-03');
  assert.equal(a.generation % 3, b.generation % 3, '同じくらべ方');
  assert.ok(b.rate < a.rate);
  assert.ok(a.rate > 0.9 && a.rate < 1.1);
});

test('再生の予定: テーマごとに、録音の決まった場所をつなぎ目を重ねて鳴らし、最後までくり返す', () => {
  const v = songVersion('2026-11');
  const plan = songPlan(v, 60);
  assert.ok(plan.length >= Math.floor(60 / SONG.themeSec));
  plan.forEach((p, i) => {
    assert.equal(p.theme, v.order[i % v.order.length]);
    assert.equal(p.offset, p.theme * SONG.themeSec);
    assert.ok(p.offset + p.duration <= 50.5, '録音の長さの中');
    if (i) assert.ok(p.at > plan[i - 1].at && p.at < plan[i - 1].at + SONG.themeSec / v.rate);
  });
});

test('聞いた歌を記録する(はじめて聞いた月だけ)', () => {
  const st = mem();
  let s = loadSongs(st);
  let r = recordSong(st, s, '2026-11', 5);
  assert.equal(r.first, true);
  r = recordSong(st, r.songs, '2026-11', 9);
  assert.equal(r.first, false);
  assert.deepEqual(loadSongs(st), { '2026-11': 5 });
  st.setItem(SONG.storageKey, '{"x":1,"2026-12":"y"}');
  assert.deepEqual(loadSongs(st), {});
});
