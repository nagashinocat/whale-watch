// 4つの定点カメラ。three.js を読み込まない純粋なデータ(テストからも使う)。
// fov は縦の視野角(度)。sway は揺れの傾き(度)、bob は上下の揺れ幅(m)。

const TARGET = [0, 0, -500];

export const CAMERA_PRESETS = Object.freeze({
  cliff: Object.freeze({ position: [0, 40, 0], target: TARGET, fov: 55, sway: 0, bob: 0 }),
  boat: Object.freeze({ position: [0, 4, 0], target: TARGET, fov: 55, sway: 1.5, bob: 0.3 }),
  beach: Object.freeze({ position: [0, 2, 60], target: TARGET, fov: 55, sway: 0, bob: 0 }),
  surface: Object.freeze({ position: [0, 0.4, 0], target: TARGET, fov: 55, sway: 1.2, bob: 0.2 }),
});
