// クジラ図鑑の1頭ずつの情報(全長・体重・特徴のコメント・会えた回数でわかっていく情報)。
// three.js は使わない(テストからも使う)。
//
// 調べてわかったこと(アラスカ州の資料)
//   ・ザトウクジラのメスは平均で全長15m、体重はおよそ35トン。オスはメスより少し小さい
//   ・生まれたばかりの子どもは3〜5m、およそ1.5トン
// 体重は体の長さの3乗に比例するとして、15mで35トンになるように決めている。

import { tr } from './i18n.js';
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

const CATEGORY_WORDS = () => tr({
  ja: { 1: 'ほぼ白', 2: '白っぽく、黒い模様が少し', 3: '白と黒がおよそ半分ずつ', 4: '黒っぽく、白い模様が少し', 5: 'ほぼ黒' },
  en: { 1: 'almost all white', 2: 'mostly white with a few black marks', 3: 'about half white and half black', 4: 'mostly black with a few white marks', 5: 'almost all black' },
});

// 特徴のコメント(1〜3文)
export function commentFor(ind) {
  const cat = CATEGORY_WORDS()[ind.category];
  const out = [tr({ ja: `尾びれの裏は${cat}。`, en: `The underside of the fluke is ${cat}.` })];
  const scar = ind.scars?.[0]?.type;
  if (ind.traits?.coat !== 'white') {
    if (scar === 'rake') out.push(tr({ ja: '尾びれに、シャチの歯のあとのような平行な3本の線がある。', en: 'Three parallel lines on the fluke, like orca tooth rakes.' }));
    else if (scar === 'line') out.push(tr({ ja: '尾びれに、長い1本の傷がある。', en: 'One long scar across the fluke.' }));
    else if ((ind.spots?.length ?? 0) >= 3) out.push(tr({ ja: '尾びれに、フジツボのあとの白い点がちらばっている。', en: 'White spots on the fluke left by barnacles.' }));
  }
  const white = ind.traits?.coat === 'white';
  const t = traitsText(ind);
  if (white) out.push(tr({ ja: '全身が真っ白で、とてもめずらしい。この海でほかに見つかっていない。', en: 'Pure white all over and extremely rare. No other like it has been seen in these waters.' }));
  const rest = white ? t.slice(1) : t;   // 真っ白は、いつもいちばん先に書いてある
  if (rest.length) out.push(tr({ ja: `${rest.join('。')}。`, en: `${rest.join('. ')}.` }));
  if (!t.length && !scar && (ind.spots?.length ?? 0) < 3) out.push(tr({ ja: 'とくに目立つところがなく、尾びれの模様がいちばんの目印。', en: 'Nothing stands out; the fluke pattern is the best way to tell this one apart.' }));
  return out.join(tr({ ja: '', en: ' ' }));
}

// 会えた回数でわかっていく情報。全身の姿(portrait)だけは、会えた回数ではなく、写真を撮るとのる
export const ZUKAN_LEVELS = Object.freeze([
  { at: 1, items: ['fluke', 'name', 'count'], text: { ja: '尾びれの模様と名前', en: 'its fluke pattern and name' } },
  { at: 2, items: ['length'], text: { ja: '全長', en: 'its length' } },
  { at: 3, items: ['weight', 'comment'], text: { ja: '体重と特徴', en: 'its weight and features' } },
]);

// 1頭の図鑑の情報。open は見られる項目、next はつぎにわかること(全部わかっていたら null)
export function zukanInfo(ind, entry) {
  const count = entry?.count ?? 0;
  const open = {};
  for (const level of ZUKAN_LEVELS) for (const item of level.items) open[item] = count >= level.at;
  open.portrait = entry?.photographed === true;
  const nextLevel = ZUKAN_LEVELS.find(l => count < l.at);
  return {
    count,
    open,
    length: lengthOf(ind),
    weight: weightOf(ind),
    comment: commentFor(ind),
    next: nextLevel ? { count: nextLevel.at, more: nextLevel.at - count, text: nextText(nextLevel.at - count, tr(nextLevel.text)) } : null,
  };
}

// 図鑑に記録したときのお知らせ。items は [{ name, first(はじめてか), count(会えた回数) }]。
// 群れで何頭もいっしょに来たときは、1つにまとめる
export function sightingMessage(items) {
  if (!items.length) return '';
  if (items.length === 1) {
    const [i] = items;
    return i.first
      ? tr({ ja: `はじめて見るクジラです。「${i.name}」と仮の名前で図鑑にのせました。図鑑で好きな名前を付けられます`,
        en: `A whale you haven't seen before! Added to your Whale Book as "${i.name}". You can rename it there.` })
      : tr({ ja: `「${i.name}」がまた来ました(${i.count}回目)`, en: `"${i.name}" is back (visit #${i.count})` });
  }
  const quote = list => tr({ ja: list.map(i => `「${i.name}」`).join(''), en: list.map(i => `"${i.name}"`).join(', ') });
  const fresh = items.filter(i => i.first), back = items.filter(i => !i.first);
  const parts = [];
  if (fresh.length) parts.push(tr({ ja: `はじめて見るクジラが${fresh.length}頭(${quote(fresh)})。図鑑にのせました`, en: `${fresh.length} new whales (${quote(fresh)}) added to your Whale Book` }));
  if (back.length) parts.push(tr({ ja: `${quote(back)}がまた来ました`, en: `${quote(back)} came back` }));
  return parts.join(tr({ ja: '。', en: '. ' }));
}

// 「あと○回会うと、○○がわかります」
function nextText(more, what) {
  return tr({ ja: `あと${more}回会うと、${what}がわかります`, en: `Meet it ${more} more time${more > 1 ? 's' : ''} to learn ${what}` });
}

// この出方で会ったクジラを、図鑑の「会えた回数」に数えるか。
// 「呼ぶ」ボタンやタイマーで来てもらったクジラは数えない(自然に出会ったクジラだけを記録する)
export function countsForZukan(event) {
  return !['summon', 'timer'].includes(event?.kind) && event?.pattern !== 'summon';
}
