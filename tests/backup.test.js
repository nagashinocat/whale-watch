import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, parseBackup, mergeBooks, newPhotos, backupFileName } from '../src/logic/backup.js';
import { population } from '../src/logic/flukeId.js';

const [a, b, c] = population();
const jpg = 'data:image/jpeg;base64,/9j/AAAA';

test('バックアップ: 書き出したものを読み込むと、図鑑と写真がそのままもどる', () => {
  const book = { [a.id]: { count: 3, first: 10, last: 30, nickname: 'もち' }, [b.id]: { count: 0, first: 0, last: 0, photographed: true, photoAt: 5 } };
  const photos = [{ id: 7, time: 100, whales: [a.id], camera: 'cliff', src: jpg }];
  const text = JSON.stringify(makeBackup({ book, photos, now: 1 }));
  const back = parseBackup(text);
  assert.deepEqual(back.book, book);
  assert.deepEqual(back.photos, [{ time: 100, whales: [a.id], camera: 'cliff', src: jpg }]);
});

test('ちがうファイル・こわれたファイルは読み込まない。おかしな写真やクジラは捨てる', () => {
  assert.throws(() => parseBackup('{'), e => e.reason === 'broken');
  assert.throws(() => parseBackup('{"hello":1}'), e => e.reason === 'notBackup');
  const back = parseBackup(JSON.stringify({
    format: 'whale-ocean-backup', version: 1,
    book: { 99999: { count: 2 }, [a.id]: { count: -1 } },
    photos: [{ time: 1, src: 'javascript:alert(1)' }, { time: 'x', src: jpg }, { time: 2, src: jpg }],
  }));
  assert.deepEqual(back.book, {});
  assert.equal(back.photos.length, 1);
});

test('読み込むときは、いまの図鑑と合わせる(回数は多いほう、名前はいまのほう、写真は両方)', () => {
  const now = { [a.id]: { count: 2, first: 50, last: 60, nickname: 'いまの名前' }, [c.id]: { count: 1, first: 5, last: 5 } };
  const old = { [a.id]: { count: 5, first: 10, last: 40, nickname: '前の名前', photographed: true, photoAt: 9 }, [b.id]: { count: 1, first: 3, last: 3 } };
  const m = mergeBooks(now, old);
  assert.deepEqual(m[a.id], { count: 5, first: 10, last: 60, photographed: true, photoAt: 9, nickname: 'いまの名前' });
  assert.deepEqual(m[b.id], old[b.id]);
  assert.deepEqual(m[c.id], now[c.id]);
  const have = [{ time: 1, src: jpg }];
  assert.deepEqual(newPhotos(have, [{ time: 1, src: jpg }, { time: 2, src: jpg }]).map(p => p.time), [2]);
});

test('ファイルの名前に日付が入る', () => {
  assert.equal(backupFileName(new Date(2026, 10, 7)), 'whale-ocean-backup-2026-11-07.json');
});
