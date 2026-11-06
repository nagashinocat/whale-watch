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

// 画面のきめ細かさを切りかえると、その瞬間に画面が一度消えて、全体がチカチカして見える。
// そこで、切りかえはなるべく少なくする:
//   ・起動してすぐ(warmup 秒)は、準備で重いだけなので変えない
//   ・切りかえたあとは cooldown 秒のあいだ、次の切りかえをしない
//   ・一度かくついた細かさ(とそれより上)には、もう上げない(上げ下げを行ったり来たりしない)
//   ・0.25秒より長い止まり(タブを裏にしていたなど)は、数えない
export const QUALITY_CONTROL = Object.freeze({ warmup: 6, window: 2, cooldown: 10, maxGap: 0.25 });

export function createQualityControl(deviceRatio, start = Math.min(deviceRatio, 1.5)) {
  let ratio = start, ceiling = Math.max(QUALITY.minRatio, Math.min(deviceRatio, QUALITY.maxRatio));
  let age = 0, wait = QUALITY_CONTROL.warmup, frames = 0, time = 0;
  return {
    get ratio() { return ratio; },
    // 1コマごとに呼ぶ。きめ細かさを変えるときだけ新しい値を返す(変えないときは null)
    sample(dt) {
      age += dt;
      if (dt > QUALITY_CONTROL.maxGap) { frames = 0; time = 0; return null; }
      if (wait > 0) { wait -= dt; frames = 0; time = 0; return null; }
      frames++; time += dt;
      if (time < QUALITY_CONTROL.window) return null;
      const fps = frames / time;
      frames = 0; time = 0;
      let next = nextPixelRatio(ratio, fps, deviceRatio);
      if (next < ratio) ceiling = Math.min(ceiling, next);   // かくついた細かさには、もう上げない
      next = Math.min(next, ceiling);
      if (next === ratio) return null;
      ratio = next;
      wait = QUALITY_CONTROL.cooldown;
      return ratio;
    },
  };
}

// クジラの動きを、決めた姿勢へなめらかに追いかけさせる割合(dt 秒のあいだに、残りのどれだけ近づくか)。
// 画面の速さ(コマ数)が変わっても、同じ動きになるように、時間から計算する
const FOLLOW_SECONDS = 0.12;
export function followFactor(dt) {
  return dt <= 0 ? 0 : 1 - Math.exp(-dt / FOLLOW_SECONDS);
}
