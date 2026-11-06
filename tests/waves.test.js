import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_FILES, waveSound, camerasWithoutWaves } from '../src/audio/mixer.js';

test('どのカメラでも、使う波の音のファイルが決まっている(間近は水面の波、崖の上と上空は遠い波)', () => {
  for (const cam of ['cliff', 'sky', 'near']) assert.ok(SOUND_FILES[`waves-${waveSound(cam)}`], cam);
  assert.equal(waveSound('near'), 'surface');
  assert.equal(waveSound('sky'), 'cliff');
});

test('波の音が読めているなら、どのカメラでも「読み込めませんでした」にならない', () => {
  const ok = { 'waves-cliff': {}, 'waves-surface': {} };
  assert.deepEqual(camerasWithoutWaves(ok), []);
  assert.deepEqual(camerasWithoutWaves({ 'waves-cliff': {} }), ['near']);
  assert.deepEqual(camerasWithoutWaves({}), ['cliff', 'sky', 'near']);
});
