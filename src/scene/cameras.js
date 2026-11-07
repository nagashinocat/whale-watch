// 3つの定点カメラ(上空・崖の上・間近)と、クジラが出る場所。three.js を読み込まない純粋なデータ(テストからも使う)。
// fov は縦の視野角(度)。sway は揺れの傾き(度)、bob は上下の揺れ幅(m)。
// whitecaps は白波の見え方(上から見るほどよく見える)。
import { nearestCenteredView } from '../logic/view.js';

const FOV = 55;

// 崖の上: 高さ15mの低めの崖から、クジラが出る場所にまっすぐ向けて見る。
// クジラが画面のまん中に来て、水平線は画面の上から3分の1くらいのところに見える
export const CLIFF_HEIGHT = 15;

// クジラが出る場所: 崖の上からまっすぐ見て、クジラの動く範囲がまるごと画面に入る、いちばん近いところ。
// 動作確認のページでは window.WHALE_TEST_SPOT(崖からの距離 m)で、ためしに場所を変えられる
const TEST_SPOT = typeof globalThis.WHALE_TEST_SPOT === 'number' ? globalThis.WHALE_TEST_SPOT : null;
export const SPOT = Object.freeze([0, 0, -(TEST_SPOT ?? nearestCenteredView({ height: CLIFF_HEIGHT, fov: FOV }))]);

// 上空: 高さ80mから、クジラの場所を45度で見下ろす
const SKY_HEIGHT = 80;

export const CAMERA_PRESETS = Object.freeze({
  sky: Object.freeze({
    position: [0, SKY_HEIGHT, SPOT[2] + SKY_HEIGHT], target: [...SPOT], fov: FOV, sway: 0, bob: 0, whitecaps: 0.75,
  }),
  cliff: Object.freeze({
    // クジラが出る場所が、画面のまん中に来る向き
    position: [0, CLIFF_HEIGHT, 0],
    target: [...SPOT],
    fov: FOV, sway: 0, bob: 0, whitecaps: 0.55,
  }),
  // 間近: 水面の高さから、クジラの20m手前で少し見上げる。大きなものは見上げると大きく感じる
  near: Object.freeze({
    position: [SPOT[0], 0.9, SPOT[2] + 20], target: [SPOT[0], 2.2, SPOT[2] - 60], fov: FOV, sway: 0, bob: 0, whitecaps: 0.3,
  }),
});
