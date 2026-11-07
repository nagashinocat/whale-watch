// 広告の設定。はじめのページのバナー広告の場所と、スタートを押したときに1回だけ流す広告動画。
// 広告の会社が決まるまでは、本番では出さない(enabled: false)。動作確認のページでは、出して確かめられる。
// 広告動画は、決まるまでのあいだ、このアプリの宣伝動画(自分の広告)を使う

export const ADS = Object.freeze({
  enabled: false,
  // スタートを押したあとに流す動画。skipAfterSec 秒たつとスキップできる。長すぎる動画は maxSec で止める
  video: Object.freeze({ src: 'assets/ads/house-ad.mp4', skipAfterSec: 5, maxSec: 35 }),
  // バナー広告の場所(はじめのページの上と下)。大きさはよく使われる形(横長と、四角)
  banners: Object.freeze([
    Object.freeze({ id: 'top', width: 320, height: 100 }),
    Object.freeze({ id: 'bottom', width: 300, height: 250 }),
  ]),
});

// 紹介広告(アフィリエイト)のバナー。広告の会社(AdSense など)とは別に、本番でも出す。
// slot: はじめのページのどの場所に置くか(banners の id)。href: 押したときに開くページ / img: バナーの画像 / pixel: 表示した回数を数える小さな画像
// (ステマ規制のため、枠に「PR」と出す。電波がなくても動くしくみ(sw.js)では、これらはとっておかない)
export const AFFILIATE_BANNERS = Object.freeze([
  Object.freeze({
    slot: 'bottom', width: 300, height: 250, alt: '',
    href: 'https://px.a8.net/svt/ejp?a8mat=4BGFJI+5QLFOY+5TGA+5YZ75',
    img: 'https://www26.a8.net/svt/bgt?aid=261107118347&wid=001&eno=01&mid=s00000027145001003000&mc=1',
    pixel: 'https://www14.a8.net/0.gif?a8mat=4BGFJI+5QLFOY+5TGA+5YZ75',
  }),
]);
export const affiliateFor = slot => AFFILIATE_BANNERS.find(a => a.slot === slot) ?? null;

// 広告動画を流すか: 広告が使えるときに、スタートを押したとき1回だけ(アプリを開いたときと、しばらく使わずにはじめのページにもどったあと)
export function shouldPlayAd({ enabled = ADS.enabled, alreadyPlayed = false } = {}) {
  return enabled && !alreadyPlayed && !!ADS.video.src;
}

// スキップのボタンに出す文字(のこり秒数)。0 以下なら押せる
export function skipLabel(elapsedSec, tr) {
  const left = Math.ceil(ADS.video.skipAfterSec - elapsedSec);
  return left > 0
    ? { ready: false, text: tr({ ja: `${left}秒後にスキップできます`, en: `Skip in ${left}s` }) }
    : { ready: true, text: tr({ ja: 'スキップ ▶', en: 'Skip ▶' }) };
}
