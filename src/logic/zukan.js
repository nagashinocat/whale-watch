// クジラ図鑑の1頭ずつの情報(全長・体重・特徴のコメント・会えた回数でわかっていく情報)。
// three.js は使わない(テストからも使う)。
//
// 調べてわかったこと(アラスカ州の資料)
//   ・ザトウクジラのメスは平均で全長15m、体重はおよそ35トン。オスはメスより少し小さい
//   ・生まれたばかりの子どもは3〜5m、およそ1.5トン
// 体重は体の長さの3乗に比例するとして、15mで35トンになるように決めている。

import { sizeOf, traitsText } from './traits.js';

// 全長(m)。大きさの個性に、1頭ずつの小さなちがい(±4%)を足す
export function lengthOf(ind) {
  const wobble = (((ind.id * 7919) % 101) / 100 - 0.5) * 0.08;
  return Math.round(14 * sizeOf(ind) * (1 + wobble) * 10) / 10;
}

// 体重(トン、0.5トンきざみ)
export function weightOf(ind) {
  return Math.round(35 * (lengthOf(ind) / 15) ** 3 * 2) / 2;
}

const CATEGORY_WORDS = { 1: 'ほぼ白', 2: '白っぽく、黒い模様が少し', 3: '白と黒がおよそ半分ずつ', 4: '黒っぽく、白い模様が少し', 5: 'ほぼ黒' };

// 特徴のコメント(1〜3文)
export function commentFor(ind) {
  const out = [`尾びれの裏は${CATEGORY_WORDS[ind.category]}。`];
  const scar = ind.scars?.[0]?.type;
  if (ind.traits?.coat !== 'white') {
    if (scar === 'rake') out.push('尾びれに、シャチの歯のあとのような平行な3本の線がある。');
    else if (scar === 'line') out.push('尾びれに、長い1本の傷がある。');
    else if ((ind.spots?.length ?? 0) >= 3) out.push('尾びれに、フジツボのあとの白い点がちらばっている。');
  }
  const t = traitsText(ind);
  if (ind.traits?.coat === 'white') out.push('全身が真っ白で、とてもめずらしい。この海でほかに見つかっていない。');
  const rest = t.filter(s => !s.startsWith('全身が真っ白'));
  if (rest.length) out.push(`${rest.join('。')}。`);
  if (!t.length && !scar && (ind.spots?.length ?? 0) < 3) out.push('とくに目立つところがなく、尾びれの模様がいちばんの目印。');
  return out.join('');
}

// 会えた回数でわかっていく情報
export const ZUKAN_LEVELS = Object.freeze([
  { at: 1, items: ['fluke', 'name', 'count'], text: '尾びれの模様と名前' },
  { at: 2, items: ['portrait', 'length'], text: '全身の姿と全長' },
  { at: 3, items: ['weight', 'comment'], text: '体重と特徴' },
]);

// 1頭の図鑑の情報。open は見られる項目、next はつぎにわかること(全部わかっていたら null)
export function zukanInfo(ind, entry) {
  const count = entry?.count ?? 0;
  const open = {};
  for (const level of ZUKAN_LEVELS) for (const item of level.items) open[item] = count >= level.at;
  const nextLevel = ZUKAN_LEVELS.find(l => count < l.at);
  return {
    count,
    open,
    length: lengthOf(ind),
    weight: weightOf(ind),
    comment: commentFor(ind),
    next: nextLevel ? { count: nextLevel.at, more: nextLevel.at - count, text: `あと${nextLevel.at - count}回会うと、${nextLevel.text}がわかります` } : null,
  };
}

// 図鑑に記録したときのお知らせ。items は [{ name, first(はじめてか), count(会えた回数) }]。
// 群れで何頭もいっしょに来たときは、1つにまとめる
export function sightingMessage(items) {
  if (!items.length) return '';
  if (items.length === 1) {
    const [i] = items;
    return i.first
      ? `はじめて見るクジラです。「${i.name}」と仮の名前で図鑑にのせました。図鑑で好きな名前を付けられます`
      : `「${i.name}」がまた来ました(${i.count}回目)`;
  }
  const quote = list => list.map(i => `「${i.name}」`).join('');
  const fresh = items.filter(i => i.first), back = items.filter(i => !i.first);
  const parts = [];
  if (fresh.length) parts.push(`はじめて見るクジラが${fresh.length}頭(${quote(fresh)})。図鑑にのせました`);
  if (back.length) parts.push(`${quote(back)}がまた来ました`);
  return parts.join('。');
}
