import { test } from 'node:test';
import assert from 'node:assert/strict';
import { population, individual, flukeWhiteness } from '../src/logic/flukeId.js';
import { TRAITS, traitsText, traitBodyColor, traitFinColor, flukeBite, dorsalRiseFor } from '../src/logic/traits.js';

const lum = c => 0.3 * c[0] + 0.6 * c[1] + 0.1 * c[2];
const has = (ind, key, value) => ind.traits[key] === value;

test('この海のクジラには、どの個性も1頭以上いる。真っ白なクジラは1頭だけ(とてもめずらしい)', () => {
  const pop = population();
  assert.equal(pop.filter(i => has(i, 'coat', 'white')).length, 1);
  for (const [key, values] of Object.entries(TRAITS)) {
    for (const v of values) if (v !== 'normal' && v !== 'white') assert.ok(pop.some(i => has(i, key, v)), `${key}=${v}`);
  }
  // 個性のないクジラもいる(ふつうのクジラのほうが多い)
  assert.ok(pop.filter(i => traitsText(i).length === 0).length >= 4);
});

test('個性はいつも同じ(同じクジラはまた来ても同じ見た目)。尾びれの模様もこれまでと変わらない', () => {
  assert.deepEqual(individual(5).traits, individual(5).traits);
  assert.equal(individual(1).name.length > 0, true);
});

test('個性の説明は日本語', () => {
  for (const i of population()) for (const t of traitsText(i)) assert.ok(/[ぁ-んァ-ン一-龥]/.test(t), t);
  const white = population().find(i => has(i, 'coat', 'white'));
  assert.ok(traitsText(white).some(t => t.includes('真っ白')));
});

test('真っ白なクジラは、体も尾びれの裏も白い', () => {
  const white = population().find(i => has(i, 'coat', 'white'));
  assert.ok(lum(traitBodyColor(white, 0.5, 0.2, [0.09, 0.09, 0.1])) > 0.75);
  assert.ok(flukeWhiteness(white, 0.3, 0.5) > 0.9 && flukeWhiteness(white, -0.9, 0.95) > 0.9);
});

test('おなかまで黒い子は、おなかが暗い。おなかの白が広い子は、わき腹まで白い', () => {
  const dark = { traits: { ...population()[0].traits, coat: 'dark' } };
  const pale = { traits: { ...population()[0].traits, coat: 'pale' } };
  const belly = [0.9, 0.91, 0.92];
  assert.ok(lum(traitBodyColor(dark, 0.35, Math.PI, belly)) < 0.4);
  const side = [0.09, 0.09, 0.1];
  assert.ok(lum(traitBodyColor(pale, 0.4, 1.9, side)) > 0.4);
  // 背中はどちらも黒いまま
  assert.ok(lum(traitBodyColor(pale, 0.4, 0.1, side)) < 0.2);
});

test('スクリューの傷は、黒い背中に平行な白い線になる', () => {
  const ind = { traits: { ...population()[0].traits, scars: 'propeller', coat: 'normal' } };
  let white = 0, n = 0;
  for (let u = 0.44; u < 0.58; u += 0.002) { n++; if (lum(traitBodyColor(ind, u, 0.3, [0.09, 0.09, 0.1])) > 0.5) white++; }
  assert.ok(white > 2 && white < n * 0.5, `${white}/${n}`);
});

test('胸びれの表が黒い子は、胸びれの上の面が黒い(裏は白い)', () => {
  const ind = { traits: { ...population()[0].traits, pec: 'darkTop', coat: 'normal' } };
  const w = [0.9, 0.91, 0.92];
  assert.ok(lum(traitFinColor(ind, 0.5, true, w)) < 0.3);
  assert.ok(lum(traitFinColor(ind, 0.5, false, w)) > 0.8);
});

test('背びれの形: かぎ形は高くとがり、小さなこぶは低い。先が欠けた背びれは上が平ら', () => {
  const max = v => Math.max(...Array.from({ length: 200 }, (_, k) => dorsalRiseFor(v, 0.55 + k * 0.001)));
  assert.ok(max('hook') > max('normal') * 1.2);
  assert.ok(max('knob') < max('normal') * 0.6);
  assert.ok(max('nick') < max('normal') * 0.75 && max('nick') > max('knob'));
});

test('尾びれの欠け: うしろのふちが、片側だけ大きく欠ける', () => {
  const ind = population().find(i => has(i, 'fluke', 'bite'));
  const bites = Array.from({ length: 41 }, (_, k) => flukeBite(ind, -1 + k * 0.05));
  assert.ok(Math.max(...bites) > 0.02);
  assert.ok(bites.filter(b => b > 0.005).length < 15, 'only one part');
  assert.equal(flukeBite({ traits: { fluke: 'normal' } }, 0.5), 0);
});
