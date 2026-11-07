import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADS, shouldPlayAd, skipLabel } from '../src/logic/ads.js';
import { tr } from '../src/logic/i18n.js';

test('広告動画は、広告が使えるときに、開いてから1回だけ流す', () => {
  assert.equal(ADS.enabled, false, '広告の会社が決まるまで、本番では出さない');
  assert.equal(shouldPlayAd(), false);
  assert.equal(shouldPlayAd({ enabled: true }), true);
  assert.equal(shouldPlayAd({ enabled: true, alreadyPlayed: true }), false);
});

test('スキップは5秒たってから押せる', () => {
  assert.deepEqual(skipLabel(0, tr), { ready: false, text: '5秒後にスキップできます' });
  assert.equal(skipLabel(4.2, tr).text, '1秒後にスキップできます');
  assert.equal(skipLabel(5, tr).ready, true);
  assert.ok(ADS.video.maxSec >= 30, '30秒の動画は最後まで流せる');
});

test('バナー広告の場所は、はじめのページの上と下', () => {
  assert.deepEqual(ADS.banners.map(b => b.id), ['top', 'bottom']);
  for (const b of ADS.banners) assert.ok(b.width <= 320, 'スマホの画面に収まる幅');
});

test('紹介広告のバナーは、はじめのページの下の場所に、A8.net の画像と回数を数える画像つきで置く', async () => {
  const { affiliateFor } = await import('../src/logic/ads.js');
  const a = affiliateFor('bottom');
  assert.ok(a && a.href.startsWith('https://px.a8.net/') && a.img.startsWith('https://') && a.pixel.startsWith('https://'));
  assert.equal(a.width, 300); assert.equal(a.height, 250);
  assert.equal(affiliateFor('top'), null);
});
