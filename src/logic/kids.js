// 子供用モードの決まり。three.js も、ブラウザの保存場所も直接は使わない(テストからも使う)。
// ボタンで何頭でもクジラを呼べて(海にいるのは6頭まで)、出方はランダム。図鑑・点数・実績はお休みで、写真だけ撮れる。
import { PATTERNS } from './patterns.js';
import { SPOT } from '../scene/cameras.js';

export const KIDS = Object.freeze({
  storageKey: 'whale-ocean-kids',
  maxWhales: 6,        // 一度に海にいられるクジラ(こえたら、古いクジラから潜っていなくなる)
  exitHoldMs: 2000,    // ふつうのモードにもどるときの長押し(子どもがうっかりもどらないように)
  callGapMs: 700,      // 連打しても、この間隔より早くは呼ばない(重くならないように)
  sinkSec: 1.6,        // 潜っていなくなるまでの時間
  // 呼ぶたびにずらす出る場所(いつもの場所からの、横・奥のずれ m)。どれも3つのカメラから見える
  offsets: Object.freeze([[0, 0], [-10, -30], [10, -30], [-16, -60], [16, -60], [0, -90]]),
});

// 子供用モードで出る出方: 姿が見えるもの。鳴き声だけ・呼んだクジラ(長い)・寝ているクジラ(動かない)・
// 目が合う(カメラのすぐ前に来るので、何頭もいると重なる)は出さない
const LEFT_OUT = ['summon', 'sleeping', 'eyeContact'];
export const KIDS_PATTERNS = Object.freeze(Object.keys(PATTERNS).filter(n => PATTERNS[n].needs && !LEFT_OUT.includes(n)));

// ランダムな出方。さっき出た2つは続けて出さない
export function pickKidsPattern(rng = Math.random, recent = []) {
  const last = recent.slice(-2);
  const pool = KIDS_PATTERNS.filter(n => !last.includes(n));
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

// n 回目に呼んだクジラの出る場所
export function kidsPosition(n) {
  const [dx, dz] = KIDS.offsets[((n % KIDS.offsets.length) + KIDS.offsets.length) % KIDS.offsets.length];
  return [SPOT[0] + dx, SPOT[1], SPOT[2] + dz];
}

// いま海にいる active 頭に、incoming 頭の出方を呼ぶとき、潜ってもらう頭数
export function whalesToRemove(active, incoming, max = KIDS.maxWhales) {
  return Math.min(active, Math.max(0, active + Math.min(incoming, max) - max));
}

export function loadKids(storage) {
  try {
    const v = JSON.parse(storage.getItem(KIDS.storageKey) || 'null');
    return { on: v?.on === true };
  } catch {
    return { on: false };
  }
}

export function saveKids(storage, state) {
  try { storage.setItem(KIDS.storageKey, JSON.stringify({ on: state.on === true })); } catch { /* 保存できなくても続ける */ }
}
