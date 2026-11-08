// はじめて使う人への案内(チュートリアル)。three.js も画面も使わない(テストからも使う)
//   1. あいさつ(INTRO_STEPS): 1枚だけ。「まずはクジラに会ってみましょう」
//   2. 最初のクジラ(firstWhale.js): なじみの子(シロ)が来てジャンプ。写真 → 点数 → 図鑑とタグを吹き出しで案内
//   3. ボタンの紹介(TOUR_STEPS): 画面を暗くして、便利なボタンを1つずつ照らす。写真と図鑑は2で見せたので入れない
// 見終わったら(とばしても)、もう出さない。パネルの「使い方」から、3をいつでも見返せる
import { tr, lang } from './i18n.js';
import { INTERVALS, DEFAULTS } from './config.js';

export const TOUR = Object.freeze({ storageKey: 'whale-ocean-tour' });

// 来る間隔の名前と長さ(例: 「よく来る(3〜5分)」)
function intervalText(name, l) {
  const v = INTERVALS[name] ?? INTERVALS[DEFAULTS.interval];
  const hours = v.min % 60 === 0 && v.max % 60 === 0;
  if (l === 'en') return `“${v.label.en}” (${hours ? `${v.min / 60}–${v.max / 60} h` : `${v.min}–${v.max} min`})`;
  return `「${v.label.ja}」(${hours ? `${v.min / 60}〜${v.max / 60}時間` : `${v.min}〜${v.max}分`})`;
}

// target: 照らすボタン(data 属性の名前)。null なら、まん中に説明だけ出す
// panel: このステップのとき、操作パネルを開いておく / next: 「つぎへ」のかわりのボタンの文字
export const INTRO_STEPS = Object.freeze([
  { id: 'hello', target: null, panel: false,
    next: { ja: 'クジラに会う', en: 'Meet a whale' },
    text: { ja: 'ようこそ!ここは、ときどきクジラがやって来る海です。まずは1頭、会ってみましょう', en: 'Welcome! Whales visit this sea now and then. Let’s go meet one.' } },
]);

export const TOUR_STEPS = Object.freeze([
  { id: 'more', target: null, panel: false,
    text: { ja: 'あと少しだけ、便利なボタンを紹介します。ボタンは、海をタップすると出たり消えたりします', en: 'A few handy buttons next. Tap the sea anytime to show or hide them.' } },
  { id: 'summon', target: 'summon', panel: true,
    text: { ja: '待ちきれないときは「呼ぶ」。30秒ほどでクジラが来てくれます', en: 'Can’t wait? Tap “Call” and a whale arrives in about 30 seconds.' } },
  { id: 'timer', target: 'timer', panel: true,
    text: { ja: ({ interval, l }) => `クジラが来る間隔は、いま${intervalText(interval, l)}。間隔を長くするほど、めずらしい動きに会いやすくなります`,
            en: ({ interval, l }) => `Whales now come ${intervalText(interval, l)}. Longer gaps bring rarer moves.` } },
  { id: 'cams', target: 'cams', panel: true,
    text: { ja: '見る場所は3つ。崖の上・上空・間近から選べます', en: 'Watch from three spots: the cliff, the sky, or close up.' } },
  { id: 'sky', target: 'skybar', panel: true,
    text: { ja: '太陽を指でなぞると、夕方や夜の海にもできます', en: 'Drag the sun to see the sea at sunset or at night.' } },
  { id: 'sleep', target: 'sleep', panel: true,
    text: { ja: '寝かしつけには「おやすみモード」。クジラの大きな声を止めて、波の音だけにします', en: 'For bedtime, “Sleep mode” keeps just the waves and quiets loud calls.' } },
  { id: 'help', target: 'help', panel: true, guide: true,
    text: { ja: 'わからなくなったら「使い方」。この説明を、いつでも見返せます', en: 'Lost? Tap “How to use” to see this again anytime.' } },
]);

// ステップの文。vars: { interval(いまの来る間隔), lang(言語をはっきり決めるとき) }
export function tourText(step, vars = {}) {
  const l = vars.lang ?? lang();
  const v = step.text[l] ?? step.text.ja;
  return typeof v === 'function' ? v({ interval: vars.interval ?? DEFAULTS.interval, l }) : v;
}
// ボタンの文字(決まっていなければ null)
export const tourNextLabel = step => (step.next ? tr(step.next) : null);

export function loadTourDone(storage) {
  try { return storage.getItem(TOUR.storageKey) === 'done'; } catch { return false; }
}
export function markTourDone(storage) {
  try { storage.setItem(TOUR.storageKey, 'done'); } catch { /* 保存できなくても続ける */ }
}

// 照らすボタンが見つからない(かくれている)ステップはとばす
export function tourSteps(isAvailable = () => true, steps = TOUR_STEPS) {
  return steps.filter(s => s.target === null || isAvailable(s.target));
}
