import { drawFluke } from './flukeCanvas.js';
import { FLUKE_ID, NAME_MAX } from '../logic/flukeId.js';
import { traitsText } from '../logic/traits.js';
import { zukanInfo, ZUKAN_LEVELS } from '../logic/zukan.js';
import { photosOf, photoCaption } from '../logic/photos.js';

// 日付を「11/6」の形に
const day = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}`; };
const no = id => `No.${String(id).padStart(2, '0')}`;

// 要素を作る小さな道具(文字は textContent で入れるので、名前に何が入っても安全)
function el(tag, { cls, text, attrs } = {}, children = []) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  for (const [k, v] of Object.entries(attrs ?? {})) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

// クジラ図鑑(調査ファイルの見た目)。茶色い紙のフォルダーに、1頭ずつの調査書類が入っている。
// 上の見出しタブで「ファイル一覧」「写真」や、となりの子に切りかえる。
// handlers: { onRename(id, name) }、photos: 写真の保存場所、portrait(ind): 全身の姿の絵のアドレス、nameOf(id)
export function createZukan(root, { onRename, photos, portrait, nameOf }) {
  const panel = el('section', { cls: 'zk', attrs: { 'aria-label': 'クジラ図鑑' } });
  panel.hidden = true;
  const back = el('button', { cls: 'zk-btn', text: '← ファイル一覧' });
  const count = el('span', { cls: 'zk-count' });
  const close = el('button', { cls: 'zk-btn', text: '閉じる' });
  const tabs = el('div', { cls: 'zk-tabs', attrs: { role: 'group', 'aria-label': '図鑑のファイル' } });
  const view = el('div', { cls: 'zk-paper' });
  panel.append(
    el('div', { cls: 'zk-inner' }, [
      el('div', { cls: 'zk-head' }, [back, count, close]),
      tabs,
      el('div', { cls: 'zk-folder' }, [view]),
    ]),
  );

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
  back.addEventListener('click', () => go({ tab: 'whales', detail: null }));
  closeViewer.addEventListener('click', () => { viewer.hidden = true; });
  del.addEventListener('click', async () => {
    if (!shown) return;
    await photos.remove(shown.id);
    viewer.hidden = true;
    render();
  });

  function go(next) {
    state = next;
    render();
    view.scrollTop = 0;
  }

  function openPhoto(p) {
    shown = p;
    big.src = photos.url(p);
    caption.textContent = photoCaption(p, nameOf);
    save.href = big.src;
    save.download = `whale-${new Date(p.time).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;
    viewer.hidden = false;
  }

  // ポラロイド写真のように貼った、撮った写真
  function polaroids(list, size = 'small') {
    const row = el('div', { cls: `zk-polaroids zk-polaroids-${size}` });
    list.forEach((p, i) => {
      const b = el('button', { cls: 'zk-polaroid', attrs: { 'aria-label': photoCaption(p, nameOf), style: `transform: rotate(${[-4, 3, -2, 4, -3][i % 5]}deg)` } },
        [el('img', { attrs: { src: photos.url(p), alt: '' } })]);
      b.addEventListener('click', () => openPhoto(p));
      row.append(b);
    });
    return row;
  }

  function flukeCanvas(e, w, h, label) {
    const c = el('canvas', { attrs: { role: 'img', 'aria-label': label ?? `${e.displayName}の尾びれの裏` } });
    c.width = w; c.height = h;
    drawFluke(c, e);
    return c;
  }

  // 見出しタブ
  function renderTabs() {
    tabs.replaceChildren();
    const tab = (label, active, onClick, small = false) => {
      const b = el('button', { cls: `zk-tab${active ? ' on' : ''}${small ? ' small' : ''}`, text: label, attrs: { 'aria-pressed': String(active) } });
      b.addEventListener('click', onClick);
      tabs.append(b);
    };
    const e = state.detail && entries.find(x => x.id === state.detail);
    if (e) {
      // いまの子と、となりの子(最後に会った順でとなり)
      const k = entries.indexOf(e);
      tab(`${no(e.id)} ${e.displayName}`, true, () => {});
      for (const other of [entries[k + 1], entries[k - 1]].filter(Boolean)) tab(no(other.id), false, () => go({ tab: 'whales', detail: other.id }), true);
    } else {
      tab('ファイル一覧', state.tab === 'whales', () => go({ tab: 'whales', detail: null }));
      tab('写真', state.tab === 'photos', () => go({ tab: 'photos', detail: null }));
    }
  }

  // ---- ファイル一覧 ----
  function renderList(out) {
    out.append(
      el('span', { cls: 'zk-label', text: 'ザトウクジラ 調査ファイル' }),
      el('h1', { cls: 'zk-title', text: 'クジラ図鑑' }),
      el('p', { cls: 'zk-note', text: '尾びれの裏の模様は1頭ずつちがいます。水面に姿を見せたクジラが、ここにのります(鳴き声だけのときは数えません)。会うたびに、くわしいことがわかっていきます。' }),
    );
    const list = el('ol', { cls: 'zk-files' });
    if (!entries.length) list.append(el('li', { cls: 'zk-note', text: 'まだだれものっていません。クジラが姿を見せるのを待ちましょう' }));
    for (const e of entries) {
      const item = el('button', { cls: 'zk-file' }, [
        el('span', { cls: 'zk-file-no', text: no(e.id) }),
        flukeCanvas(e, 120, 34),
        el('span', { cls: 'zk-file-text' }, [
          el('b', { text: e.displayName }),
          el('small', { text: `さいご ${day(e.last)}` }),
        ]),
        el('span', { cls: 'zk-file-stamp', text: `${e.count}回` }),
      ]);
      item.addEventListener('click', () => go({ tab: 'whales', detail: e.id }));
      list.append(el('li', {}, [item]));
    }
    out.append(list);
  }

  // ---- 1頭の調査書類 ----
  async function renderDetail(e, out) {
    const info = zukanInfo(e, e);
    const rename = el('button', { cls: 'zk-link', text: '名前を付ける' });
    const nameBox = el('div', { cls: 'zk-namebox' }, [
      el('span', { cls: 'zk-label', text: 'ザトウクジラ 調査記録' }),
      el('h1', { cls: 'zk-title', text: e.displayName }),
      e.nickname ? el('small', { cls: 'zk-sub', text: `模様から付けた名前: ${e.autoName}` }) : el('span'),
      rename,
    ]);
    rename.addEventListener('click', () => startRename(nameBox, e));
    const stamp = el('div', { cls: 'zk-stamp', attrs: { 'aria-label': `確認 ${info.count}回` } }, [el('span', { text: '確認' }), el('b', { text: `${info.count}回` })]);
    out.append(el('div', { cls: 'zk-top' }, [nameBox, stamp]));

    // クリップで留めた全身の姿(3Dの絵)
    const clip = el('div', { cls: 'zk-clipped' }, [el('span', { cls: 'zk-clip', attrs: { 'aria-hidden': 'true' } })]);
    if (info.open.portrait) {
      const url = portrait(e);
      clip.append(url
        ? el('img', { cls: 'zk-portrait', attrs: { src: url, alt: `${e.displayName}の全身の姿` } })
        : el('div', { cls: 'zk-portrait zk-locked', text: '全身の姿を描けませんでした' }));
      clip.append(el('span', { cls: 'zk-caption', text: '全身の姿' }));
    } else {
      clip.append(el('div', { cls: 'zk-portrait zk-locked', text: 'このクジラの写真を撮ると、全身の姿がのります' }));
    }
    out.append(clip);

    // 数字
    const unknown = '？';
    const cell = (k, v) => el('div', { cls: 'zk-cell' }, [el('span', { text: k }), el('b', { text: v })]);
    out.append(el('div', { cls: 'zk-grid' }, [
      cell('全長', info.open.length ? `${info.length.toFixed(1)} m` : unknown),
      cell('体重', info.open.weight ? `約${info.weight} t` : unknown),
      cell('はじめて', day(e.first)),
      cell('さいご', day(e.last)),
    ]));

    // 特徴
    out.append(el('span', { cls: 'zk-label', text: '特徴' }));
    if (info.open.comment) out.append(el('p', { cls: 'zk-text', text: info.comment }));
    else {
      const t = traitsText(e);
      out.append(el('p', { cls: 'zk-text zk-dim', text: t.length ? `${t[0]}…(くわしくは、もっと会うとわかります)` : 'もっと会うと、わかります' }));
    }
    if (info.next) out.append(el('p', { cls: 'zk-next', text: info.next.text }));

    // 尾びれの裏と写真
    const mine = photosOf(await photos.list(), e.id);
    out.append(el('div', { cls: 'zk-bottom' }, [
      el('div', { cls: 'zk-fluke' }, [el('span', { cls: 'zk-label', text: '尾びれの裏' }), flukeCanvas(e, 300, 84)]),
      mine.length ? polaroids(mine.slice(0, 6)) : el('span'),
    ]));
    out.append(el('span', { cls: 'zk-note', text: mine.length
      ? `写真 ${mine.length}枚 ・ 押すと大きく見られます`
      : 'この子が写っている写真は、まだありません。パネルのシャッターで撮れます' }));
  }

  // 名前を入力する欄を出す
  function startRename(box, e) {
    const form = el('form', { cls: 'zk-form' });
    const input = el('input', { attrs: { type: 'text', maxlength: String(NAME_MAX), placeholder: e.autoName, 'aria-label': `${e.displayName}の名前` } });
    input.value = e.nickname ?? '';
    const ok = el('button', { cls: 'zk-btn dark', text: '決める', attrs: { type: 'submit' } });
    const cancel = el('button', { cls: 'zk-btn dark', text: 'やめる', attrs: { type: 'button' } });
    cancel.addEventListener('click', render);
    form.addEventListener('submit', ev => { ev.preventDefault(); onRename(e.id, input.value); });
    form.append(input, ok, cancel);
    box.replaceChildren(el('span', { cls: 'zk-label', text: '名前を付ける' }), form,
      el('small', { cls: 'zk-sub', text: `${NAME_MAX}文字まで。空にすると「${e.autoName}」にもどります` }));
    input.focus();
  }

  // ---- 写真 ----
  async function renderPhotos(out) {
    const list = (await photos.list()).sort((a, b) => b.time - a.time);
    out.append(
      el('span', { cls: 'zk-label', text: '写真の記録' }),
      el('h1', { cls: 'zk-title', text: '写真' }),
      el('p', { cls: 'zk-note', text: `撮った写真 ${list.length}枚(${photos.max}枚まで。こえると古いものから消えます)。パネルのシャッターで撮れます` }),
    );
    if (list.length) out.append(polaroids(list, 'large'));
  }

  let renderId = 0;
  async function render() {
    const id = ++renderId;
    count.textContent = `${entries.length} / ${FLUKE_ID.size} 頭`;
    const e = state.detail && entries.find(x => x.id === state.detail);
    back.hidden = !e && state.tab === 'whales';
    renderTabs();
    const out = el('div', { cls: 'zk-sheet' });
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
