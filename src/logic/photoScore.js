// 撮った写真の採点。「写り方」(60点)と「めずらしさ」(40点)で、100点まん点。three.js も画面も使わない(テストからも使う)。
//
// 写真を撮った瞬間の、クジラの写り方(subjects)から決める。subjects は1頭ずつ:
//   { id, pattern, special, points: [{ x, y, inFrame, above }], airborne }
//   points: 頭から尾までの体の点が、画面のどこに来たか(x・y は画面のはしが -1・1)。inFrame: 画面の中 / above: 水の上
//   airborne: 体ぜんぶが水から出ている(ジャンプの空中)
// light: 'golden'(朝夕)・'night'・'day'

import { tr } from './i18n.js';

export const SCORE = Object.freeze({
  composition: 60,
  rarity: 40,
  ranks: Object.freeze([
    { at: 90, name: 'S' },
    { at: 75, name: 'A' },
    { at: 55, name: 'B' },
    { at: 0, name: 'C' },
  ]),
  // 出方ごとの、めずらしさ(会える回数が少ないほど高い)
  patternRarity: Object.freeze({
    spout: 4, voice: 0, fluke: 9, motherCalf: 12, sleeping: 8, breach: 16, bigBreach: 20, groupSpyhop: 18, groupBreach: 24,
    calfBreach: 18, pod: 12, spyhop: 12, pecSlap: 10, lobtail: 10, feeding: 18, bubbleNet: 24, eyeContact: 24, bubbleRing: 26, summon: 6,
  }),
  airborne: 10,     // ジャンプで体ぜんぶが空中
  special: 24,      // とくべつな子
  light: Object.freeze({ golden: 4, night: 3, day: 0 }),
  perExtraWhale: 3, // 2頭目からのひとりごとに
});

const clamp01 = v => Math.min(1, Math.max(0, v));

// 1頭ぶんの写り方(0〜1)と、そのわけ
function framing(s) {
  const pts = s.points ?? [];
  if (!pts.length) return { score: 0, notes: [] };
  const seen = pts.filter(p => p.inFrame && p.above);
  const showing = pts.filter(p => p.above);
  if (!seen.length) return { score: 0, notes: [] };
  // どれだけ画面に入っているか(水の上に出ている体のうち)
  const inside = seen.length / Math.max(1, showing.length);
  const xs = seen.map(p => p.x), ys = seen.map(p => p.y);
  const w = (Math.max(...xs) - Math.min(...xs)) / 2, h = (Math.max(...ys) - Math.min(...ys)) / 2;   // 画面の幅・高さに対する割合
  const size = Math.max(w, h);
  // 大きさ: 画面の 35〜75% がいちばん。小さすぎ・大きすぎは下がる
  const sizeScore = size < 0.35 ? clamp01(size / 0.35) ** 0.8 : size > 0.75 ? clamp01(1 - (size - 0.75) / 0.5) : 1;
  // 置き場所: まんなか、または3分の1の線の近くがよい
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const nearest = (v) => Math.min(Math.abs(v), Math.abs(Math.abs(v) - 1 / 3));
  const place = clamp01(1 - (nearest(cx) + nearest(cy)) / 0.7);
  const score = 0.45 * sizeScore + 0.3 * inside + 0.25 * place;
  const notes = [];
  if (sizeScore > 0.9 && place > 0.7 && inside > 0.95) notes.push({ ja: 'ばっちりの構図', en: 'Great framing' });
  else {
    if (size < 0.2) notes.push({ ja: 'もう少し大きく写せるかも', en: 'Could be a bit bigger' });
    if (inside < 0.8) notes.push({ ja: '体が画面から少し切れている', en: 'Part of the body is cut off' });
  }
  return { score, notes };
}

export function scorePhoto({ subjects = [], light = 'day' } = {}) {
  const visible = subjects.filter(s => (s.points ?? []).some(p => p.inFrame && p.above));
  if (!visible.length) {
    return { total: 8, composition: 0, rarity: 8, rank: 'C', notes: [{ ja: 'クジラは写っていない、海の写真', en: 'Just the sea this time' }] };
  }
  // いちばんよく写っている子で、写り方を決める
  const framed = visible.map(s => ({ s, f: framing(s) })).sort((a, b) => b.f.score - a.f.score);
  const best = framed[0];
  const composition = Math.round(SCORE.composition * best.f.score);
  const notes = [...best.f.notes];
  // めずらしさ
  let rarity = Math.max(...visible.map(s => SCORE.patternRarity[s.pattern] ?? 6));
  const rarest = visible.reduce((a, s) => ((SCORE.patternRarity[s.pattern] ?? 0) > (SCORE.patternRarity[a.pattern] ?? 0) ? s : a), visible[0]);
  if ((SCORE.patternRarity[rarest.pattern] ?? 0) >= 20) notes.push({ ja: 'めったに見られない姿', en: 'A rare sight' });
  if (visible.some(s => s.airborne)) { rarity += SCORE.airborne; notes.push({ ja: 'ジャンプの瞬間!', en: 'Caught mid-air!' }); }
  if (visible.some(s => s.special)) { rarity += SCORE.special; notes.push({ ja: 'とくべつな子が写っている', en: 'A very special whale' }); }
  const lightBonus = SCORE.light[light] ?? 0;
  if (lightBonus) { rarity += lightBonus; notes.push(light === 'night' ? { ja: '夜の海', en: 'Night sea' } : { ja: '朝夕の光', en: 'Golden light' }); }
  if (visible.length > 1) { rarity += SCORE.perExtraWhale * (visible.length - 1); notes.push({ ja: `${visible.length}頭いっしょ`, en: `${visible.length} whales together` }); }
  rarity = Math.min(SCORE.rarity, rarity);
  const total = Math.min(100, composition + rarity);
  return { total, composition, rarity, rank: rankOf(total), notes };
}

export const rankOf = total => SCORE.ranks.find(r => total >= r.at).name;

// 光の具合: 時刻(時)から
export function lightOf(hours) {
  const h = ((hours % 24) + 24) % 24;
  if (h < 5 || h >= 19.5) return 'night';
  if ((h >= 5 && h < 7.5) || (h >= 16.5 && h < 19.5)) return 'golden';
  return 'day';
}

// 点数のひとこと: 「88点 A ・ ジャンプの瞬間!・ばっちりの構図」
export function scoreLine(score) {
  if (!score) return '';
  const notes = score.notes.slice(0, 2).map(n => tr(n)).join(tr({ ja: '・', en: ' · ' }));
  return tr({ ja: `${score.total}点 ${score.rank}`, en: `${score.total} pts ${score.rank}` }) + (notes ? tr({ ja: ` ・ ${notes}`, en: ` · ${notes}` }) : '');
}
