// ザトウクジラ1頭ずつの、ひと目でわかる個性(体の色・胸びれ・背びれ・尾びれの欠け・傷・大きさ)。
// three.js も、体の形のファイルも使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・真っ白なザトウクジラもいる。オーストラリアの「ミガルー」はアルビノ(色のもとが作れない)で全身が白い。
//     ノルウェーやコスタリカなどでも白い子どもやおとなが見つかっているが、とてもめずらしい
//   ・北半球のザトウクジラは体がほとんど黒く、のど・おなか・胸びれの白さは1頭ずつちがう。
//     胸びれの表はたいてい白いが、黒い子もいる(南半球に多い)
//   ・見分けの目印: 尾びれのうしろのふちの大きな欠け、尾びれの先のフジツボのかたまり、
//     船のスクリューの傷、シャチの歯のあと、背びれの形と傷(オスどうしの争いでつく)
//
// 色は sRGB の [r, g, b](0〜1)。u は体の前(頭 0)から後ろ(尾 1)、θ は背中 0 から右回り

import { tr } from './i18n.js';
import { SPECIAL, specialBodyColor, SPECIAL_BLACK } from './specialCoats.js';

const isSpecial = ind => SPECIAL.coats.includes(ind.traits?.coat);

const clamp01 = x => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = c => 0.3 * c[0] + 0.6 * c[1] + 0.1 * c[2];

const BLACK = [0x16 / 255, 0x18 / 255, 0x1b / 255];
const WHITE = [0xe6 / 255, 0xe8 / 255, 0xea / 255];
const ALBINO = [0.93, 0.92, 0.9];
const PINK = [0.95, 0.8, 0.78];
const SCAR = [0.8, 0.8, 0.78];
const BARNACLE = [0xd9 / 255, 0xd4 / 255, 0xc8 / 255];

// 個性の種類(normal は「とくになし」)
export const TRAITS = Object.freeze({
  coat: ['normal', 'white', 'dark', 'pale'],
  pec: ['normal', 'darkTop'],
  dorsal: ['normal', 'hook', 'knob', 'nick'],
  fluke: ['normal', 'bite'],
  scars: ['normal', 'propeller'],
  barnacles: ['normal', 'many'],
  size: ['normal', 'big', 'small'],
});

// 出やすさ(normal 以外)。真っ白は1頭だけ(population で決める)
const CHANCE = { coat: { dark: 0.14, pale: 0.12 }, pec: { darkTop: 0.15 }, dorsal: { hook: 0.13, knob: 0.11, nick: 0.11 },
  fluke: { bite: 0.14 }, scars: { propeller: 0.09 }, barnacles: { many: 0.18 }, size: { big: 0.13, small: 0.12 } };

// 乱数から個性を決める
export function rollTraits(rng) {
  const t = {};
  for (const key of Object.keys(TRAITS)) {
    let r = rng();
    t[key] = 'normal';
    for (const [v, p] of Object.entries(CHANCE[key] ?? {})) { if (r < p) { t[key] = v; break; } r -= p; }
  }
  t.bitePlace = (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.4);   // 尾びれの欠けの場所
  t.scarAngle = 0.6 + rng() * 0.5;                              // スクリューの傷のかたむき
  return t;
}

// 大きさの倍率
export const sizeOf = ind => ({ big: 1.1, small: 0.9 }[ind.traits?.size] ?? 1);

// 個性の説明(図鑑に出す)。とくにないものは出さない
export function traitsText(ind) {
  const t = ind.traits ?? {};
  const out = [];
  if (t.coat === 'white') out.push(tr({ ja: '全身が真っ白(とてもめずらしい)', en: 'Pure white all over (extremely rare)' }));
  if (t.coat === 'galaxy') out.push(tr({ ja: '全身が真っ黒で、わき腹に銀河のうずと星(夜に光る)', en: 'Jet black, with spiral galaxies and stars on its sides (they glow at night)' }));
  if (t.coat === 'comet') out.push(tr({ ja: '全身が真っ黒で、両わきに尾を引く彗星(夜に光る)', en: 'Jet black, with a comet streaking down each side (it glows at night)' }));
  if (t.coat === 'fireworks') out.push(tr({ ja: '全身が真っ黒で、体じゅうに打ち上げ花火(夜に光る)', en: 'Jet black, covered in bursting fireworks (they glow at night)' }));
  if (t.coat === 'dark') out.push(tr({ ja: 'おなかまで黒い', en: 'Dark even on the belly' }));
  if (t.coat === 'pale') out.push(tr({ ja: 'おなかの白がわき腹まで広い', en: 'White belly reaching far up the sides' }));
  if (t.pec === 'darkTop') out.push(tr({ ja: '胸びれの表が黒い', en: 'Dark upper side of the flippers' }));
  if (t.dorsal === 'hook') out.push(tr({ ja: '背びれがかぎ形にとがっている', en: 'Sharply hooked dorsal fin' }));
  if (t.dorsal === 'knob') out.push(tr({ ja: '背びれが小さなこぶ', en: 'Dorsal fin is just a small knob' }));
  if (t.dorsal === 'nick') out.push(tr({ ja: '背びれの先が欠けている', en: 'Tip of the dorsal fin is missing' }));
  if (t.fluke === 'bite') out.push(tr({ ja: '尾びれのうしろのふちが大きく欠けている', en: 'Big chunk missing from the fluke edge' }));
  if (t.scars === 'propeller') out.push(tr({ ja: '背中に船のスクリューの傷', en: 'Propeller scars on the back' }));
  if (t.barnacles === 'many') out.push(tr({ ja: 'フジツボがたくさん付いている', en: 'Covered in barnacles' }));
  if (t.size === 'big') out.push(tr({ ja: '体が大きい', en: 'Large body' }));
  if (t.size === 'small') out.push(tr({ ja: '体が小さめ', en: 'Small body' }));
  return out;
}

// 名前に使う言葉(いちばん目立つ個性)
export function traitWord(ind) {
  const t = ind.traits ?? {};
  const w = (ja, en) => tr({ ja, en });
  if (t.coat === 'white') return w('ユキ', 'Snow');
  if (t.coat === 'galaxy') return w('ギンガ', 'Galaxy');
  if (t.coat === 'comet') return w('ホウキボシ', 'Comet');
  if (t.coat === 'fireworks') return w('ハナビ', 'Firework');
  if (t.scars === 'propeller') return w('キズ', 'Scar');
  if (t.fluke === 'bite') return w('カケオ', 'Notch');
  return { hook: w('カギ', 'Hook'), knob: w('コブ', 'Knob'), nick: w('ハカケ', 'Chip') }[t.dorsal]
    ?? { dark: w('クロハラ', 'Darkbelly'), pale: w('シロハラ', 'Palebelly') }[t.coat]
    ?? (t.pec === 'darkTop' ? w('クロテ', 'Darkfin') : null)
    ?? (t.barnacles === 'many' ? w('フジツボ', 'Barnacle') : null)
    ?? ({ big: w('オオ', 'Big'), small: w('チビ', 'Tiny') }[t.size] ?? '');
}

// 背びれの高さ(体長1)。variant: normal・hook(かぎ形)・knob(小さなこぶ)・nick(先が欠けている)
export function dorsalRiseFor(variant, u) {
  if (variant === 'hook') {
    // 高く、先がうしろへとがって曲がる(うしろのふちは切り立つ)
    const fin = u < 0.678 ? smoothstep(0.6, 0.678, u) ** 1.8 : 1 - smoothstep(0.678, 0.686, u);
    return 0.036 * fin + 0.004 * bump(u, 0.645, 0.04);
  }
  if (variant === 'knob') return 0.008 * bump(u, 0.655, 0.016) + 0.003 * bump(u, 0.64, 0.035);
  const fin = u < 0.665 ? smoothstep(0.6, 0.665, u) : 1 - smoothstep(0.665, 0.69, u);
  const h = 0.02 * fin + 0.005 * bump(u, 0.645, 0.04);
  // 先が欠けた背びれは、上が平らに切れていて、まん中にV字の切れこみがある
  if (variant === 'nick') return Math.min(h, 0.0135) - 0.006 * bump(u, 0.664, 0.004) * smoothstep(0.62, 0.65, u);
  return h;
}

// 体の色に個性を重ねる
export function traitBodyColor(ind, u, theta, c) {
  const t = ind.traits ?? {};
  const down = -Math.cos(theta);   // 1 がおなかのまん中
  // とくべつな子: 全身真っ黒に、星空のような模様
  if (isSpecial(ind)) return specialBodyColor(t.coat, u, theta);
  if (t.coat === 'white') {
    // 鼻の穴のまわりは、うすいピンク
    const nose = bump(u, 0.27, 0.03) * smoothstep(0.6, 0.95, Math.cos(theta));
    // もとの明るさを少しだけ残して、陰影のちがい(畝など)がわかるようにする
    return mix(ALBINO, PINK, 0.6 * nose).map(v => v * (0.86 + 0.14 * Math.min(1, lum(c) / 0.9)));
  }
  const zone = smoothstep(0.02, 0.06, u) * (1 - smoothstep(0.6, 0.75, u));
  if (t.coat === 'dark') c = mix(c, BLACK, 0.82 * smoothstep(0.25, 0.7, lum(c)));
  if (t.coat === 'pale') c = mix(c, WHITE, 0.85 * smoothstep(-0.45, 0.05, down) * zone);
  if (t.scars === 'propeller' && u > 0.44 && u < 0.58 && Math.cos(theta) > 0.3) {
    // 背中を片側からもう片側へ、ななめに横切る平行な線(体の網目より太く)
    const along = (u - 0.44) * 14, across = Math.atan2(Math.sin(theta), Math.cos(theta)) * 1.4;
    const x = along - across * t.scarAngle;
    const d = ((x % 0.6) + 0.6) % 0.6;
    if (d < 0.2 && x > 0.3 && x < 2.2) c = mix(c, SCAR, 0.9 * (1 - smoothstep(0.12, 0.2, d)));
  }
  if (t.barnacles === 'many') {
    // あごの先と、頭のこぶのまわりに、フジツボのかたまり
    const spot = Math.sin(260 * u + 17 * theta) * Math.sin(190 * u - 23 * theta + 2);
    const chin = (1 - smoothstep(0.06, 0.11, u)) * smoothstep(0.1, 0.5, down);
    const head = (1 - smoothstep(0.12, 0.2, u)) * smoothstep(0.75, 0.95, Math.cos(theta));
    if (spot > 0.55 && Math.max(chin, head) > 0.3) c = mix(c, BARNACLE, 0.8);
  }
  return c;
}

// スクリューの傷の線(色の線と同じ場所)。それぞれ (u, θ) の点の列。形のある傷あとに使う
export function propellerLines(ind) {
  const t = ind.traits ?? {};
  if (t.scars !== 'propeller') return [];
  const lines = [];
  // 色の帯のまん中: x = 0.6k + 0.1(0.3 < x < 2.2)
  for (const x0 of [0.7, 1.3, 1.9]) {
    const line = [];
    for (let across = -1.75; across <= 1.75; across += 0.07) {
      const along = x0 + across * t.scarAngle;
      const u = 0.44 + along / 14, theta = across / 1.4;
      if (u <= 0.441 || u >= 0.579 || Math.cos(theta) <= 0.32) continue;
      line.push([u, theta < 0 ? theta + Math.PI * 2 : theta]);
    }
    if (line.length >= 3) lines.push(line);
  }
  return lines;
}

// 胸びれの色に個性を重ねる。s はつけ根 0 〜 先 1、top は上の面か
export function traitFinColor(ind, s, top, c) {
  const t = ind.traits ?? {};
  if (t.coat === 'white') return ALBINO;
  if (isSpecial(ind)) return SPECIAL_BLACK;
  if (t.pec === 'darkTop' && top) c = mix(c, BLACK, 0.9 * (1 - smoothstep(0.9, 1, s)));
  if (t.barnacles === 'many' && s > 0.8 && Math.sin(s * 140 + (top ? 1 : 3)) > 0.4) c = mix(c, BARNACLE, 0.7);
  return c;
}

// 尾びれのうしろのふちの欠けの深さ(体長1)。s は尾びれの左 -1 〜 右 1
export function flukeBite(ind, s) {
  if (ind.traits?.fluke !== 'bite') return 0;
  return 0.03 * bump(s, ind.traits.bitePlace, 0.07);
}

// 尾びれの裏の色に個性を重ねる(白さ w を受けとって返す)
export function traitFlukeWhite(ind, s, c, w) {
  const t = ind.traits ?? {};
  if (t.coat === 'white') return 1;
  if (isSpecial(ind)) return 0;
  // 尾びれの先のフジツボのかたまり
  if (t.barnacles === 'many' && Math.abs(s) > 0.82 && Math.sin(s * 90 + c * 30) > 0.3) return Math.max(w, 0.8);
  return w;
}
