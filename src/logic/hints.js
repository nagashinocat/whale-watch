// はじめて開いた人への案内(1回ずつだけ出す)。tap: 海をタップするとパネル、panel: クジラの来かたと「呼ぶ」
import { tr } from './i18n.js';

export const HINTS = Object.freeze({ storageKey: 'whale-ocean-hints', steps: Object.freeze(['tap', 'panel']) });

export const HINT_TEXT = Object.freeze({
  tap: () => tr({ ja: '海をタップすると、操作パネルが出るよ', en: 'Tap the sea to open the control panel' }),
  panel: () => tr({ ja: 'クジラは30〜90分に1回くらい来るよ。待てないときは「呼ぶ」を押してね。もう一度海をタップすると、パネルは閉じます', en: 'Whales come about once every 30–90 minutes. Can\'t wait? Tap “Call”. Tap the sea again to close the panel.' }),
});

export function loadHints(storage) {
  try {
    const v = JSON.parse(storage.getItem(HINTS.storageKey) || '[]');
    return new Set(Array.isArray(v) ? v.filter(s => HINTS.steps.includes(s)) : []);
  } catch {
    return new Set();
  }
}

export function markHint(storage, done, step) {
  done.add(step);
  try { storage.setItem(HINTS.storageKey, JSON.stringify([...done])); } catch { /* 保存できなくても続ける */ }
  return done;
}

// つぎに出す案内(なければ null)。panelOpen: いまパネルが開いているか
export function nextHint(done, panelOpen) {
  if (!panelOpen && !done.has('tap')) return 'tap';
  if (panelOpen && !done.has('panel')) return 'panel';
  return null;
}
