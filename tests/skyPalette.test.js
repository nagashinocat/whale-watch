import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyPalette, SKY_KEYS } from '../src/logic/skyPalette.js';

const rgb = hex => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const maxDiff = (a, b) => Math.max(...rgb(a).map((v, i) => Math.abs(v - rgb(b)[i])));
const PARTS = ['zenith', 'middle', 'horizon', 'water', 'light'];

test('昼は晴れた青空', () => {
  const p = skyPalette(12);
  const [r, g, b] = rgb(p.zenith);
  assert.ok(b > 180 && b > r * 2 && b > g);
});

test('夕方は地平線がオレンジ、上が薄紫、間がピンク', () => {
  const p = skyPalette(17.5);
  const [hr, hg, hb] = rgb(p.horizon);
  assert.ok(hr > 200 && hr > hg && hg > hb, 'horizon orange');
  const [mr, , mb] = rgb(p.middle);
  assert.ok(mr > 180 && mb > 100, 'middle pink');
  const [zr, zg, zb] = rgb(p.zenith);
  assert.ok(zb > zr && zr > zg, 'zenith lavender');
});

test('夕方から夜へは2時間以上かけてゆっくり暗くなる', () => {
  const lum = h => rgb(skyPalette(h).middle).reduce((a, b) => a + b, 0);
  assert.ok(lum(17.5) > lum(18.5) && lum(18.5) > lum(19.5));
  assert.ok(lum(19.5) > lum(21) - 1);
});

test('夜は暗い', () => {
  for (const h of [22, 0, 3]) {
    assert.ok(rgb(skyPalette(h).zenith).every(v => v < 40));
  }
});

test('1分ごとの色の変化は小さく、0時もなめらか', () => {
  for (let h = 0; h < 24; h += 1 / 60) {
    const a = skyPalette(h), b = skyPalette((h + 1 / 60) % 24);
    for (const k of PARTS) assert.ok(maxDiff(a[k], b[k]) <= 3, `${k} at ${h.toFixed(2)}`);
  }
});

test('時刻のキーは0〜24に昇順で並ぶ', () => {
  const hours = SKY_KEYS.map(k => k.at);
  assert.deepEqual(hours, [...hours].sort((a, b) => a - b));
  assert.ok(hours[0] >= 0 && hours[hours.length - 1] < 24);
});
