// 3つの定点カメラ。three.js を読み込まない純粋なデータ(テストからも使う)。
// fov は縦の視野角(度)。sway は揺れの傾き(度)、bob は上下の揺れ幅(m)。

const TARGET = [0, 0, -500];

export const CAMERA_PRESETS = Object.freeze({
  // 上空: 崖の上よりずっと高いところから、海を見下ろす
  sky: Object.freeze({ position: [0, 150, 0], target: [0, 0, -420], fov: 55, sway: 0, bob: 0 }),
  cliff: Object.freeze({ position: [0, 40, 0], target: TARGET, fov: 55, sway: 0, bob: 0 }),
  surface: Object.freeze({ position: [0, 0.6, 0], target: TARGET, fov: 55, sway: 0, bob: 0 }),
});
