// クジラが水面をたたいたときの水しぶきの大きさを、体の重さと落ちてくる速さから計算する。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・ザトウクジラのジャンプ(記録計の研究、おとな46回): 水から飛び出す速さは秒速6.1m(2.6〜8.9m)、
//     体の6割ほど(26〜100%)が水から出る。14.7mのクジラ(約46トン)が体の84%を出すジャンプで、使う力は約10メガジュール
//   ・ものが水に落ちたときの水しぶきの高さは「落ちてきた速さで、どこまで上がれるか(速さ²÷(2×重力))」に比例し、
//     水と同じくらいの重さのもの(クジラの体)では、その約3分の2(重さの比 1/(1+0.5))になる
//   ・平らな面(わき腹・胸びれ・尾びれ)で水面をたたくと、水は横へ押しのけられ、落ちてきた速さより速いしぶきになって飛ぶ
//   ・大きなものが落ちると、水に穴があき、まわりの水が王冠のような膜になって上がる。
//     少しあとに穴がふさがり、まん中から水の柱が立つ。落ちたところからは、輪になった波が広がる
// 重さ(kg)と速さ(m/秒)から、王冠の高さ・水の量(粒の数)・泡の広さ・波の輪を決める

const G = 9.8;

export const IMPACT = Object.freeze({
  // 平らな面でたたいたときの、しぶきの速さの倍率(落ちてきた速さに対して)
  gain: Object.freeze({ body: 1.7, fin: 1.6, fluke: 1.5 }),
  density: 1 / (1 + 0.5),      // 体の重さの比(ほぼ水と同じ)による、しぶきの高さの割合
  // くらべる基準: 14mのおとなが秒速7mで横倒しに落ちる(約28トン → 約0.7メガジュール)
  refEnergy: 0.5 * 28500 * 7 * 7,
  maxCrown: 14,                // 王冠のいちばん高いところ(m)
  particles: 5200,             // 基準の強さのときの粒の数(全部で)
  maxParticles: 6500,          // 1回の水しぶきで使う粒の上限(スマホで重くならないように)
});

// 体の重さ(kg)。図鑑と同じ式(15mで35トン、体長の3乗に比例)
export const whaleMass = lengthMeters => 35000 * (lengthMeters / 15) ** 3;
// 体の一部でたたくときに、いっしょに動く重さの割合(資料がなかったので、ひれの大きさから見積もっている)
export const PART_MASS = Object.freeze({ fin: 0.03, fluke: 0.06 });

// 水しぶきの形と量。mass: 重さ(kg) / speed: 水面に当たる速さ(m/秒、下向き) /
// length・width: 水面に当たる面の長さと幅(m) / surface: body・fin・fluke(平らな面の種類)
export function impactSplash({ mass, speed, length, width, surface = 'body' }) {
  const v = Math.max(0.5, speed);
  const energy = 0.5 * mass * v * v;
  const strength = Math.sqrt(energy / IMPACT.refEnergy);
  const sheet = IMPACT.gain[surface] * v;                       // しぶきが飛び出す速さ
  const crownHeight = Math.min(IMPACT.maxCrown, IMPACT.density * (sheet * sheet) / (2 * G));
  const total = Math.min(IMPACT.maxParticles, Math.max(120, IMPACT.particles * strength));
  // 大きなものほど、穴がふさがってできる水の柱が立つ(ひれの小さなしぶきでは立たない)
  const column = surface === 'body' && strength > 0.25;
  // 落ちたところから広がる波の輪。波の速さは √(重力×波長÷2π)。波長は当たった面の幅の2倍くらい
  const wavelength = Math.max(2, width * 2);
  return {
    energy, strength, crownHeight,
    length: length + 1.5, width: width * 1.6 + 1,
    outward: 0.32 * sheet,
    crown: Math.round(total * 0.36), droplets: Math.round(total * 0.3), mist: Math.round(total * (column ? 0.22 : 0.34)),
    column: column ? Math.round(total * 0.12) : 0, columnHeight: crownHeight * 0.75,
    // 穴がふさがるまでの時間(穴の深さ ≒ 幅 のところから、水が落ちこむ時間)
    columnDelay: 0.35 + Math.sqrt((2 * Math.max(1, width)) / G),
    mistHeight: Math.min(6, crownHeight * 0.5),
    dropSize: 0.25 + 0.35 * Math.min(1.5, strength),
    waveSpeed: Math.sqrt((G * wavelength) / (2 * Math.PI)),
    foamRadius: Math.max(1.5, 0.45 * length * Math.min(1.3, 0.6 + 0.4 * strength)),
    foamMs: 6000 + 22000 * Math.min(1.4, strength),
    shake: Math.min(1, strength),
  };
}
