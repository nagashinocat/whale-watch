import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHOTOS, photosToDrop, photosOf, photoCaption } from '../src/logic/photos.js';

const p = (id, time, whales = []) => ({ id, time, whales });

test('写真は決まった枚数まで。多すぎたら古いものから消す', () => {
  const list = Array.from({ length: PHOTOS.max + 3 }, (_, k) => p(k + 1, 1000 + k));
  assert.deepEqual(photosToDrop(list), [1, 2, 3]);
  assert.deepEqual(photosToDrop(list.slice(0, 5)), []);
});

test('そのクジラが写っている写真だけを、新しい順に', () => {
  const list = [p(1, 10, [3]), p(2, 30, [3, 5]), p(3, 20, [5])];
  assert.deepEqual(photosOf(list, 3).map(x => x.id), [2, 1]);
  assert.deepEqual(photosOf(list, 9), []);
});

test('写真の説明: 日付と、写っているクジラの名前', () => {
  const t = new Date(2026, 10, 6, 21, 5).getTime();
  assert.equal(photoCaption(p(1, t, [3, 5]), id => ({ 3: 'ユキ', 5: 'ポチ' })[id]), '11月6日 21:05 ・ ユキ、ポチ');
  assert.equal(photoCaption(p(1, t, []), () => ''), '11月6日 21:05 ・ 海');
});

test('写真の大きさ: 横はいちばん大きくても決まった幅まで(保存する量をおさえる)', () => {
  assert.ok(PHOTOS.maxWidth <= 1600 && PHOTOS.quality < 1);
});
