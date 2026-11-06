// クジラを照らす光の向き。three.js は使わない(テストからも使う)。
//
// 写真家がクジラを見分けるために撮るときは、太陽を背にして撮る(順光)。
// 太陽が正面にあると(逆光)、こちらを向いた尾びれの裏や体の横に光が当たらず、黒い影になってしまう。
// このアプリのカメラは、夕日が正面に沈む向きなので、昼すぎから夕方は逆光になる。
// そこで、空の太陽(夕日や海の光の道)はそのままにして、クジラを照らす光だけを、
// カメラをはさんで反対側(うしろ)へ鏡に映すように移す。本物の太陽の向きからは、ふちを照らす弱い光を当てる。

export const LIGHTING = Object.freeze({
  minElevation: 20,   // 照らす光の、いちばん低い高さ(度)
  key: 1.5,           // 正面から照らす光の強さ
  rim: 0.6,           // 本物の太陽の向きからの、ふちの光の強さ
});

const norm = v => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };

// sun: 太陽(夜は月)の向き、forward: カメラの向いている向き。どちらも [x, y, z]
// key: クジラを照らす光の向き、rim: ふちを照らす光の向き
export function whaleLights(sun, forward) {
  const s = norm(sun);
  const f = norm([forward[0], 0, forward[2]]);   // 水平の向き
  const ahead = s[0] * f[0] + s[2] * f[2];
  let h = [s[0], 0, s[2]];
  // 正面側にあるなら、カメラをはさんで反対側へ(横の向きと高さはそのまま)
  if (ahead > 0) h = [h[0] - 2 * ahead * f[0], 0, h[2] - 2 * ahead * f[2]];
  const hl = Math.hypot(h[0], h[2]) || 1;
  const el = Math.max(Math.asin(Math.max(-1, Math.min(1, s[1]))), (LIGHTING.minElevation * Math.PI) / 180);
  const key = [(h[0] / hl) * Math.cos(el), Math.sin(el), (h[2] / hl) * Math.cos(el)];
  return { key, rim: s };
}
