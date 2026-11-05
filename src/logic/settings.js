import { CAMERAS, DEFAULTS, MODES, STORAGE_KEY } from './config.js';

const isVolume = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

// 保存された設定を読む。読めない・壊れている項目は初期値に戻す。
export function loadSettings(storage) {
  let saved = {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw) ?? {};
  } catch {
    saved = {};
  }
  if (typeof saved !== 'object') saved = {};
  return {
    mode: MODES.includes(saved.mode) ? saved.mode : DEFAULTS.mode,
    camera: CAMERAS.includes(saved.camera) ? saved.camera : DEFAULTS.camera,
    volume: isVolume(saved.volume) ? saved.volume : DEFAULTS.volume,
  };
}

// 設定を保存する。保存できない環境でも止まらない。
export function saveSettings(storage, settings) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      mode: settings.mode,
      camera: settings.camera,
      volume: settings.volume,
    }));
  } catch {
    // プライベートブラウズなどで保存できなくても続ける
  }
}
