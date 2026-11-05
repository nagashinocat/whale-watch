import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnPosition, isVisibleFrom } from '../src/logic/spawn.js';
import { CAMERA_PRESETS } from '../src/scene/cameras.js';

test('出現位置はどのカメラからも縦長画面で見える', () => {
  let s = 42; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2000; i++) {
    const p = spawnPosition(rng);
    for (const preset of Object.values(CAMERA_PRESETS)) assert.ok(isVisibleFrom(preset, p), JSON.stringify(p));
  }
});

test('カメラの真後ろや画面の外は見えない扱い', () => {
  const cliff = CAMERA_PRESETS.cliff;
  assert.equal(isVisibleFrom(cliff, [0, 0, 300]), false);
  assert.equal(isVisibleFrom(cliff, [400, 0, -300]), false);
});

test('カメラは上空・崖の上・水面の3つで、上空は崖の上より高い', () => {
  assert.deepEqual(Object.keys(CAMERA_PRESETS).sort(), ['cliff', 'sky', 'surface']);
  assert.ok(CAMERA_PRESETS.sky.position[1] > CAMERA_PRESETS.cliff.position[1]);
});
