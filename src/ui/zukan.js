import { drawFluke } from './flukeCanvas.js';
import { FLUKE_ID, NAME_MAX } from '../logic/flukeId.js';
import { traitsText } from '../logic/traits.js';
import { zukanInfo, ZUKAN_LEVELS } from '../logic/zukan.js';
import { photosOf, photoCaption } from '../logic/photos.js';

// 日付を「11月6日」の形に
const day = ms => { const d = new Date(ms); return `${d.getMonth() + 1}月${d.getDate()}日`; };

// 要素を作る小さな道具(文字は textContent で入れるので、名前に何が入っても安全)
function el(tag, { cls, text, attrs } = {}, children = []) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  for (const [k, v] of Object.entries(attrs ?? {})) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

// クジラ図鑑。「クジラ」(一覧と、1頭ずつのくわしいページ)と「写真」の2つに分かれる。
// handlers: { onRename(id, name) }、photos: 写真の保存場所、portrait(ind): 全身の姿の絵のアドレス、nameOf(id)
export function createZukan(root, { onRename, photos, portrait, nameOf }) {
  const panel = el('section', { cls: 'zukan', attrs: { 'aria-label': 'クジラ図鑑' } });
  panel.hidden = true;
  const close = el('button', { cls: 'full', text: '閉じる' });
  const tabs = el('div', { cls: 'seg zukan-tabs', attrs: { role: 'group', 'aria-label': '図鑑の種類' } });
  const tabWhales = el('button', { text: 'クジラ' }), tabPhotos = el('button', { text: '写真' });
  tabs.append(tabWhales, tabPhotos);
  const view = el('div', { cls: 'zukan-view' });
  panel.append(el('div', { cls: 'zukan-head' }, [el('h2', { text: 'クジラ図鑑' }), close]), tabs, view);

  // 写真を大きく見る
  const viewer = el('div', { cls: 'photo-view', attrs: { role: 'dialog', 'aria-label': '写真' } });
  viewer.hidden = true;
  const big = el('img', { attrs: { alt: '' } });
  const caption = el('p', { cls: 'photo-caption' });
  const save = el('a', { cls: 'full photo-btn', text: '保存する' });
  const del = el('button', { cls: 'full', text: '消す' });
  const closeViewer = el('button', { cls: 'full', text: '閉じる' });
  viewer.append(big, caption, el('div', { cls: 'photo-actions' }, [save, del, closeViewer]));
  root.append(panel, viewer);

  let entries = [];
  let state = { tab: 'whales', detail: null };
  let shown = null;   // 大きく見ている写真

  close.addEventListener('click', () => { panel.hidden = true; });
  tabWhales.addEventListener('click', () => { state = { tab: 'whales', detail: null }; render(); });
  tabPhotos.addEventListener('click', () => { state = { tab: 'photos', detail: null }; render(); });
  closeViewer.addEventListener('click', () => { viewer.hidden = true; });
  del.addEventListener('click', async () => {
    if (!shown) return;
    await photos.remove(shown.id);
    viewer.hidden = true;
    render();
  });

  function openPhoto(p) {
    shown = p;
    big.src = photos.url(p);
    caption.textContent = photoCaption(p, nameOf);
    save.href = big.src;
    save.download = `whale-${new Date(p.time).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;
    viewer.hidden = false;
  }

  function photoGrid(list) {
    const grid = el('div', { cls: 'photo-grid' });
    for (const p of list) {
      const b = el('button', { cls: 'photo-thumb', attrs: { 'aria-label': photoCaption(p, nameOf) } }, [el('img', { attrs: { src: photos.url(p), alt: '' } })]);
      b.addEventListener('click', () => openPhoto(p));
      grid.append(b);
    }
    return grid;
  }

  function flukeCanvas(e, w = 176, h = 48) {
    const c = el('canvas', { attrs: { 'aria-hidden': 'true' } });
    c.width = w; c.height = h;
    drawFluke(c, e);
    return c;
  }

  // ---- 一覧 ----
  function renderList(out) {
    out.append(el('p', { cls: 'zukan-note', text: `尾びれの裏の模様は1頭ずつちがいます。尾びれを上げて潜ったクジラが、ここにのります。会うたびに、くわしいことがわかっていきます。 いままでに ${entries.length} / ${FLUKE_ID.size} 頭` }));
    const list = el('ol', { cls: 'zukan-list' });
    if (!entries.length) list.append(el('li', { cls: 'zukan-empty', text: 'まだだれものっていません。クジラが尾びれを上げて潜るのを待ちましょう' }));
    for (const e of entries) {
      const item = el('button', { cls: 'zukan-item' }, [
        flukeCanvas(e),
        el('div', { cls: 'zukan-text' }, [
          el('b', { text: e.displayName }),
          el('span', { text: `${e.count}回 ・ さいご ${day(e.last)}` }),
        ]),
      ]);
      item.addEventListener('click', () => { state = { tab: 'whales', detail: e.id }; render(); });
      list.append(el('li', {}, [item]));
    }
    out.append(list);
  }

  // ---- 1頭のくわしいページ ----
  async function renderDetail(e, out) {
    const info = zukanInfo(e, e);
    const back = el('button', { cls: 'full', text: '← 一覧へ' });
    back.addEventListener('click', () => { state = { tab: 'whales', detail: null }; render(); });
    const name = el('h3', { cls: 'zukan-name', text: e.displayName });
    const rename = el('button', { cls: 'full', text: '名前を付ける' });
    const head = el('div', { cls: 'zukan-detail-head' }, [name, rename]);
    rename.addEventListener('click', () => startRename(head, e));
    out.append(back, head);
    if (e.nickname) out.append(el('small', { cls: 'zukan-sub', text: `模様から付けた名前: ${e.autoName}` }));

    // 全身の姿
    if (info.open.portrait) {
      const url = portrait(e);
      out.append(url
        ? el('img', { cls: 'zukan-portrait', attrs: { src: url, alt: `${e.displayName}の全身の姿` } })
        : el('div', { cls: 'zukan-locked', text: '全身の姿を描けませんでした' }));
    } else {
      out.append(el('div', { cls: 'zukan-locked', text: `全身の姿は、${ZUKAN_LEVELS[1].at}回会うとわかります` }));
    }

    // 数字
    const unknown = '？';
    const rows = [
      ['会えた回数', `${info.count}回`],
      ['はじめて会った日', day(e.first)],
      ['さいごに会った日', day(e.last)],
      ['全長', info.open.length ? `${info.length.toFixed(1)}m` : unknown],
      ['体重', info.open.weight ? `約${info.weight}トン` : unknown],
    ];
    const dl = el('dl', { cls: 'zukan-stats' });
    for (const [k, v] of rows) dl.append(el('dt', { text: k }), el('dd', { text: v }));
    out.append(dl);

    // 特徴
    out.append(el('h4', { text: '特徴' }));
    if (info.open.comment) {
      out.append(el('p', { cls: 'zukan-comment', text: info.comment }));
    } else {
      const t = traitsText(e);
      out.append(el('p', { cls: 'zukan-comment zukan-dim', text: t.length ? `${t[0]}…(くわしくは、もっと会うとわかります)` : 'もっと会うと、わかります' }));
    }
    if (info.next) out.append(el('p', { cls: 'zukan-next', text: info.next.text }));

    // 尾びれの裏
    out.append(el('h4', { text: '尾びれの裏' }), flukeCanvas(e, 352, 96));

    // 写真
    out.append(el('h4', { text: 'この子の写真' }));
    const mine = photosOf(await photos.list(), e.id);
    out.append(mine.length ? photoGrid(mine) : el('p', { cls: 'zukan-dim', text: 'この子が写っている写真は、まだありません。メニューの「写真」で撮れます' }));
  }

  // 名前を入力する欄を出す
  function startRename(box, e) {
    const form = el('form', { cls: 'zukan-form' });
    const input = el('input', { attrs: { type: 'text', maxlength: String(NAME_MAX), placeholder: e.autoName, 'aria-label': `${e.displayName}の名前` } });
    input.value = e.nickname ?? '';
    const ok = el('button', { cls: 'full', text: '決める', attrs: { type: 'submit' } });
    const cancel = el('button', { cls: 'full', text: 'やめる', attrs: { type: 'button' } });
    cancel.addEventListener('click', render);
    form.addEventListener('submit', ev => { ev.preventDefault(); onRename(e.id, input.value); });
    form.append(input, ok, cancel);
    box.replaceChildren(form, el('small', { cls: 'zukan-sub', text: `${NAME_MAX}文字まで。空にすると「${e.autoName}」にもどります` }));
    input.focus();
  }

  // ---- 写真 ----
  async function renderPhotos(out) {
    const list = (await photos.list()).sort((a, b) => b.time - a.time);
    out.append(el('p', { cls: 'zukan-note', text: `撮った写真 ${list.length}枚(${photos.max}枚まで。こえると古いものから消えます)。メニューの「写真」で撮れます` }));
    if (list.length) out.append(photoGrid(list));
  }

  let renderId = 0;
  async function render() {
    const id = ++renderId;
    tabWhales.classList.toggle('on', state.tab === 'whales');
    tabPhotos.classList.toggle('on', state.tab === 'photos');
    const out = el('div');
    const e = state.detail && entries.find(x => x.id === state.detail);
    if (state.tab === 'photos') await renderPhotos(out);
    else if (e) await renderDetail(e, out);
    else renderList(out);
    if (id !== renderId) return;   // とちゅうで別の画面にかわった
    view.replaceChildren(out);
  }

  return {
    contains: target => panel.contains(target) || viewer.contains(target),
    open() { panel.hidden = false; render(); },
    // 見たことのあるクジラ(最後に見た順)
    setEntries(list) {
      entries = list;
      if (!panel.hidden) render();
    },
    refresh() { if (!panel.hidden) render(); },
  };
}
