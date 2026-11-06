// 仕様で決まった数値と名前をまとめる場所。
// 調整したいときはここを変える。

export const MODES = ['sleep', 'normal'];

export const CAMERAS = ['sky', 'cliff', 'surface', 'near'];

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

export const DEFAULTS = Object.freeze({ mode: 'normal', camera: 'cliff', volume: 0.5, time: 'auto' });

export const SCHEDULE = Object.freeze({
  minIntervalMs: 30 * 60 * 1000,
  maxIntervalMs: 90 * 60 * 1000,
  weights: Object.freeze({
    voice: 25,
    spout: 20,
    fluke: 15,
    motherCalf: 10,
    sleeping: 10,
    breach: 20,
    // 近くで見ると迫力のある出方(ときどき)
    spyhop: 5,
    pecSlap: 5,
    lobtail: 5,
  }),
});

export const SUMMON = Object.freeze({ minDelayMs: 10 * 1000, maxDelayMs: 30 * 1000 });

export const AUDIO = Object.freeze({ whaleMaxRatio: 0.8, fadeMs: 3000 });

export const MENU_HIDE_MS = 4000;

export const STORAGE_KEY = 'whale-ocean-settings';
