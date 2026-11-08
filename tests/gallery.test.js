import { test } from 'node:test';
import assert from 'node:assert/strict';
import { galleryReady, canPost, galleryName, galleryEntry, imagePath, postRequests, listRequest, imageUrl, loadPosted, markPosted, isPosted, GALLERY } from '../src/logic/gallery.js';

const cfg = { url: 'https://abc.supabase.co', key: 'pub-key' };
const photo = { time: 1762560000000, whales: [3, 3, 7], score: { total: 91.2, rank: 'S', composition: 52, rarity: 39, notes: [{ ja: 'ジャンプの瞬間!', en: 'Caught mid-air!' }] } };

test('置き場の住所と鍵がそろっていないと、ギャラリーは出さない', () => {
  assert.equal(galleryReady(cfg), true);
  assert.equal(galleryReady({ url: '', key: '' }), false);
  assert.equal(galleryReady({ url: 'http://abc.supabase.co', key: 'k' }), false);
  assert.equal(galleryReady(null), false);
});

test('A以上の写真だけ載せられる', () => {
  assert.equal(canPost(photo), true);
  assert.equal(canPost({ score: { rank: 'A' } }), true);
  assert.equal(canPost({ score: { rank: 'B' } }), false);
  assert.equal(canPost({}), false);
});

test('名前: ふつうの名前は載る。アドレス・アカウント名・いやな言葉・空は載らない', () => {
  assert.equal(galleryName(' しろちゃん '), 'しろちゃん');
  assert.equal(galleryName('Moby'), 'Moby');
  assert.equal(galleryName('あいうえおかきくけこさしすせそ').length, GALLERY.nameMax);
  for (const bad of ['見てね http://x.jp', '@someone', '#宣伝', 'example.com', 'し ね', 'F.U.C.K', '', '   ', null]) assert.equal(galleryName(bad), null, String(bad));
});

test('送る中身: 点数・ランク・クジラ(重なりなし)と、付けた名前', () => {
  const e = galleryEntry(photo, { nickOf: id => (id === 3 ? 'しろちゃん' : ''), lang: 'ja', path: '2025-11/x.jpg' });
  assert.equal(e.score, 91);
  assert.equal(e.rank, 'S');
  assert.deepEqual(e.whales, [{ id: 3, nick: 'しろちゃん' }, { id: 7, nick: null }]);
  assert.equal(e.image_path, '2025-11/x.jpg');
  assert.equal(e.notes[0].ja, 'ジャンプの瞬間!');
  assert.equal(galleryEntry(photo, { lang: 'fr', path: 'p' }).lang, 'ja');
});

test('ファイル名と、送る手順・読む手順', () => {
  const p = imagePath(() => 0.5, Date.UTC(2026, 10, 8));
  assert.match(p, /^2026-11\/[a-z0-9]{16}\.jpg$/);
  const [up, row] = postRequests(cfg, { image_path: p });
  assert.equal(up.url, `https://abc.supabase.co/storage/v1/object/gallery/${p}`);
  assert.equal(up.headers.apikey, 'pub-key');
  assert.equal(row.url, 'https://abc.supabase.co/rest/v1/gallery');
  assert.equal(JSON.parse(row.body).image_path, p);
  const best = new URL(listRequest(cfg, 'best', Date.UTC(2026, 10, 8)).url);
  assert.equal(best.searchParams.get('hidden'), 'eq.false');
  assert.equal(best.searchParams.get('order'), 'score.desc,created_at.desc');
  assert.match(best.searchParams.get('created_at'), /^gte\.2026-11-01/);
  assert.equal(new URL(listRequest(cfg, 's').url).searchParams.get('rank'), 'eq.S');
  assert.equal(imageUrl(cfg, '2026-11/a b.jpg'), 'https://abc.supabase.co/storage/v1/object/public/gallery/2026-11/a%20b.jpg');
});

test('載せた写真を覚えておく(2回載せない)', () => {
  const m = {}; const st = { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } };
  assert.equal(isPosted(st, photo), false);
  markPosted(st, photo.time); markPosted(st, photo.time);
  assert.equal(isPosted(st, photo), true);
  assert.deepEqual(loadPosted(st), [photo.time]);
  assert.deepEqual(loadPosted({ getItem: () => { throw new Error('x'); } }), []);
});

test('送る中身が、置き場の決まり(tools/gallery_setup.sql)に合っている', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../tools/gallery_setup.sql', import.meta.url), 'utf8');
  const pathRe = new RegExp(sql.match(/image_path ~ '([^']+)'/)[1]);
  const p = imagePath();
  assert.match(p, pathRe);
  const { scorePhoto } = await import('../src/logic/photoScore.js');
  const body = Array.from({ length: 9 }, (_, i) => ({ x: -0.5 + i / 8, y: 0, inFrame: true, above: true }));
  const s = scorePhoto({ subjects: [{ pattern: 'bubbleRing', points: body, airborne: true }], light: 'golden' });
  const e = galleryEntry({ time: 1, whales: [1], score: s }, { path: p });
  assert.equal(e.score, e.composition + e.rarity);
  assert.ok(e.composition <= 60 && e.rarity <= 40);
  assert.ok((e.rank === 'S' && e.score >= 90) || (e.rank === 'A' && e.score >= 75 && e.score < 90));
  assert.ok(JSON.stringify(e.notes).length < 800 && JSON.stringify(e.whales).length < 1000);
});
