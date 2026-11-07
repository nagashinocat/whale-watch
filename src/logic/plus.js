// 有料の「プラス」で使えるようになる機能と、使えるかどうかの記録。
// 画面や支払いの仕組みには触らない(支払いの方法が決まったら、unlock を呼ぶだけにする)
import { PATTERNS } from './patterns.js';
import { bookEntries } from './flukeId.js';

export const PLUS = Object.freeze({
  storageKey: 'whale-ocean-plus',
  // 支払いの方法が決まるまでは、プラスの項目を画面に出さない(使える状態にしたときだけ出る)
  offered: false,
  // プラスでないと選べない「クジラが来る間隔」と、そのとき代わりに使う間隔
  lockedIntervals: Object.freeze(['often']),
  fallbackInterval: 'more',
  // えらんで呼んだクジラが来るまで(ふつうの「呼ぶ」の10〜30秒より早い)
  pickDelayMs: Object.freeze([3000, 6000]),
});

// えらんで呼べる出かた(「呼んだクジラ」そのものは除く)
export const PICKABLE = Object.freeze(Object.keys(PATTERNS).filter(n => n !== 'summon'));

export function loadPlus(storage) {
  try {
    const v = JSON.parse(storage.getItem(PLUS.storageKey) || 'null');
    return { unlocked: v?.unlocked === true };
  } catch {
    return { unlocked: false };
  }
}

export function savePlus(storage, state) {
  try { storage.setItem(PLUS.storageKey, JSON.stringify({ unlocked: state.unlocked === true })); } catch { /* 保存できなくても続ける */ }
}

export const intervalLocked = (name, unlocked) => !unlocked && PLUS.lockedIntervals.includes(name);

// 保存されていた間隔が、いまは使えないもの(プラスをやめた・ほかの端末の設定)なら、代わりの間隔にする
export const usableInterval = (name, unlocked) => (intervalLocked(name, unlocked) ? PLUS.fallbackInterval : name);

// 来てほしいクジラとして選べるのは、もう図鑑にのっている子だけ(まだ会っていない子の名前は明かさない)
export const pickableWhales = book => bookEntries(book).map(e => ({ id: e.id, name: e.displayName }));
