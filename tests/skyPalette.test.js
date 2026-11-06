import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyPalette, SKY_KEYS, SKY_MOMENTS } from '../src/logic/skyPalette.js';
import { sunForTime } from '../src/logic/sky.js';

const rgb = hex => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const maxDiff = (a, b) => Math.max(...rgb(a).map((v, i) => Math.abs(v - rgb(b)[i])));
const PARTS = ['zenith', 'middle', 'horizon', 'water', 'light'];

test('昼は晴れた青空', () => {
  const p = skyPalette(12);
  const [r, g, b] = rgb(p.zenith);
  assert.ok(b > 180 && b > r * 2 && b > g);
});

test('夕焼けは地平線がオレンジ、上が薄紫、間がピンク', () => {
  const p = skyPalette(SKY_MOMENTS.sunset);
  const [hr, hg, hb] = rgb(p.horizon);
  assert.ok(hr > 200 && hr > hg && hg > hb, 'horizon orange');
  const [mr, , mb] = rgb(p.middle);
  assert.ok(mr > 180 && mb > 100, 'middle pink');
  const [zr, zg, zb] = rgb(p.zenith);
  assert.ok(zb > zr && zr > zg, 'zenith lavender');
});

test('夕方から夜へは2時間以上かけてゆっくり暗くなる', () => {
  const lum = h => rgb(skyPalette(h).middle).reduce((a, b) => a + b, 0);
  assert.ok(lum(SKY_MOMENTS.sunset) > lum(18.6) && lum(18.6) > lum(19.5));
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
    for (const k of PARTS) assert.ok(maxDiff(a[k], b[k]) <= 8, `${k} at ${h.toFixed(2)}`);
  }
});

test('時刻のキーは0〜24に昇順で並ぶ', () => {
  const hours = SKY_KEYS.map(k => k.at);
  assert.deepEqual(hours, [...hours].sort((a, b) => a - b));
  assert.ok(hours[0] >= 0 && hours[hours.length - 1] < 24);
});

test('特別な時間は実際の太陽の高さに合わせてある', () => {
  // ゴールデンアワー: 太陽が地平線から0〜6度 / ブルーアワー: 地平線の下4〜8度
  const golden = sunForTime(SKY_MOMENTS.golden).elevation;
  assert.ok(golden > 0 && golden < 6, `golden ${golden}`);
  const blue = sunForTime(SKY_MOMENTS.blue).elevation;
  assert.ok(blue < -4 && blue > -8, `blue ${blue}`);
  const sunset = sunForTime(SKY_MOMENTS.sunset).elevation;
  assert.ok(sunset < 0.5 && sunset > -3, `sunset ${sunset}`);
});

test('ゴールデンアワーは地平線と光が金色', () => {
  const p = skyPalette(SKY_MOMENTS.golden);
  for (const k of ['horizon', 'light']) {
    const [r, g, b] = rgb(p[k]);
    assert.ok(r > 230 && g > 140 && g < 215 && b < 140, k);
  }
  const [zr, , zb] = rgb(p.zenith);
  assert.ok(zb > zr, 'zenith still blue');
});

test('ブルーアワーは空全体が深い青', () => {
  const p = skyPalette(SKY_MOMENTS.blue);
  const [r, g, b] = rgb(p.zenith);
  assert.ok(b > 90 && b > r * 2 && b > g * 1.5);
  assert.ok(r + g + b < rgb(skyPalette(12).zenith).reduce((x, y) => x + y));
});
