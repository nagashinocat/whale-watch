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
  arrive: ({ name }) => ({ ja: `クジラがやって来ます!この子は「${name}」。この海にいちばんよく来る、なじみの子です。そのまま海を見ていてね`,
    en: `A whale is coming! This is ${name}, the regular who visits this sea most often. Keep watching the sea.` }),
  ready: () => ({ ja: 'もうすぐジャンプ!光っている丸いボタン(シャッター)を押すと、写真が撮れます', en: 'It’s about to jump! Tap the glowing round button (the shutter) to take a photo.' }),
  shot: ({ score }) => (score
    ? { ja: `撮れました!${score.total}点・${score.rank}ランク。写真には、写り方とめずらしさで100点まん点の点数がつきます`,
      en: `Got it! ${score.total} points, rank ${score.rank}. Every photo is scored out of 100 for framing and rarity.` }
    : { ja: '撮れました!写真には、写り方とめずらしさで100点まん点の点数がつきます', en: 'Got it! Every photo is scored out of 100 for framing and rarity.' }),
  again: () => ({ ja: 'おしい!もう一回跳ぶので、光っているシャッターを押してね', en: 'So close! It will jump again — tap the glowing shutter.' }),
  missed: () => ({ ja: 'だいじょうぶ。クジラはまた来ます。来たら、シャッターを押して撮ってね', en: 'No worries — whales come back. Tap the shutter when you see one.' }),
  book: () => ({ ja: '会えたクジラは図鑑に入ります。光っている本のボタンを押してみよう', en: 'Whales you meet go into your Whale Book. Tap the glowing book button.' }),
  page: ({ name }) => ({ ja: `クジラは、尾びれの模様で1頭ずつ見分けて記録されます。${name}のページには、撮った写真と「回遊のタグ」がつきました。タグを見ると、${name}がいまどこを旅しているかがわかります`,
    en: `Each whale is told apart by its fluke pattern. ${name}'s page now has your photo and a migration tag, so you can follow where ${name} is travelling.` }),
  done: ({ name }) => ({ ja: `これで${name}との出会いはおしまい。さいごに、便利なボタンを少しだけ紹介しますね`, en: `That’s your first meeting with ${name}! Last, a quick look at a few handy buttons.` }),
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
