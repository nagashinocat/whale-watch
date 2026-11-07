// おやすみタイマー: 決めた時間をかけて、音をだんだん小さくして止める。
// はじめはそのままの大きさで、後ろの半分(短いときも5分以上)で、ゆっくり小さくしていく。
// 小さくなりはじめたら、新しいクジラは来ない(鳴き声で起こさないように)

export const SLEEP_TIMER = Object.freeze({
  presets: Object.freeze([15, 30, 60, 90]),   // 分
  fadeShare: 0.5,       // 後ろの何割で小さくするか
  minFadeMin: 5,        // 小さくする時間の最短(分)
  wakeFadeMs: 3000,     // もう一度流すときに、元の大きさにもどす時間
});

// 小さくしはじめる時刻(ミリ秒)
export function fadeStartAt({ start, end }) {
  const total = end - start;
  const fade = Math.min(total, Math.max(total * SLEEP_TIMER.fadeShare, SLEEP_TIMER.minFadeMin * 60000));
  return end - fade;
}

// t のときの音の大きさの倍率(1 → 0)。人の耳には、大きさを等分に下げると終わりだけ急に感じるので、
// 2乗のカーブで、はじめはゆっくり・終わりもなめらかに下げる
export function fadeLevel(t, timer) {
  if (!timer) return 1;
  const from = fadeStartAt(timer);
  if (t <= from) return 1;
  if (t >= timer.end) return 0;
  const k = (t - from) / (timer.end - from);
  const s = 0.5 + 0.5 * Math.cos(Math.PI * k);   // 1 → 0 をなめらかに
  return s * s;
}

// いまの状態: idle(なし)・playing(そのまま)・fading(小さくしている)・done(止まった)
export function sleepPhase(t, timer) {
  if (!timer) return 'idle';
  if (t >= timer.end) return 'done';
  return t >= fadeStartAt(timer) ? 'fading' : 'playing';
}

export const sleepTimerFor = (minutes, now) => ({ start: now, end: now + minutes * 60000 });
