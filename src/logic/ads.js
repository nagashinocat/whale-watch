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
