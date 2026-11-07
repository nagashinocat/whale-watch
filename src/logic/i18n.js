// ことばの切りかえ(日本語・英語)。three.js は使わない(テストからも使う)。
//
// ・はじめは端末の言語に合わせる(日本語の端末は日本語、それ以外は英語)
// ・操作パネルで選んだら、その言語にする(設定に保存し、ページを読みなおす)
// ・文は、使う場所に {ja: '...', en: '...'} の形で日本語と英語をならべて書き、tr() で選ぶ
//   (ことばが変わるときに、両方を見ながら直せるように)
import { STORAGE_KEY } from './config.js';

export const LANGS = Object.freeze(['ja', 'en']);
export const LANG_CHOICES = Object.freeze(['auto', 'ja', 'en']);

// 端末の言語の一覧から選ぶ(日本語がいちばん先に来たら日本語、ほかは英語)
export function detectLang(languages = []) {
  for (const l of languages) {
    if (/^ja\b/i.test(l)) return 'ja';
    if (/^[a-z]{2}/i.test(l)) return 'en';
  }
  return 'ja';
}

// 設定の言語('auto'・'ja'・'en')と端末の言語から、使う言語
export function resolveLang(choice, languages) {
  return LANGS.includes(choice) ? choice : detectLang(languages);
}

let current = 'ja';

// はじめに一度だけ: 保存した設定と端末の言語から決める(ブラウザでないとき = テストでは日本語)
function initial() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null');
    const langs = globalThis.navigator?.languages ?? (globalThis.navigator?.language ? [globalThis.navigator.language] : []);
    if (!globalThis.document) return 'ja';   // ブラウザでないとき(テスト)
    return resolveLang(saved?.lang, langs);
  } catch {
    return 'ja';
  }
}
current = initial();

export const lang = () => current;
export function setLang(l) {
  current = LANGS.includes(l) ? l : 'ja';
  if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = current;
}
setLang(current);

// {ja, en} から、いまの言語の文を選ぶ。文のかわりに関数を書くと、vars をわたして作る
export function tr(pair, vars) {
  const v = pair[current] ?? pair.ja;
  return typeof v === 'function' ? v(vars ?? {}) : v;
}

// 文のくぎり(日本語は「、」「。」、英語は ", " ". ")
export const listJoin = items => (current === 'en' ? items.join(', ') : items.join('、'));
