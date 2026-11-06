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
  saveSettings(s, { mode: 'sleep', camera: 'sky', volume: 0.3, time: 'night' });
  assert.deepEqual(loadSettings(s), { mode: 'sleep', camera: 'sky', volume: 0.3, time: 'night', place: 'okinawa' });
});

test('時間の設定は最初は自動、不正な値なら自動に戻す', () => {
  assert.equal(loadSettings(mem()).time, 'auto');
  const s = mem({ 'whale-ocean-settings': JSON.stringify({ time: 'midnight' }) });
  assert.equal(loadSettings(s).time, 'auto');
});

test('壊れたJSONなら初期設定', () => {
  assert.deepEqual(loadSettings(mem({ 'whale-ocean-settings': '{oops' })), DEFAULTS);
});

test('不正な項目だけ初期値に戻す', () => {
  const s = mem({ 'whale-ocean-settings': JSON.stringify({ mode: 'party', camera: 'near', volume: 7 }) });
  assert.deepEqual(loadSettings(s), { mode: 'normal', camera: 'near', volume: 0.5, time: 'auto', place: 'okinawa' });
});

test('storageが例外を投げても止まらない', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSettings(bad), DEFAULTS);
  assert.doesNotThrow(() => saveSettings(bad, DEFAULTS));
});

test('なくしたカメラ(船の上・浜辺・水面)が保存されていたら崖の上に戻す', () => {
  for (const camera of ['boat', 'beach', 'surface']) {
    const s = mem({ 'whale-ocean-settings': JSON.stringify({ camera }) });
    assert.equal(loadSettings(s).camera, 'cliff');
  }
});

test('場所の設定: 最初は沖縄、保存した場所を読み戻せる、知らない場所なら沖縄', () => {
  assert.equal(loadSettings(mem()).place, 'okinawa');
  const s = mem();
  saveSettings(s, { ...DEFAULTS, place: 'ogasawara' });
  assert.equal(loadSettings(s).place, 'ogasawara');
  assert.equal(loadSettings(mem({ 'whale-ocean-settings': JSON.stringify({ place: 'mars' }) })).place, 'okinawa');
});
