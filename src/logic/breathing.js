// 息つぎ(潮吹き)の回数と間隔。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・ザトウクジラは、長く潜る前に6〜7回ほど続けて潮を吹き、尾びれを上げて5〜20分潜る。
//     短く潜るだけのときは1〜2回
//   ・子クジラは母親より息が短く、母親が休んでいるあいだも何度も浮かんで息をする。
//     潜るときは母親が先に動き、子どもが合わせる
// アプリでは本物の時間のままだと長すぎるので、回数と間隔を縮めている。

export const BREATH = Object.freeze({
  blows: [3, 6],          // 潜る前の潮吹きの回数
  interval: [8, 12],      // 潮吹きの間隔(秒)
  first: 6,               // 浮かんでから最初の潮吹き(秒)
  calfScale: 0.45,        // 子クジラの潮吹きの大きさ(おとなを1として)
  gain: Object.freeze({ adult: 0.9, calf: 0.5 }),   // 息の音の大きさ
});

// 潜る前の、ひと続きの息つぎ。blows は潮吹きの時刻、round は背中を丸める時刻、dive は尾びれを上げて潜る時刻
export function diveSurfacing(rng = Math.random) {
  const [lo, hi] = BREATH.blows;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const blows = [BREATH.first];
  for (let i = 1; i < n; i++) {
    blows.push(blows[i - 1] + BREATH.interval[0] + rng() * (BREATH.interval[1] - BREATH.interval[0]));
  }
  const round = blows[n - 1] + 3;
  return { blows, round, dive: round + 4 };
}

// 親子の出方(60秒)の息つぎ。母親は2回、子どもは12秒ごとくらいに何度も
export function calfBreaths() {
  return { mother: [11, 33], calf: [7, 18, 29, 40, 50] };
}

// 息つぎのときの、水面を「転がる」ような浮かび方。
// 調べてわかったこと: ゆっくり泳ぎながら息をするザトウクジラは、まず頭(鼻の穴とその前の盛り上がり)が出て潮を吹き、
// 頭が沈みはじめると背中が弓なりに水面を転がるように出て、そのあと背びれが見え、尾の付け根が少し丸く出て沈む。
// アプリでは、体を少しずつ前に傾けながら(頭が上 → 水平 → 頭が下)浮いて沈むことで、頭・背中・背びれの順に見せる。
// lead: 潮吹きの何秒前から浮かびはじめるか / follow: 潮吹きのあと沈みきるまで / angle: いちばん傾くときの角度(度)
export const ROLL = Object.freeze({ lead: 2.2, follow: 5.5, angle: 7 });

// t 秒目の浮かび具合。blows は潮吹きの時刻。lift は 0(浅く沈んでいる)〜1(背中が出ている)、pitch は頭の上がり(度)
// holdLast: 最後の潮吹きのあとは沈まずに水面にとどまる(そのあと背中を丸めて尾びれを上げて潜るため)
export function rollingSurfacing(t, blows, roll = ROLL, { holdLast = false } = {}) {
  const span = roll.lead + roll.follow;
  const last = blows[blows.length - 1];
  for (const b of blows) {
    const k = (t - (b - roll.lead)) / span;
    if (holdLast && b === last && k >= 0.5) return { lift: 1, pitch: 0 };
    if (k > 0 && k < 1) return { lift: Math.sin(Math.PI * k), pitch: roll.angle * Math.sin(2 * Math.PI * k) };
  }
  return { lift: 0, pitch: 0 };
}
