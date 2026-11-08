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
  saveSettings(s, { mode: 'sleep', camera: 'sky', volume: 0.3, time: 'custom', hours: 16.25, interval: 'often', shutter: 'right', lang: 'en', whisper: false, hydrophone: true, herald: true });
  assert.deepEqual(loadSettings(s), { mode: 'sleep', camera: 'sky', volume: 0.3, time: 'custom', hours: 16.25, interval: 'often', shutter: 'right', lang: 'en', whisper: false, hydrophone: true, herald: true });
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
  assert.deepEqual(loadSettings(s), { mode: 'normal', camera: 'near', volume: 0.5, time: 'auto', hours: 12, interval: 'often', shutter: 'center', lang: 'auto', whisper: true, hydrophone: false, herald: false });
});

test('来る間隔は最初は「ふつう」、知らない値なら「ふつう」に戻す', () => {
  assert.equal(loadSettings(mem()).interval, 'often');   // はじめは「よく来る」から
  assert.equal(loadSettings(mem({ 'whale-ocean-settings': JSON.stringify({ interval: 'always' }) })).interval, 'often');
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

test('来る間隔のことば', async () => {
  const { rangeLabel } = await import('../src/ui/menu.js');
  const { INTERVALS } = await import('../src/logic/config.js');
  assert.equal(rangeLabel(INTERVALS.often), '3〜5分');
  assert.equal(rangeLabel(INTERVALS.rare), '1〜3時間');
});

test('写真のボタンの場所は最初は真ん中、知らない値なら真ん中に戻す', () => {
  assert.equal(loadSettings(mem()).shutter, 'center');
  assert.equal(loadSettings(mem({ 'whale-ocean-settings': JSON.stringify({ shutter: 'top' }) })).shutter, 'center');
  for (const k of ['left', 'center', 'right', 'off']) assert.equal(loadSettings(mem({ 'whale-ocean-settings': JSON.stringify({ shutter: k }) })).shutter, k);
});

test('親子のささやきは最初はオン、水中マイクは最初はオフ。おかしな値なら初期値', () => {
  assert.equal(loadSettings(mem()).whisper, true);
  assert.equal(loadSettings(mem()).hydrophone, false);
  const s = mem({ 'whale-ocean-settings': JSON.stringify({ whisper: 'yes', hydrophone: 1 }) });
  assert.equal(loadSettings(s).whisper, true);
  assert.equal(loadSettings(s).hydrophone, false);
});

test('バーで決めた時刻は 5〜23時。おかしな値ならお昼にもどす', () => {
  assert.equal(loadSettings(mem({ 'whale-ocean-settings': JSON.stringify({ time: 'custom', hours: 30 }) })).hours, 12);
  assert.equal(loadSettings(mem({ 'whale-ocean-settings': JSON.stringify({ time: 'custom', hours: 'x' }) })).hours, 12);
});
