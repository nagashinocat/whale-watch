// 3つの定点カメラと、クジラが出る場所。three.js を読み込まない純粋なデータ(テストからも使う)。
// fov は縦の視野角(度)。sway は揺れの傾き(度)、bob は上下の揺れ幅(m)。
// whitecaps は白波の見え方(上から見るほどよく見える)。
import { nearestFullView } from '../logic/view.js';

const FOV = 55;

// 崖の上: 高さ40mから、250m先の海を見る。水平線がちゃんと見える向き
const CLIFF_HEIGHT = 40, CLIFF_LOOK = 250;

// クジラが出る場所: 崖の上から見て、クジラの動く範囲がまるごと画面に入る、いちばん近いところ
export const SPOT = Object.freeze([0, 0, -nearestFullView({ height: CLIFF_HEIGHT, targetDistance: CLIFF_LOOK, fov: FOV })]);

// 上空: 高さ80mから、クジラの場所を45度で見下ろす
const SKY_HEIGHT = 80;
// 水面すれすれ: 目の高さ0.8mで、クジラの場所をまっすぐ見る。まるごと入るいちばん近いところに置く
const SURFACE_HEIGHT = 0.8, SURFACE_LOOK = 300;
const surfaceDistance = nearestFullView({ height: SURFACE_HEIGHT, targetDistance: SURFACE_LOOK, fov: FOV });

export const CAMERA_PRESETS = Object.freeze({
  sky: Object.freeze({
    position: [0, SKY_HEIGHT, SPOT[2] + SKY_HEIGHT], target: [...SPOT], fov: FOV, sway: 0, bob: 0, whitecaps: 0.75,
  }),
  cliff: Object.freeze({
    position: [0, CLIFF_HEIGHT, 0], target: [0, 0, -CLIFF_LOOK], fov: FOV, sway: 0, bob: 0, whitecaps: 0.55,
  }),
  surface: Object.freeze({
    position: [0, SURFACE_HEIGHT, SPOT[2] + surfaceDistance],
    target: [0, 0, SPOT[2] + surfaceDistance - SURFACE_LOOK], fov: FOV, sway: 0, bob: 0, whitecaps: 0.35,
  }),
});
