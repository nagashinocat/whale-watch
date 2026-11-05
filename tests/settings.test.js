import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings } from '../src/logic/settings.js';
import { DEFAULTS } from '../src/logic/config.js';

const mem = (init = {}) => {
  const d = { ...init };
  return { getItem: k => d[k] ?? null, setItem: (k, v) => { d[k] = v; } };
};

test('何も保存されていなければ初期設定', () => {
  assert.deepEqual(loadSettings(mem()), DEFAULTS);
});

test('保存した設定を読み戻せる', () => {
  const s = mem();
  saveSettings(s, { mode: 'sleep', camera: 'beach', volume: 0.3 });
  assert.deepEqual(loadSettings(s), { mode: 'sleep', camera: 'beach', volume: 0.3 });
});

test('壊れたJSONなら初期設定', () => {
  assert.deepEqual(loadSettings(mem({ 'whale-ocean-settings': '{oops' })), DEFAULTS);
});

test('不正な項目だけ初期値に戻す', () => {
  const s = mem({ 'whale-ocean-settings': JSON.stringify({ mode: 'party', camera: 'beach', volume: 7 }) });
  assert.deepEqual(loadSettings(s), { mode: 'normal', camera: 'beach', volume: 0.5 });
});

test('storageが例外を投げても止まらない', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSettings(bad), DEFAULTS);
  assert.doesNotThrow(() => saveSettings(bad, DEFAULTS));
});
