import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WHALE_BOX, boxCorners, nearestFullView } from '../src/logic/view.js';
import { CAMERA_PRESETS, SPOT } from '../src/scene/cameras.js';
import { isVisibleFrom, spawnPosition } from '../src/logic/spawn.js';

const visibleAll = (preset, spot) => boxCorners(spot).every(p => isVisibleFrom(preset, p));

test('クジラの動く範囲には、体の長さ・ジャンプの高さ・泳ぐ距離が入っている', () => {
  assert.ok(WHALE_BOX.halfWidth >= 14 / 2 + 10, 'length + travel');
  assert.ok(WHALE_BOX.up >= 6.6, 'breach top');
});

test('崖の上から、クジラの動く範囲がまるごと見えるいちばん近い場所にクジラが出る', () => {
  const cliff = CAMERA_PRESETS.cliff;
  assert.ok(visibleAll(cliff, SPOT), 'fits');
  // 1m 近づくと、はみ出す
  assert.ok(!visibleAll(cliff, [SPOT[0], 0, SPOT[2] + 1]), 'nearest');
  assert.ok(-SPOT[2] < 120, `close enough: ${-SPOT[2]}m`);
});

test('上空からも、その場所がまるごと見える(間近はわざと画面からはみ出すくらい近い)', () => {
  for (const name of ['sky']) {
    assert.ok(visibleAll(CAMERA_PRESETS[name], SPOT), name);
  }
});

test('上空は崖の上より高い', () => {
  assert.ok(CAMERA_PRESETS.sky.position[1] > CAMERA_PRESETS.cliff.position[1]);
});

test('クジラはいつもその場所に出る', () => {
  for (let i = 0; i < 20; i++) assert.deepEqual(spawnPosition(Math.random), SPOT);
});

test('いちばん近い距離の計算: 横長の画面のほうが横に広く見えるので、近くまで入る', () => {
  const portrait = nearestFullView({ height: 40, targetDistance: 250, fov: 55, aspect: 9 / 16 });
  const landscape = nearestFullView({ height: 40, targetDistance: 250, fov: 55, aspect: 16 / 9 });
  assert.ok(landscape < portrait, `landscape ${landscape} portrait ${portrait}`);
});

test('「間近」の視点: 水面の高さから、クジラの場所を少し見上げる。20mくらいまで近い', () => {
  const near = CAMERA_PRESETS.near;
  assert.ok(near, 'near camera');
  assert.ok(near.position[1] < 2, 'eye at water level');
  const dist = Math.hypot(near.position[0] - SPOT[0], near.position[2] - SPOT[2]);
  assert.ok(dist >= 15 && dist <= 25, `distance ${dist}`);
  assert.ok(near.target[1] > near.position[1], 'looks slightly up');
  // ジャンプのいちばん高いところ(6m)も画面に入る
  assert.ok(isVisibleFrom(near, [SPOT[0], 6, SPOT[2]]));
});
