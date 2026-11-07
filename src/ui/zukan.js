import { drawFluke } from './flukeCanvas.js';
import { tr } from '../logic/i18n.js';
import { FLUKE_ID, NAME_MAX } from '../logic/flukeId.js';
import { traitsText } from '../logic/traits.js';
import { zukanInfo, ZUKAN_LEVELS } from '../logic/zukan.js';
import { photosOf, photoCaption } from '../logic/photos.js';

// 日付を「11/6」の形に
const T = (ja, en) => tr({ ja, en });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = ms => { const d = new Date(ms); return T(`${d.getMonth() + 1}/${d.getDate()}`, `${MONTHS[d.getMonth()]} ${d.getDate()}`); };
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
  const panel = el('section', { cls: 'zk', attrs: { 'aria-label': T('クジラ図鑑', 'Whale Book') } });
  panel.hidden = true;
  const back = el('button', { cls: 'zk-btn', text: T('← ファイル一覧', '← All files') });
  const count = el('span', { cls: 'zk-count' });
  const close = el('button', { cls: 'zk-btn', text: T('閉じる', 'Close') });
  const tabs = el('div', { cls: 'zk-tabs', attrs: { role: 'group', 'aria-label': T('図鑑のファイル', 'Book sections') } });
  const view = el('div', { cls: 'zk-paper' });
  panel.append(
    el('div', { cls: 'zk-inner' }, [
      el('div', { cls: 'zk-head' }, [back, count, close]),
      tabs,
      el('div', { cls: 'zk-folder' }, [view]),
    ]),
  );

  // 写真を大きく見る
  const viewer = el('div', { cls: 'photo-view', attrs: { role: 'dialog', 'aria-label': T('写真', 'Photo') } });
  viewer.hidden = true;
  const big = el('img', { attrs: { alt: '' } });
  const caption = el('p', { cls: 'photo-caption' });
  const save = el('a', { cls: 'full photo-btn', text: T('保存する', 'Save') });
  const del = el('button', { cls: 'full', text: T('消す', 'Delete') });
  const closeViewer = el('button', { cls: 'full', text: T('閉じる', 'Close') });
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
      // 画像を出せなかったときは、そのことを書いておく(まっ白なままにしない)
      b.querySelector('img').addEventListener('error', e => e.currentTarget.replaceWith(el('span', { cls: 'zk-photo-broken', text: T('写真を表示できませんでした', 'Could not show this photo') })), { once: true });
      b.addEventListener('click', () => openPhoto(p));
      row.append(b);
    });
    return row;
  }

  function flukeCanvas(e, w, h, label) {
    const c = el('canvas', { attrs: { role: 'img', 'aria-label': label ?? T(`${e.displayName}の尾びれの裏`, `Underside of ${e.displayName}'s fluke`) } });
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
      tab(T('ファイル一覧', 'Whales'), state.tab === 'whales', () => go({ tab: 'whales', detail: null }));
      tab(T('写真', 'Photos'), state.tab === 'photos', () => go({ tab: 'photos', detail: null }));
    }
  }

  // ---- ファイル一覧 ----
  function renderList(out) {
    out.append(
      el('span', { cls: 'zk-label', text: T('ザトウクジラ 調査ファイル', 'Humpback whale survey files') }),
      el('h1', { cls: 'zk-title', text: T('クジラ図鑑', 'Whale Book') }),
      el('p', { cls: 'zk-note', text: T('尾びれの裏の模様は1頭ずつちがいます。水面に姿を見せたクジラが、ここにのります(鳴き声だけのときは数えません)。会うたびに、くわしいことがわかっていきます。', 'Every whale has its own pattern under the fluke. Whales that show themselves at the surface are recorded here (calls alone don\'t count). You learn more each time you meet them.') }),
    );
    const list = el('ol', { cls: 'zk-files' });
    if (!entries.length) list.append(el('li', { cls: 'zk-note', text: T('まだだれものっていません。クジラが姿を見せるのを待ちましょう', 'No whales yet. Wait for one to show itself.') }));
    for (const e of entries) {
      const item = el('button', { cls: 'zk-file' }, [
        el('span', { cls: 'zk-file-no', text: no(e.id) }),
        flukeCanvas(e, 120, 34),
        el('span', { cls: 'zk-file-text' }, [
          el('b', { text: e.displayName }),
          el('small', { text: T(`さいご ${day(e.last)}`, `Last seen ${day(e.last)}`) }),
        ]),
        el('span', { cls: 'zk-file-stamp', text: T(`${e.count}回`, `×${e.count}`) }),
      ]);
      item.addEventListener('click', () => go({ tab: 'whales', detail: e.id }));
      list.append(el('li', {}, [item]));
    }
    out.append(list);
  }

  // ---- 1頭の調査書類 ----
  async function renderDetail(e, out) {
    const info = zukanInfo(e, e);
    const rename = el('button', { cls: 'zk-link', text: T('名前を付ける', 'Rename') });
    const nameBox = el('div', { cls: 'zk-namebox' }, [
      el('span', { cls: 'zk-label', text: T('ザトウクジラ 調査記録', 'Humpback whale survey record') }),
      el('h1', { cls: 'zk-title', text: e.displayName }),
      e.nickname ? el('small', { cls: 'zk-sub', text: T(`模様から付けた名前: ${e.autoName}`, `Name from its markings: ${e.autoName}`) }) : el('span'),
      rename,
    ]);
    rename.addEventListener('click', () => startRename(nameBox, e));
    const stamp = el('div', { cls: 'zk-stamp', attrs: { 'aria-label': T(`確認 ${info.count}回`, `Seen ${info.count} times`) } }, [el('span', { text: T('確認', 'Seen') }), el('b', { text: T(`${info.count}回`, `×${info.count}`) })]);
    out.append(el('div', { cls: 'zk-top' }, [nameBox, stamp]));

    // クリップで留めた全身の姿(3Dの絵)
    const clip = el('div', { cls: 'zk-clipped' }, [el('span', { cls: 'zk-clip', attrs: { 'aria-hidden': 'true' } })]);
    if (info.open.portrait) {
      const url = portrait(e);
      clip.append(url
        ? el('img', { cls: 'zk-portrait', attrs: { src: url, alt: T(`${e.displayName}の全身の姿`, `Full-body portrait of ${e.displayName}`) } })
        : el('div', { cls: 'zk-portrait zk-locked', text: T('全身の姿を描けませんでした', 'Could not draw the portrait') }));
      clip.append(el('span', { cls: 'zk-caption', text: T('全身の姿', 'Full body') }));
    } else {
      clip.append(el('div', { cls: 'zk-portrait zk-locked', text: T('このクジラの写真を撮ると、全身の姿がのります', 'Take a photo of this whale to add its full-body portrait') }));
    }
    out.append(clip);

    // 数字
    const unknown = T('？', '?');
    const cell = (k, v) => el('div', { cls: 'zk-cell' }, [el('span', { text: k }), el('b', { text: v })]);
    out.append(el('div', { cls: 'zk-grid' }, [
      cell(T('全長', 'Length'), info.open.length ? `${info.length.toFixed(1)} m` : unknown),
      cell(T('体重', 'Weight'), info.open.weight ? T(`約${info.weight} t`, `~${info.weight} t`) : unknown),
      cell(T('はじめて', 'First seen'), day(e.first)),
      cell(T('さいご', 'Last seen'), day(e.last)),
    ]));

    // 特徴
    out.append(el('span', { cls: 'zk-label', text: T('特徴', 'Features') }));
    if (info.open.comment) out.append(el('p', { cls: 'zk-text', text: info.comment }));
    else {
      const t = traitsText(e);
      out.append(el('p', { cls: 'zk-text zk-dim', text: t.length ? T(`${t[0]}…(くわしくは、もっと会うとわかります)`, `${t[0]}… (meet it more to learn more)`) : T('もっと会うと、わかります', 'Meet it more to find out') }));
    }
    if (info.next) out.append(el('p', { cls: 'zk-next', text: info.next.text }));

    // 尾びれの裏と写真
    const mine = photosOf(await photos.list(), e.id);
    out.append(el('div', { cls: 'zk-bottom' }, [
      el('div', { cls: 'zk-fluke' }, [el('span', { cls: 'zk-label', text: T('尾びれの裏', 'Fluke underside') }), flukeCanvas(e, 300, 84)]),
      mine.length ? polaroids(mine.slice(0, 6)) : el('span'),
    ]));
    out.append(el('span', { cls: 'zk-note', text: mine.length
      ? T(`写真 ${mine.length}枚 ・ 押すと大きく見られます`, `${mine.length} photo${mine.length > 1 ? 's' : ''} · tap to enlarge`)
      : T('この子が写っている写真は、まだありません。パネルのシャッターで撮れます', 'No photos of this whale yet. Use the shutter on the panel.') }));
  }

  // 名前を入力する欄を出す
  function startRename(box, e) {
    const form = el('form', { cls: 'zk-form' });
    const input = el('input', { attrs: { type: 'text', maxlength: String(NAME_MAX), placeholder: e.autoName, 'aria-label': T(`${e.displayName}の名前`, `Name for ${e.displayName}`) } });
    input.value = e.nickname ?? '';
    const ok = el('button', { cls: 'zk-btn dark', text: T('決める', 'Save'), attrs: { type: 'submit' } });
    const cancel = el('button', { cls: 'zk-btn dark', text: T('やめる', 'Cancel'), attrs: { type: 'button' } });
    cancel.addEventListener('click', render);
    form.addEventListener('submit', ev => { ev.preventDefault(); onRename(e.id, input.value); });
    form.append(input, ok, cancel);
    box.replaceChildren(el('span', { cls: 'zk-label', text: T('名前を付ける', 'Rename') }), form,
      el('small', { cls: 'zk-sub', text: T(`${NAME_MAX}文字まで。空にすると「${e.autoName}」にもどります`, `Up to ${NAME_MAX} characters. Leave empty to go back to "${e.autoName}".`) }));
    input.focus();
  }

  // ---- 写真 ----
  async function renderPhotos(out) {
    const list = (await photos.list()).sort((a, b) => b.time - a.time);
    out.append(
      el('span', { cls: 'zk-label', text: T('写真の記録', 'Photo log') }),
      el('h1', { cls: 'zk-title', text: T('写真', 'Photos') }),
      el('p', { cls: 'zk-note', text: T(`撮った写真 ${list.length}枚(${photos.max}枚まで。こえると古いものから消えます)。パネルのシャッターで撮れます`, `${list.length} photos (up to ${photos.max}; the oldest are removed beyond that). Use the shutter on the panel.`) }),
    );
    if (list.length) out.append(polaroids(list, 'large'));
  }

  let renderId = 0;
  async function render() {
    const id = ++renderId;
    count.textContent = T(`${entries.length} / ${FLUKE_ID.size} 頭`, `${entries.length} / ${FLUKE_ID.size}`);
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
