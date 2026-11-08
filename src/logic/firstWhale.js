// はじめての人への、最初のクジラの案内。ボタンの紹介(tour.js)が終わると、なじみの子(シロ)がすぐに来てジャンプする。
// 吹き出しで「写真の撮り方」→「点数」→「図鑑とタグ」を案内する。吹き出しは画面をふさがない(シャッターを押せる)。
// 1回見たら(とばしても)、もう出さない。three.js も画面も使わない(テストからも使う)
import { tr } from './i18n.js';
import { FLUKE_ID } from './flukeId.js';
import { BREACH } from './breach.js';

export const FIRST_WHALE = Object.freeze({
  id: FLUKE_ID.guideId,
  pattern: 'breach',
  startDelayMs: 3000,                          // 「やって来ます!」を出してから、来るまで
  readyAtMs: (BREACH.approach - 4.5) * 1000,   // 「もうすぐジャンプ!」を出す時刻(来てから。飛び出す4.5秒前)
  maxJumps: 3,                                 // 撮れなかったら、もう一度跳ぶ(ここまで)
  storageKey: 'whale-ocean-first-whale',
});

// 案内の文。name はクジラの名前、score は撮った写真の点数
export const FIRST_WHALE_TEXT = Object.freeze({
  arrive: ({ name }) => ({ ja: `クジラがやって来ます!この子は「${name}」。この海にいちばんよく来る、なじみの子です`, en: `A whale is coming! This is ${name}, the regular of this sea who visits most often.` }),
  ready: () => ({ ja: 'もうすぐジャンプします!光っているシャッターを押して、写真を撮ってみよう', en: 'It is about to jump! Tap the glowing shutter to take a photo.' }),
  shot: ({ score }) => (score
    ? { ja: `撮れました!${score.total}点・${score.rank}ランク。写真には「写り方」と「めずらしさ」で100点まん点の点数がつきます。Aランク以上は、みんなのギャラリーにも載せられます`,
      en: `Got it! ${score.total} points, rank ${score.rank}. Photos are scored out of 100 for framing and rarity. Rank A and up can go in the shared gallery.` }
    : { ja: '撮れました!写真には「写り方」と「めずらしさ」で100点まん点の点数がつきます', en: 'Got it! Photos are scored out of 100 for framing and rarity.' }),
  again: () => ({ ja: 'おしい!もう一回跳ぶので、シャッターの準備を', en: 'So close! It will jump again — get ready.' }),
  missed: () => ({ ja: 'だいじょうぶ。クジラはまた来ます。来たらシャッターを押してね', en: 'No worries — whales come back. Tap the shutter when you see one.' }),
  book: () => ({ ja: 'つぎは図鑑。光っているボタンを押してみよう', en: 'Next, your Whale Book. Tap the glowing button.' }),
  page: ({ name }) => ({ ja: `会えたクジラは、尾びれの模様で1頭ずつ記録されます。${name}のページには、撮った写真と「回遊のタグ」がつきました。タグで、${name}がいまどこを旅しているかがわかります`,
    en: `Each whale you meet is recorded by its fluke pattern. ${name}'s page now has your photo and a migration tag, so you can follow where ${name} is travelling.` }),
  done: () => ({ ja: 'これで案内はおしまい。のんびり海をながめてね', en: 'That’s the tour. Enjoy the sea!' }),
});
export const firstWhaleText = (key, vars = {}) => tr(FIRST_WHALE_TEXT[key](vars));

// まだ案内していない、はじめての人か(図鑑にまだだれもいない)
export function needsFirstWhale(storage, book) {
  let done = false;
  try { done = storage.getItem(FIRST_WHALE.storageKey) === 'done'; } catch { /* 読めなければ、まだ */ }
  const met = Object.values(book ?? {}).some(e => e?.count > 0);
  return !done && !met;
}
export function markFirstWhaleDone(storage) {
  try { storage.setItem(FIRST_WHALE.storageKey, 'done'); } catch { /* 保存できなくても続ける */ }
}

// 案内の進み方。いまの段階と、できごとから、つぎの段階を決める
//   段階: arrive → ready → (shot | again → ready … | missed) → book → page → done
//   できごと: 'ready'(ジャンプが近い) / 'photo'(写真を撮った) / 'actEnd'(クジラが帰った) / 'next'(つぎへ) / 'zukan'(図鑑を開いた)
export function nextStage(stage, event, { jumps = 1 } = {}) {
  switch (stage) {
    case 'arrive': return event === 'ready' ? 'ready' : event === 'photo' ? 'shot' : event === 'actEnd' ? (jumps < FIRST_WHALE.maxJumps ? 'again' : 'missed') : stage;
    case 'again': return event === 'ready' ? 'ready' : event === 'photo' ? 'shot' : stage;
    case 'ready': return event === 'photo' ? 'shot' : event === 'actEnd' ? (jumps < FIRST_WHALE.maxJumps ? 'again' : 'missed') : stage;
    case 'shot': case 'missed': return event === 'next' ? 'book' : event === 'zukan' ? 'page' : stage;
    case 'book': return event === 'zukan' ? 'page' : stage;
    case 'page': return event === 'next' ? 'done' : stage;
    default: return stage;
  }
}
