import { TIME_PRESETS } from './config.js';

// 時間の設定と今の日時から、空に使う時刻(0〜24の小数)を決める。
export function hoursFor(setting, date) {
  const fixed = TIME_PRESETS[setting];
  if (typeof fixed === 'number') return fixed;
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

// 空の時間のバー(朝5時〜夜23時)。f: バーの左はしから右はしまでの割合(0〜1)
export const SKY_BAR = Object.freeze({ from: 5, to: 23, stepHours: 0.25 });
export function hoursAtBar(f) {
  const t = Math.min(1, Math.max(0, f));
  const h = SKY_BAR.from + t * (SKY_BAR.to - SKY_BAR.from);
  return Math.round(h / SKY_BAR.stepHours) * SKY_BAR.stepHours;   // 15分きざみ
}
export const clampBarHours = h => Math.min(SKY_BAR.to, Math.max(SKY_BAR.from, h));
// 「14:30」のような時刻の文字
export const clockOf = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

// 時刻 from から to へ、近い方向に t(0〜1)だけ進んだ時刻。0時をまたげる。
export function blendHours(from, to, t) {
  let diff = (((to - from) % 24) + 24) % 24;
  if (diff > 12) diff -= 24;
  return (((from + diff * t) % 24) + 24) % 24;
}
