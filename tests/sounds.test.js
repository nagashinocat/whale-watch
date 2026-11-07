import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { SOUND_FILES } from '../src/audio/mixer.js';

test('波の音と水しぶきの音は用意したファイルを読む(軽い m4a と予備の wav)', () => {
  for (const name of ['waves-cliff', 'waves-surface', 'splash']) {
    const path = SOUND_FILES[name];
    assert.ok(path.endsWith('.m4a'), path);
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} がない`);
    // 読めないブラウザのための予備の wav もある
    assert.ok(existsSync(new URL(`../${path.replace(/\.m4a$/, '.wav')}`, import.meta.url)), `${path} の予備がない`);
  }
});

test('公開できる大きさ(1つ15MBまで)に収まっている', () => {
  for (const path of Object.values(SOUND_FILES)) {
    const url = new URL(`../${path}`, import.meta.url);
    if (existsSync(url)) assert.ok(statSync(url).size < 15 * 1024 * 1024, path);
  }
});

test('クジラの声のファイルがそろっている', () => {
  for (const name of ['humpback', 'humpback-call', 'sperm']) {
    const path = SOUND_FILES[name];
    assert.ok(path, `${name} がない`);
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} がない`);
  }
});

test('公開用の音は、全部あわせて4MBより軽い(最初の読みこみが速い)', () => {
  let total = 0;
  for (const path of Object.values(SOUND_FILES)) total += statSync(new URL(`../${path}`, import.meta.url)).size;
  assert.ok(total < 4 * 1024 * 1024, `${(total / 1024 / 1024).toFixed(1)}MB`);
});

test('波の音の重ねるつなぎ目は、音の大きさが変わらない(sin² + cos² = 1)', async () => {
  const { crossfadeCurve } = await import('../src/audio/mixer.js');
  const up = crossfadeCurve(33, true), down = crossfadeCurve(33, false);
  assert.equal(up[0], 0); assert.ok(Math.abs(up[32] - 1) < 1e-6);
  for (let i = 0; i < 33; i++) assert.ok(Math.abs(up[i] ** 2 + down[i] ** 2 - 1) < 1e-6);
});
