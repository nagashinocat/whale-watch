// みんなのギャラリーのページ(gallery.html)。アプリで撮って、撮った人がえらんだA以上の写真が並ぶ。
// 置き場(galleryConfig.js)がまだないとき、または ?demo を付けたときは、見本の写真を並べる
import { tr, lang } from '../logic/i18n.js';
import { GALLERY, galleryReady, listRequest, imageUrl } from '../logic/gallery.js';
import { GALLERY_CONFIG } from '../logic/galleryConfig.js';
import { individual } from '../logic/flukeId.js';

const T = (ja, en) => tr({ ja, en });
const $ = s => document.querySelector(s);
function el(tag, { cls, text, attrs } = {}, children = []) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  for (const [k, v] of Object.entries(attrs ?? {})) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

const params = new URLSearchParams(location.search);
const demo = params.has('demo') || !galleryReady(GALLERY_CONFIG);
const TILTS = [-3, 2, -1.5, 3, -2.5, 1.5];
const STAMP_TILTS = [-14, 9, -6, 12, -10];

// クジラの名前: 撮った人が付けた名前があればそれ、なければ模様から付いた名前
const whaleName = w => w.nick || individual(w.id)?.name || T('名前のないクジラ', 'an unnamed whale');
const dayText = iso => { const d = new Date(iso); return T(`${d.getMonth() + 1}月${d.getDate()}日`, d.toLocaleDateString('en', { month: 'short', day: 'numeric' })); };

// ---- 見本の写真(置き場ができるまで、ページの見た目を確かめるため) ----
function demoImage(kind, seed) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 400;
  const g = c.getContext('2d');
  const sky = { sunset: ['#f6b26b', '#d9776b', '#6d6fa0'], day: ['#a8d8ee', '#cfe8f2', '#e8f2f4'], night: ['#0b1730', '#1b2b52', '#33406a'] }[kind];
  const sea = { sunset: ['#3d5478', '#152c47'], day: ['#3a7ca5', '#174a6e'], night: ['#16263f', '#070f1d'] }[kind];
  const horizon = 220 + (seed % 3) * 14;
  let gr = g.createLinearGradient(0, 0, 0, horizon); sky.forEach((s, i) => gr.addColorStop(i / 2, s)); g.fillStyle = gr; g.fillRect(0, 0, 640, horizon);
  gr = g.createLinearGradient(0, horizon, 0, 400); gr.addColorStop(0, sea[0]); gr.addColorStop(1, sea[1]); g.fillStyle = gr; g.fillRect(0, horizon, 640, 400 - horizon);
  if (kind === 'night') { g.fillStyle = '#f3efd8'; g.beginPath(); g.arc(470, 80, 22, 0, 7); g.fill(); }
  if (kind === 'sunset') { g.fillStyle = 'rgba(255,214,150,0.9)'; g.beginPath(); g.arc(150, horizon - 6, 30, Math.PI, 0); g.fill(); }
  // クジラ(ジャンプ・尾びれ・潮ふき)
  g.fillStyle = kind === 'day' ? '#22303d' : '#121a24';
  const x = 220 + (seed * 53) % 200;
  if (seed % 3 === 0) { g.save(); g.translate(x, horizon - 40); g.rotate(-0.55); g.beginPath(); g.ellipse(0, 0, 120, 30, 0, 0, 7); g.fill(); g.restore();
    g.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(x - 70 + i * 11, horizon + 4 - (i % 4) * 5, 6 + (i % 3) * 3, 0, 7); g.fill(); } }
  else if (seed % 3 === 1) { g.beginPath(); g.moveTo(x, horizon + 6); g.quadraticCurveTo(x - 6, horizon - 50, x - 60, horizon - 80); g.quadraticCurveTo(x, horizon - 62, x + 4, horizon - 70);
    g.quadraticCurveTo(x + 8, horizon - 62, x + 68, horizon - 80); g.quadraticCurveTo(x + 14, horizon - 50, x + 10, horizon + 6); g.fill(); }
  else { g.beginPath(); g.ellipse(x, horizon + 8, 110, 16, 0, Math.PI, 0); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(x - 60 + Math.sin(i) * 14, horizon - 20 - i * 5, 5 + i * 0.6, 0, 7); g.fill(); } }
  return c.toDataURL('image/jpeg', 0.85);
}
function demoEntries(view) {
  const names = [[{ id: 3, nick: 'しろちゃん' }], [{ id: 7, nick: null }], [{ id: 11, nick: 'ぽんた' }, { id: 4, nick: null }], [{ id: 15, nick: 'Moby' }], [{ id: 9, nick: null }], [{ id: 2, nick: 'うみこ' }], [{ id: 20, nick: null }], [{ id: 6, nick: 'ゆらゆら' }]];
  const notes = [[{ ja: 'ジャンプの瞬間!', en: 'Caught mid-air!' }, { ja: 'ばっちりの構図', en: 'Great framing' }], [{ ja: 'めったに見られない姿', en: 'A rare sight' }, { ja: '朝夕の光', en: 'Golden light' }],
    [{ ja: '2頭いっしょ', en: '2 whales together' }], [{ ja: '夜の海', en: 'Night sea' }]];
  const kinds = ['sunset', 'day', 'night'];
  const scores = [96, 91, 88, 93, 79, 84, 90, 76];
  const list = scores.map((score, i) => ({
    id: i, created_at: new Date(Date.now() - i * 9e6).toISOString(), score, rank: score >= 90 ? 'S' : 'A',
    composition: Math.round(score * 0.58), rarity: score - Math.round(score * 0.58), notes: notes[i % notes.length], whales: names[i], src: demoImage(kinds[i % 3], i),
  }));
  if (view === 'best') return [...list].sort((a, b) => b.score - a.score);
  if (view === 's') return list.filter(e => e.rank === 'S');
  return list;
}

async function load(view) {
  if (demo) return demoEntries(view);
  const r = listRequest(GALLERY_CONFIG, view);
  const res = await fetch(r.url, { headers: r.headers, cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()).map(e => ({ ...e, src: imageUrl(GALLERY_CONFIG, e.image_path) }));
}

// ---- 並べる ----
const wall = $('[data-wall]');
const status = $('[data-status]');
const viewer = $('[data-viewer]');
let current = 'best';

function stamp(e, i) {
  return el('span', { cls: `stamp stamp-${e.rank}`, attrs: { 'aria-hidden': 'true', style: `--tilt:${STAMP_TILTS[i % 5]}deg` } },
    [el('b', { text: e.rank }), el('small', { text: String(e.score) })]);
}

function card(e, i) {
  const names = (e.whales ?? []).map(whaleName);
  const b = el('button', { cls: 'pola', attrs: { style: `--rot:${TILTS[i % TILTS.length]}deg`, 'aria-label': T(`${e.score}点 ${e.rank}ランク ${names.join('、')}`, `${e.score} points, rank ${e.rank}, ${names.join(', ')}`) } }, [
    el('span', { cls: 'pola-img' }, [el('img', { attrs: { src: e.src, alt: '', loading: 'lazy' } })]),
    stamp(e, i),
    el('span', { cls: 'pola-name', text: names.length ? names.join(T('・', ' & ')) : T('海の写真', 'The sea') }),
    el('span', { cls: 'pola-note', text: e.notes?.[0] ? tr(e.notes[0]) : dayText(e.created_at) }),
  ]);
  if (current === 'best' && i < 3) b.prepend(el('span', { cls: `medal medal-${i + 1}`, text: String(i + 1) }));
  b.addEventListener('click', () => open(e, i));
  return b;
}

async function show(view) {
  current = view;
  document.querySelectorAll('[data-view]').forEach(t => t.setAttribute('aria-pressed', String(t.dataset.view === view)));
  status.textContent = T('読みこんでいます…', 'Loading…');
  status.hidden = false;
  wall.replaceChildren();
  try {
    const list = await load(view);
    if (current !== view) return;
    if (!list.length) {
      status.textContent = view === 'best' ? T('今週はまだ写真がありません。最初の1枚を載せてみませんか?', 'No photos this week yet. Will yours be the first?')
        : T('まだ写真がありません', 'No photos yet');
      return;
    }
    status.hidden = true;
    wall.append(...list.map(card));
  } catch {
    status.textContent = T('写真を読みこめませんでした。電波のよいところで、もう一度開いてください', 'Could not load the photos. Please try again with a better connection.');
  }
}

function open(e, i) {
  const names = (e.whales ?? []).map(whaleName);
  viewer.replaceChildren(el('div', { cls: 'view-card' }, [
    el('div', { cls: 'view-photo' }, [el('img', { attrs: { src: e.src, alt: '' } }), stamp(e, i)]),
    el('h2', { text: names.length ? names.join(T('・', ' & ')) : T('海の写真', 'The sea') }),
    el('p', { cls: 'view-meta', text: `${dayText(e.created_at)}${T(' に載りました', '')}` }),
    el('div', { cls: 'view-bars' }, [
      bar(T('写り方', 'Framing'), e.composition, 60),
      bar(T('めずらしさ', 'Rarity'), e.rarity, 40),
    ]),
    el('ul', { cls: 'view-notes' }, (e.notes ?? []).map(n => el('li', { text: tr(n) }))),
    el('button', { cls: 'view-close', text: T('閉じる', 'Close') }),
  ]));
  viewer.hidden = false;
  viewer.querySelector('.view-close').focus();
}
function bar(label, v, max) {
  return el('div', { cls: 'bar' }, [
    el('span', { cls: 'bar-label', text: label }),
    el('span', { cls: 'bar-track' }, [el('span', { cls: 'bar-fill', attrs: { style: `width:${Math.round((100 * v) / max)}%` } })]),
    el('span', { cls: 'bar-num', text: `${v}/${max}` }),
  ]);
}
viewer.addEventListener('click', e => { if (e.target === viewer || e.target.closest('.view-close')) viewer.hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') viewer.hidden = true; });

// ---- 文字(日本語・英語) ----
document.title = T('みんなのクジラ写真館', 'Whale Photo Gallery');
for (const n of document.querySelectorAll('[data-ja]')) n.textContent = lang() === 'en' ? n.dataset.en : n.dataset.ja;
$('[data-demo]').hidden = !demo;
document.querySelectorAll('[data-view]').forEach(t => t.addEventListener('click', () => show(t.dataset.view)));
show(params.get('view') && ['best', 's', 'new'].includes(params.get('view')) ? params.get('view') : 'best');
export { GALLERY };
