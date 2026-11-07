// スマホでアプリを切りかえたり、ホーム画面にもどったりしたときの音の止め方。
// 音が鳴っているとちゅうで、端末が音を急に止めたり、もう一度動かしたりすると、切れ目で「プツッ」「ピー」という音が出ることがある。
// そこで、見えなくなったら音をすばやく小さくしてから止め、もどってきたら少しずつ大きくする。
// パソコンでは、ほかのタブを見ていても鳴りつづけてほしい(作業のおとも)ので、何もしない。three.js も音のしくみも使わない(テストからも使う)

export const AWAY = Object.freeze({
  fadeOutMs: 25,        // 見えなくなったとき、これだけかけて音を小さくする(すぐ止められても切れ目が出にくい短さ)
  suspendAfterMs: 60,   // 小さくしおわってから、音のしくみを止める
  fadeInMs: 700,        // もどってきたとき、これだけかけて大きくする
});

// スマホやタブレットのように、指で操作して、マウスを持たない端末か
export function isPhoneLike(matchMedia) {
  try { return matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches; } catch { return false; }
}

// iPhone では、アプリを切りかえはじめたとき(画面のフォーカスがはずれたとき: blur)のほうが、
// 「見えなくなった」(visibilitychange)より先に届く。見えなくなるのを待つと、端末が先に音を止めて「ピー」が出るので、
// フォーカスがはずれた時点で音を小さくする(止めるのは、本当に見えなくなってから)。
// iPhone(iOS 17 から)の「音の使い方」(navigator.audioSession)。'playback' にすると、
// ホーム画面にもどったとき、iPhone が音をいきなり切らなくなる(こちらで静かに小さくしてから止められる)。
// マナーモードでも音が出るようになる。止めたあとは 'auto' にもどして、ロック画面に「再生中」が残らないようにする
export function setAudioSession(nav, type) {
  try { if (nav?.audioSession && nav.audioSession.type !== type) nav.audioSession.type = type; return true; } catch { return false; }
}

// 音の止め方(動作確認のページで、iPhone の「ピン」をくらべるため。本番は 'fade')
//   fade: 「再生」の札 + すばやく小さくしてから止める / soft: 小さくするだけ(止めない・札もつけない)
//   none: 何もしない(前のまま) / element: 音を <audio> の部品を通して鳴らし、小さくしてから止める
export const AWAY_MODES = Object.freeze({
  fade: '再生の札 + 小さくして止める(いまの方法)',
  soft: '小さくするだけ(止めない)',
  none: '何もしない(前のまま)',
  element: '<audio> を通して鳴らす',
});
const MODE_KEY = 'whale-ocean-away-mode';
const LOG_KEY = 'whale-ocean-away-log';
export function loadAwayMode(storage) {
  try { const v = storage.getItem(MODE_KEY); return Object.hasOwn(AWAY_MODES, v) ? v : 'fade'; } catch { return 'fade'; }
}
export function saveAwayMode(storage, mode) {
  try { storage.setItem(MODE_KEY, mode); } catch { /* 保存できなくても続ける */ }
}
// アプリを離れたときに届いた合図の記録(つぎに開いたとき、動作確認のページで見る)。新しい60件まで
export function logAway(storage, entry) {
  try {
    const list = JSON.parse(storage.getItem(LOG_KEY) || '[]');
    list.push(entry);
    storage.setItem(LOG_KEY, JSON.stringify(list.slice(-60)));
  } catch { /* 保存できなくても続ける */ }
}
export function readAwayLog(storage) {
  try { const v = JSON.parse(storage.getItem(LOG_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function clearAwayLog(storage) {
  try { storage.removeItem(LOG_KEY); } catch { /* 保存できなくても続ける */ }
}

// 見えなくなった・もどってきたときにすること。
// 'pause': 小さくして止める / 'show': 音を大きくもどす(resume: 音のしくみも動かすか)/ null: 何もしない
export function awayPlan({ hidden, phone, resting = false }) {
  if (!phone) return null;
  if (hidden) return { action: 'pause' };
  // 「おやすみなさい」で音を止めているときは、音のしくみは止めたまま(大きさだけもとにもどしておく)
  return { action: 'show', resume: !resting };
}
