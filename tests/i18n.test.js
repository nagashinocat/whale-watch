import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { detectLang, resolveLang, setLang, lang, tr } from '../src/logic/i18n.js';
import { population } from '../src/logic/flukeId.js';
import { traitsText } from '../src/logic/traits.js';
import { commentFor, zukanInfo, sightingMessage } from '../src/logic/zukan.js';
import { remainingText } from '../src/logic/timer.js';
import { photoCaption } from '../src/logic/photos.js';

const JP = /[぀-ヿ一-鿿]/;
after(() => setLang('ja'));

test('はじめの言語: 日本語の端末は日本語、それ以外は英語。選んだ言語があればそれ', () => {
  assert.equal(detectLang(['ja-JP', 'en-US']), 'ja');
  assert.equal(detectLang(['en-GB']), 'en');
  assert.equal(detectLang(['fr-FR', 'ja']), 'en', 'いちばん先の言語で決める');
  assert.equal(detectLang([]), 'ja');
  assert.equal(resolveLang('en', ['ja-JP']), 'en');
  assert.equal(resolveLang('auto', ['ko-KR']), 'en');
  assert.equal(resolveLang('ja', ['en']), 'ja');
});

test('英語にすると、クジラの名前・特徴・コメント・お知らせ・時間が英語になる(日本語がまざらない)', () => {
  setLang('en');
  assert.equal(lang(), 'en');
  const list = population();
  const names = list.map(i => i.name);
  assert.equal(new Set(names).size, names.length, '名前が重ならない');
  for (const ind of list) {
    assert.ok(!JP.test(ind.name), ind.name);
    for (const t of traitsText(ind)) assert.ok(!JP.test(t), t);
    const c = commentFor(ind);
    assert.ok(!JP.test(c) && c.length > 10, c);
  }
  assert.ok(names.includes('Snow'), '真っ白な子は Snow');
  const info = zukanInfo(list[0], { count: 1 });
  assert.ok(!JP.test(info.next.text), info.next.text);
  for (const m of [sightingMessage([{ name: 'Snow', first: true, count: 1 }]), sightingMessage([{ name: 'A', first: false, count: 3 }, { name: 'B', first: true, count: 1 }])]) assert.ok(!JP.test(m), m);
  assert.equal(remainingText(65 * 60000), '1 h 5 min left');
  assert.equal(photoCaption({ time: new Date(2026, 10, 6, 21, 5).getTime(), whales: [] }, () => ''), 'Nov 6, 21:05 · The sea');
  assert.equal(tr({ ja: 'あ', en: 'a' }), 'a');
});

test('日本語にもどすと、名前も日本語にもどる', () => {
  setLang('ja');
  assert.ok(population().some(i => i.name === 'ユキ'));
  assert.ok(JP.test(population()[0].name));
});
