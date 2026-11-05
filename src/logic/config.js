// 仕様で決まった数値と名前をまとめる場所。
// 調整したいときはここを変える。

export const MODES = ['sleep', 'normal'];

export const CAMERAS = ['cliff', 'boat', 'beach', 'surface'];

export const DEFAULTS = Object.freeze({ mode: 'normal', camera: 'cliff', volume: 0.5 });

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
  }),
});

export const SUMMON = Object.freeze({ minDelayMs: 10 * 1000, maxDelayMs: 30 * 1000 });

export const AUDIO = Object.freeze({ whaleMaxRatio: 0.8, fadeMs: 3000 });

export const MENU_HIDE_MS = 4000;

export const STORAGE_KEY = 'whale-ocean-settings';
