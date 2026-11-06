import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLUKE_ID, individual, population, flukeWhiteness, nextVisitor, recordSighting } from '../src/logic/flukeId.js';

const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const whiteFraction = ind => {
  let w = 0, n = 0;
  for (let s = -0.95; s <= 0.95; s += 0.05) for (let c = 0.02; c <= 0.98; c += 0.04) { w += flukeWhiteness(ind, s, c) > 0.5 ? 1 : 0; n++; }
  return w / n;
};

test('尾びれの裏の白さは5段階(1: ほぼ白 〜 5: ほぼ黒)。段階どおりの白さになる', () => {
  // (真っ白なクジラは尾びれの裏も真っ白なので、ここでは別あつかい)
  for (const ind of population().filter(i => i.traits.coat !== 'white')) {
    const f = whiteFraction(ind);
    const target = FLUKE_ID.whiteness[ind.category];
    assert.ok(Math.abs(f - target) < 0.12, `${ind.name} cat ${ind.category}: ${f.toFixed(2)} vs ${target}`);
  }
  const cats = new Set(population().map(i => i.category));
  assert.ok(cats.size >= 4, 'all kinds appear');
});

test('同じクジラはいつも同じ模様、ちがうクジラはちがう模様', () => {
  const a = individual(3), a2 = individual(3), b = individual(4);
  let same = 0, diff = 0, n = 0;
  for (let s = -0.9; s <= 0.9; s += 0.1) for (let c = 0.05; c <= 0.95; c += 0.1) {
    n++;
    if (flukeWhiteness(a, s, c) === flukeWhiteness(a2, s, c)) same++;
    if (Math.abs(flukeWhiteness(a, s, c) - flukeWhiteness(b, s, c)) > 0.5) diff++;
  }
  assert.equal(same, n);
  assert.ok(diff / n > 0.12, `diff ${diff / n}`);
});

test('傷あとは、黒いところでは白く、白いところでは黒く残る', () => {
  const ind = population().find(i => i.scars.length > 0);
  assert.ok(ind, 'some whales have scars');
  const sc = ind.scars[0];
  const mid = [(sc.from[0] + sc.to[0]) / 2, (sc.from[1] + sc.to[1]) / 2];
  const plain = flukeWhiteness({ ...ind, scars: [] }, mid[0], mid[1]);
  const scarred = flukeWhiteness(ind, mid[0], mid[1]);
  assert.ok(Math.abs(scarred - (1 - plain)) < 0.2, `${plain} -> ${scarred}`);
});

test('名前は模様から付けた日本語で、重ならない。子クジラには名前を付けない', () => {
  const names = population().map(i => i.name);
  assert.equal(new Set(names).size, names.length);
  for (const n of names) assert.ok(/^[ァ-ヶー0-9]+$/.test(n), n);
  assert.ok(FLUKE_ID.calvesNamed === false);
});

test('また来るクジラもいる: 図鑑に記録のあるクジラが、ときどきもう一度来る', () => {
  const rng = seeded(11);
  let book = {};
  let returns = 0;
  for (let k = 0; k < 200; k++) {
    const id = nextVisitor(book, rng);
    const r = recordSighting(book, id, 1000 * k);
    if (!r.first) returns++;
    book = r.book;
  }
  assert.ok(returns > 40 && returns < 180, `returns ${returns}`);
});

test('記録: はじめて見たとき・また来たときの回数と日付', () => {
  let r = recordSighting({}, 5, 1000);
  assert.equal(r.first, true); assert.equal(r.count, 1);
  r = recordSighting(r.book, 5, 5000);
  assert.equal(r.first, false); assert.equal(r.count, 2);
  assert.equal(r.book[5].first, 1000); assert.equal(r.book[5].last, 5000);
});

test('こわれた記録や知らない番号は、無視する', () => {
  const id = nextVisitor({ 999: { count: 1 }, x: null }, seeded(2));
  assert.ok(population().some(i => i.id === id));
});

test('図鑑の保存と読みこみ。こわれた保存は空にもどす', async () => {
  const { loadBook, saveBook, bookEntries, ZUKAN_KEY } = await import('../src/logic/flukeId.js');
  const mem = (d = {}) => ({ getItem: k => d[k] ?? null, setItem: (k, v) => { d[k] = v; } });
  const s = mem();
  saveBook(s, { 3: { count: 2, first: 10, last: 20 }, 5: { count: 1, first: 30, last: 30 } });
  const book = loadBook(s);
  assert.equal(book[3].count, 2);
  assert.deepEqual(bookEntries(book).map(e => e.id), [5, 3]);
  assert.deepEqual(loadBook(mem({ [ZUKAN_KEY]: '{oops' })), {});
  assert.deepEqual(loadBook(mem({ [ZUKAN_KEY]: '{"999":{"count":1}}' })), {});
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.deepEqual(loadBook(bad), {});
  assert.doesNotThrow(() => saveBook(bad, {}));
});

test('自分で名前を付けられる。前後の空白はとり、長すぎる名前は12文字まで。空にすると、もとの名前にもどる', async () => {
  const { setNickname, displayName, loadBook, saveBook, recordSighting } = await import('../src/logic/flukeId.js');
  let book = recordSighting({}, 3, 1000).book;
  book = setNickname(book, 3, '  ポチ  ');
  assert.equal(displayName(3, book), 'ポチ');
  book = setNickname(book, 3, 'あいうえおかきくけこさしすせそ');
  assert.equal(displayName(3, book).length, 12);
  // また来ても、付けた名前は消えない
  book = recordSighting(book, 3, 2000).book;
  assert.equal(displayName(3, book), 'あいうえおかきくけこさし');
  // 保存して読みこんでも残る
  const d = {}; const mem = { getItem: k => d[k] ?? null, setItem: (k, v) => { d[k] = v; } };
  saveBook(mem, book);
  assert.equal(displayName(3, loadBook(mem)), 'あいうえおかきくけこさし');
  book = setNickname(book, 3, '   ');
  assert.equal(displayName(3, book), population().find(i => i.id === 3).name);
  // 見たことのないクジラには付けられない
  assert.equal(setNickname({}, 4, 'タロウ')[4], undefined);
});
