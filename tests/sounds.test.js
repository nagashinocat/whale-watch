import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { SOUND_FILES } from '../src/audio/mixer.js';

test('波の音と水しぶきの音は用意したファイルを読む', () => {
  for (const name of ['waves-cliff', 'waves-surface', 'splash']) {
    const path = SOUND_FILES[name];
    assert.ok(path.endsWith('.wav'), path);
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} がない`);
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
