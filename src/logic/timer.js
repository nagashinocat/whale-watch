// タイマー。決めた時間になると、クジラが鳴きながら来て知らせる。three.js は使わない(テストからも使う)。
//
// ・「○分後」と「○時○分」の2とおりで決められる
// ・時刻は端末の時計で決めるので、画面が止まっていても、もどったときにすぐ知らせられる
// ・ページを閉じても、もう一度開いたときに続きから数える(ブラウザに保存する)

import { tr } from './i18n.js';
export const TIMER = Object.freeze({
  presets: [5, 10, 15, 30, 60],   // すぐ選べる「○分後」
  maxMinutes: 24 * 60,
  ringMs: 60 * 1000,              // 鳴きつづける長さ(止めるボタンでも止まる)
  callEveryMs: 11000,             // 鳴き声をくり返す間隔(一声は約8.5秒)
  lateLimitMs: 30 * 60 * 1000,    // これより遅れて気づいたときは、鳴らさずにお知らせだけ
  storageKey: 'whale-ocean-timer',
});

// 「○分後」の時刻(ミリ秒)
export function afterMinutes(minutes, now) {
  const m = Math.min(TIMER.maxMinutes, Math.max(1, Math.round(Number(minutes) || 0)));
  return now + m * 60 * 1000;
}

// 「○時○分」(例 "07:30")の、次に来る時刻(ミリ秒)。もう過ぎていたら明日
export function atClock(text, now) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date(now);
  d.setHours(h, min, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// 残り時間のことば(「あと1時間5分」「あと12分」「あと45秒」)
export function remainingText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return tr({ ja: `あと${s}秒`, en: `${s}s left` });
  const m = Math.ceil(s / 60);
  if (m < 60) return tr({ ja: `あと${m}分`, en: `${m} min left` });
  const h = Math.floor(m / 60), r = m % 60;
  return r ? tr({ ja: `あと${h}時間${r}分`, en: `${h} h ${r} min left` }) : tr({ ja: `あと${h}時間`, en: `${h} h left` });
}

// 鳴る時刻のことば(「7:30」)
export function clockText(at) {
  const d = new Date(at);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// いまどうするか。'wait'(まだ)・'ring'(鳴らす)・'missed'(だいぶ過ぎていた。お知らせだけ)
export function timerState(at, now) {
  if (at == null) return 'none';
  if (now < at) return 'wait';
  return now - at <= TIMER.lateLimitMs ? 'ring' : 'missed';
}

// 保存と読み出し(壊れていたら、タイマーなし)
export function loadTimer(storage) {
  try {
    const v = JSON.parse(storage.getItem(TIMER.storageKey) ?? 'null');
    return Number.isFinite(v?.at) ? { at: v.at } : null;
  } catch {
    return null;
  }
}
export function saveTimer(storage, timer) {
  try {
    if (timer) storage.setItem(TIMER.storageKey, JSON.stringify({ at: timer.at }));
    else storage.setItem(TIMER.storageKey, 'null');
  } catch {
    // 保存できなくても、開いているあいだは動く
  }
}
