// 画面のきめ細かさと、動きのなめらかさ。three.js は使わない(テストからも使う)。

// minRatio / maxRatio: 画面のきめ細かさ(1 が端末の文字と同じ細かさ、2 がその倍)
// lowFps / highFps: これより遅いと下げ、これより速いと上げる(1秒あたりのコマ数)
export const QUALITY = Object.freeze({ minRatio: 1, maxRatio: 2, step: 0.25, lowFps: 45, highFps: 57 });

// いまのきめ細かさと、ここ数秒の1秒あたりのコマ数から、次のきめ細かさを決める
export function nextPixelRatio(current, fps, deviceRatio) {
  const cap = Math.max(QUALITY.minRatio, Math.min(deviceRatio, QUALITY.maxRatio));
  if (fps < QUALITY.lowFps) return Math.max(QUALITY.minRatio, current - QUALITY.step);
  if (fps > QUALITY.highFps) return Math.min(cap, current + QUALITY.step);
  return current;
}

// クジラの動きを、決めた姿勢へなめらかに追いかけさせる割合(dt 秒のあいだに、残りのどれだけ近づくか)。
// 画面の速さ(コマ数)が変わっても、同じ動きになるように、時間から計算する
const FOLLOW_SECONDS = 0.12;
export function followFactor(dt) {
  return dt <= 0 ? 0 : 1 - Math.exp(-dt / FOLLOW_SECONDS);
}
