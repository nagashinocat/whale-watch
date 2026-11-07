// スマホでアプリを切りかえたり、ホーム画面にもどったりしたときの音の止め方。
// 音が鳴っているとちゅうで、端末が音を急に止めたり、もう一度動かしたりすると、切れ目で「プツッ」「ピー」という音が出ることがある。
// そこで、見えなくなったら音をすばやく小さくしてから止め、もどってきたら少しずつ大きくする。
// パソコンでは、ほかのタブを見ていても鳴りつづけてほしい(作業のおとも)ので、何もしない。three.js も音のしくみも使わない(テストからも使う)

export const AWAY = Object.freeze({
  fadeOutMs: 60,        // 見えなくなったとき、これだけかけて音を小さくする(すぐ止められても切れ目が出にくい短さ)
  suspendAfterMs: 90,   // 小さくしおわってから、音のしくみを止める
  fadeInMs: 700,        // もどってきたとき、これだけかけて大きくする
});

// スマホやタブレットのように、指で操作して、マウスを持たない端末か
export function isPhoneLike(matchMedia) {
  try { return matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches; } catch { return false; }
}

// 見えなくなった・もどってきたときにすること。
// 'pause': 小さくして止める / 'show': 音を大きくもどす(resume: 音のしくみも動かすか)/ null: 何もしない
export function awayPlan({ hidden, phone, resting = false }) {
  if (!phone) return null;
  if (hidden) return { action: 'pause' };
  // 「おやすみなさい」で音を止めているときは、音のしくみは止めたまま(大きさだけもとにもどしておく)
  return { action: 'show', resume: !resting };
}
