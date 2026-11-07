// 仕様で決まった数値と名前をまとめる場所。
// 調整したいときはここを変える。

export const MODES = ['sleep', 'normal'];

export const CAMERAS = ['sky', 'cliff', 'near'];

import { SKY_MOMENTS } from './skyPalette.js';

// 空の時間帯。auto は実際の時刻、それ以外はその時刻(時)に固定する。
// golden(ゴールデンアワー)と blue(ブルーアワー)は特別にきれいな時間
export const TIME_PRESETS = Object.freeze({
  auto: null,
  morning: 7,
  day: 12,
  evening: SKY_MOMENTS.sunset,
  night: 22,
  golden: SKY_MOMENTS.golden,
  blue: SKY_MOMENTS.blue,
});


export const DEFAULTS = Object.freeze({ mode: 'normal', camera: 'cliff', volume: 0.5, time: 'auto', interval: 'normal' });

// クジラが自然に来る間隔(分)。自分で選べる。前のクジラが帰ってから、min〜max 分のどこかで次が来る
export const INTERVALS = Object.freeze({
  often: Object.freeze({ label: 'よく来る', min: 5, max: 15 }),
  more: Object.freeze({ label: '多め', min: 15, max: 45 }),
  normal: Object.freeze({ label: 'ふつう', min: 30, max: 90 }),
  rare: Object.freeze({ label: 'ときどき', min: 60, max: 180 }),
});

export const SCHEDULE = Object.freeze({
  minIntervalMs: 30 * 60 * 1000,
  maxIntervalMs: 90 * 60 * 1000,
  weights: Object.freeze({
    voice: 25,
    spout: 20,
    fluke: 15,
    motherCalf: 10,
    sleeping: 10,
    // ジャンプは見ごたえがあるが、多すぎると落ち着かないので少なめ
    breach: 12,
    // 子育ての海でよく見られる群れ(母親・子ども・付きそい)と、子どものジャンプの練習
    pod: 10,
    calfBreach: 6,
    // 群れでならんで跳ぶのは、まれ
    groupBreach: 2,
    groupSpyhop: 3,
    // 近くで見ると迫力のある出方(ときどき)
    spyhop: 5,
    pecSlap: 5,
    lobtail: 5,
    // 間近のカメラのすぐ前まで来て、目が合う(めったにない)
    eyeContact: 3,
    // 捕食。沖縄の海は子育ての場所で、ザトウクジラはほとんど食べない(えさは夏に北の海で食べる)ので、ごくまれ
    feeding: 2,
    bubbleNet: 1,
  }),
});

export const SUMMON = Object.freeze({ minDelayMs: 10 * 1000, maxDelayMs: 30 * 1000 });

export const AUDIO = Object.freeze({ whaleMaxRatio: 0.8, fadeMs: 3000 });

export const MENU_HIDE_MS = 4000;

export const STORAGE_KEY = 'whale-ocean-settings';
