import { TIME_PRESETS } from './config.js';

// 時間の設定と今の日時から、空に使う時刻(0〜24の小数)を決める。
export function hoursFor(setting, date) {
  const fixed = TIME_PRESETS[setting];
  if (typeof fixed === 'number') return fixed;
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

// 時刻 from から to へ、近い方向に t(0〜1)だけ進んだ時刻。0時をまたげる。
export function blendHours(from, to, t) {
  let diff = (((to - from) % 24) + 24) % 24;
  if (diff > 12) diff -= 24;
  return (((from + diff * t) % 24) + 24) % 24;
}
