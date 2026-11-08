import { drawFluke } from './flukeCanvas.js';
import { whaleCard, bookCard, shareCanvas, shareText } from './shareCard.js';
import { tr } from '../logic/i18n.js';
import { bookTotal, NAME_MAX } from '../logic/flukeId.js';
import { traitsText } from '../logic/traits.js';
import { zukanInfo, ZUKAN_LEVELS } from '../logic/zukan.js';
import { photosOf, photoCaption } from '../logic/photos.js';
import { scoreLine } from '../logic/photoScore.js';
import { whereNow, tripSummary, ROUTES, TIME_SCALE, pathUntil } from '../logic/migration.js';
const pathUntilNow = w => pathUntil(w.route, w.k);
import { drawMigrationMap, MAP_ASPECT } from './migrationMap.js';
import { songVersion, seasonKey } from '../logic/songs.js';
import { researchRound, loadResearch, saveResearch, answerResearch, rankOf, RESEARCH } from '../logic/research.js';

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
export function createZukan(root, { onRename, onBackup, onRestore, photos, portrait, nameOf, songs = () => ({}), onPlaySong, storage = null }) {
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

  // ---- 共有用の1枚 ----
  // スマホでは共有の画面(X・Instagram などを選べる)を出す。出せないときは画像を大きく出して、保存してもらう
  const pageUrl = () => (typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '');
  async function share(button, make, text, filename) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = T('画像を作っています…', 'Making the image…');
    try {
      const canvas = await make();
      const result = await shareCanvas(canvas, { text, url: pageUrl(), filename });
      if (result === 'fallback') {
        shown = null;
        big.src = canvas.toDataURL('image/jpeg', 0.92);
        caption.textContent = T(`${text} ${pageUrl()} ・ 画像を長押し(パソコンは「保存する」)して保存し、X や Instagram に投稿できます`,
          `${text} ${pageUrl()} · Long-press the image (or use Save) to keep it, then post it to X or Instagram`);
        save.href = big.src;
        save.download = filename;
        del.hidden = true;
        viewer.hidden = false;
      }
    } catch {
      button.textContent = T('画像を作れませんでした', 'Could not make the image');
      setTimeout(() => { button.textContent = label; }, 2500);
      button.disabled = false;
      return;
    }
    button.textContent = label;
    button.disabled = false;
  }

  function go(next) {
    state = next;
    render();
    view.scrollTop = 0;
  }

  function openPhoto(p) {
    shown = p;
    big.src = photos.url(p);
    caption.textContent = [scoreLine(p.score), photoCaption(p, nameOf)].filter(Boolean).join(T(' ・ ', ' · '));
    save.href = big.src;
    save.download = `whale-${new Date(p.time).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;
    del.hidden = false;
    viewer.hidden = false;
  }

  // ポラロイド写真のように貼った、撮った写真
  function polaroids(list, size = 'small') {
    const row = el('div', { cls: `zk-polaroids zk-polaroids-${size}` });
    list.forEach((p, i) => {
      const b = el('button', { cls: 'zk-polaroid', attrs: { 'aria-label': photoCaption(p, nameOf), style: `transform: rotate(${[-4, 3, -2, 4, -3][i % 5]}deg)` } },
        [el('img', { attrs: { src: photos.url(p), alt: '' } })]);
      // 採点した写真には、点数のバッジ(前に撮った、点数のない写真には付けない)
      // はんこを押したような丸い印。大きくランク、下に小さく点数。写真ごとに少しずつ傾きを変える
      if (p.score) b.append(el('span', { cls: `zk-score zk-score-${p.score.rank}`, attrs: { 'aria-hidden': 'true', style: `--tilt: ${[-14, 9, -6, 12, -10][i % 5]}deg` } },
        [el('b', { text: p.score.rank }), el('small', { text: String(p.score.total) })]));
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
      tab(T('歌', 'Songs'), state.tab === 'songs', () => go({ tab: 'songs', detail: null }));
      tab(T('研究', 'Research'), state.tab === 'research', () => go({ tab: 'research', detail: null }));
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
    else out.append(bookShareButton());
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
    out.append(list, backupBox());
  }

  // ---- バックアップ(機種変更のときなどに) ----
  function backupBox() {
    const msg = el('p', { cls: 'zk-backup-msg', attrs: { role: 'status' } });
    const save = el('button', { cls: 'zk-backup-btn', text: T('ファイルに書き出す', 'Save to a file') });
    const pick = el('input', { attrs: { type: 'file', accept: '.json,application/json', hidden: '' } });
    const load = el('button', { cls: 'zk-backup-btn', text: T('ファイルから読み込む', 'Load from a file') });
    save.addEventListener('click', async () => {
      save.disabled = true;
      try { msg.textContent = await onBackup?.() ?? ''; } finally { save.disabled = false; }
    });
    load.addEventListener('click', () => pick.click());
    pick.addEventListener('change', async () => {
      const file = pick.files?.[0];
      pick.value = '';
      if (!file) return;
      load.disabled = true;
      try { msg.textContent = await onRestore?.(file) ?? ''; } finally { load.disabled = false; }
    });
    return el('div', { cls: 'zk-backup' }, [
      el('h2', { text: T('バックアップ', 'Backup') }),
      el('p', { cls: 'zk-note', text: T('図鑑と写真は、この端末のブラウザの中にだけ保存されています。機種変更の前などに、ファイルに書き出しておくと安心です。読み込むと、いまの図鑑と合わせます(消えることはありません)。', 'Your Book and photos are stored only in this browser. Save them to a file before changing phones. Loading a file merges it with your current Book; nothing is removed.') }),
      el('div', { cls: 'zk-backup-row' }, [save, load, pick]),
      msg,
    ]);
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
    const shareBtn = el('button', { cls: 'zk-share', text: T('この子をシェアする(X・Instagram)', 'Share this whale (X, Instagram)') });
    shareBtn.addEventListener('click', async () => {
      const mine = photosOf(await photos.list(), e.id);
      const name = e.displayName;
      share(shareBtn, () => whaleCard({
        entry: e,
        photos: mine.map(p => photos.url(p)),
        portrait: zukanInfo(e, e).open.portrait ? portrait(e) : null,
        drawFlukeOn: c => drawFluke(c, e),
        features: zukanInfo(e, e).open.comment ? traitsText(e).slice(0, 2) : [],
        url: pageUrl(),
      }), shareText({ kind: 'whale', name, count: e.count }), `whale-${String(e.id).padStart(2, '0')}.jpg`);
    });
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

    // 回遊の記録(はじめて会ったときに付けたタグ)
    out.append(...migrationSection(e));

    // 尾びれの裏と写真
    const mine = photosOf(await photos.list(), e.id);
    out.append(el('div', { cls: 'zk-bottom' }, [
      el('div', { cls: 'zk-fluke' }, [el('span', { cls: 'zk-label', text: T('尾びれの裏', 'Fluke underside') }), flukeCanvas(e, 300, 84)]),
      mine.length ? polaroids(mine.slice(0, 6)) : el('span'),
    ]));
    out.append(el('span', { cls: 'zk-note', text: mine.length
      ? T(`写真 ${mine.length}枚 ・ 押すと大きく見られます`, `${mine.length} photo${mine.length > 1 ? 's' : ''} · tap to enlarge`)
      : T('この子が写っている写真は、まだありません。パネルのシャッターで撮れます', 'No photos of this whale yet. Use the shutter on the panel.') }));
    out.append(shareBtn);
  }

  // 回遊の記録: 地図と、いまいるところ、前回の旅
  function migrationSection(e) {
    const parts = [el('span', { cls: 'zk-label', text: T('回遊の記録(タグ)', 'Migration tag') })];
    if (!e.tag) {
      parts.push(el('p', { cls: 'zk-text zk-dim', text: T('つぎに会ったときにタグを付けて、どこを旅しているかがわかるようになります', 'It will be tagged the next time you meet, so you can follow its journey.') }));
      return parts;
    }
    const now = Date.now();
    const w = whereNow(e.tag, now);
    const trip = e.trips?.length ? tripSummary(e.trips[e.trips.length - 1]) : null;
    const canvas = el('canvas', { cls: 'zk-map', attrs: { width: '600', height: String(Math.round(600 * MAP_ASPECT)), role: 'img',
      'aria-label': T(`回遊の地図。いまは${tr(w.region)}のあたり`, `Migration map. Now near ${tr(w.region)}`) } });
    drawMigrationMap(canvas, { current: { path: w.laps > 0 ? w.route.line : pathUntilNow(w), point: w.point }, last: trip });
    const stage = {
      leaving: T('いま、旅に出たところです', 'It has just set out'),
      north: T('北の海へ向かっています', 'Heading north to its feeding grounds'),
      feeding: T('北の海で、たくさん食べています', 'Feeding in the northern sea'),
      south: T('南へもどってきています', 'Heading back south'),
      home: T('もうすぐ、あなたの海にもどってきます', 'Almost back to your sea'),
    }[w.stage];
    const km = n => n.toLocaleString();
    parts.push(canvas, el('p', { cls: 'zk-text', text: T(
      `いまは「${tr(w.region)}」のあたり。あなたの海から約${km(w.fromHomeKm)}km。${stage}。`,
      `Now near ${tr(w.region)}, about ${km(w.fromHomeKm)} km from your sea. ${stage}.`) }));
    const months = d => Math.max(1, Math.round(d / 30));
    if (trip) {
      const t = e.trips[e.trips.length - 1];
      parts.push(el('p', { cls: 'zk-text zk-trip', text: T(
        `前回の旅(${day(t.from)}〜${day(t.to)}): ${tr(ROUTES[trip.kind])}。いちばん遠くは「${tr(trip.farthest)}」、およそ${km(trip.km)}km。クジラの時間で約${months(trip.whaleDays)}か月の旅でした`,
        `Last journey (${day(t.from)} – ${day(t.to)}): ${tr(ROUTES[trip.kind])}. Farthest point: ${tr(trip.farthest)}. About ${km(trip.km)} km — around ${months(trip.whaleDays)} month${months(trip.whaleDays) > 1 ? 's' : ''} in whale time.`) }));
    } else {
      parts.push(el('p', { cls: 'zk-next', text: T('もう一度会うと、そのあいだに回ってきた旅の道すじが、地図にのります', 'Meet it again to add the route of its journey to the map.') }));
    }
    parts.push(el('span', { cls: 'zk-note', text: T(
      `青い線: いまの旅 ・ オレンジの点線: 前回の旅。図鑑の海では、時間が約${Math.round(TIME_SCALE)}倍の速さで流れます(3日で1年ぶんの旅)`,
      `Blue: current journey · Orange dots: last journey. Time runs about ${Math.round(TIME_SCALE)}× faster here (a year's journey in 3 days).`) }));
    return parts;
  }

  // ---- 歌のコレクション ----
  const monthLabel = key => { const [y, m] = key.split('-').map(Number); return T(`${y}年${m}月の歌`, `${MONTHS[m - 1]} ${y} song`); };
  function songCard(key, heardAt) {
    const v = songVersion(key);
    const pitch = v.rate < 0.985 ? T('低め', 'lower') : v.rate > 1.015 ? T('高め', 'higher') : T('ふつう', 'middle');
    const change = { revolution: T('新しい歌に入れかわった月', 'A brand-new song arrived'), swap: T('テーマの順番が入れかわった', 'Two themes swapped'),
      repeat: T('テーマを1つくり返すようになった', 'One theme is now repeated'), drop: T('テーマが1つへった', 'One theme was dropped'),
      same: T('先月とほぼ同じ', 'Almost the same as last month'), first: T('記録のはじまりの歌', 'The first recorded song') }[v.changed];
    const play = el('button', { cls: 'zk-btn dark', text: T('▶ 試し聞き(20秒)', '▶ Listen (20s)') });
    play.addEventListener('click', () => {
      if (onPlaySong?.(key) === false) play.textContent = T('海に出てから聞けます', 'Start the sea first');
    });
    return el('li', { cls: 'zk-song' }, [
      el('div', { cls: 'zk-song-head' }, [el('b', { text: monthLabel(key) }), heardAt ? el('small', { text: T(`はじめて聞いた日 ${day(heardAt)}`, `First heard ${day(heardAt)}`) }) : el('span')]),
      el('div', { cls: 'zk-themes' }, v.letters.map(l => el('span', { cls: 'zk-theme', text: l }))),
      el('p', { cls: 'zk-text', text: T(`高さ: ${pitch} ・ ${change}`, `Pitch: ${pitch} · ${change}`) }),
      play,
    ]);
  }
  function renderSongs(out) {
    const heard = songs();
    const now = seasonKey();
    out.append(
      el('span', { cls: 'zk-label', text: T('ザトウクジラ 歌の記録', 'Humpback song log') }),
      el('h1', { cls: 'zk-title', text: T('歌のコレクション', 'Song collection') }),
      el('p', { cls: 'zk-note', text: T('同じ海のオスは、みんな同じ歌をうたいます。歌は月ごとに少しずつ形を変え、毎年7月には、新しい歌にがらりと入れかわります(歌の革命)。クジラの歌を聞くと、その月の歌がここに記録されます。', 'Males in the same sea all sing the same song. It changes a little every month, and each July a brand-new song takes over (a “song revolution”). Hear a whale sing to log that month’s song here.') }),
    );
    const keys = Object.keys(heard).sort().reverse();
    if (!heard[now]) out.append(el('p', { cls: 'zk-next', text: T(`${monthLabel(now)}は、まだ聞いていません`, `You haven't heard the ${monthLabel(now)} yet`) }));
    if (!keys.length) { out.append(el('p', { cls: 'zk-note', text: T('まだ記録された歌はありません', 'No songs logged yet') })); return; }
    out.append(el('ol', { cls: 'zk-songs' }, keys.map(k => songCard(k, heard[k]))));
  }

  // ---- 研究者ごっこ ----
  let quiz = null;
  const seededRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
  // 海で撮ったような尾びれの写真(かたむき・大きさ・暗さ・しぶき)
  function quizPhoto(e, photo) {
    const c = el('canvas', { cls: 'zk-quiz-photo', attrs: { width: '640', height: '360', role: 'img', 'aria-label': T('海で撮った尾びれの写真', 'A fluke photo taken at sea') } });
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, 360);
    sky.addColorStop(0, '#9cc3dc'); sky.addColorStop(0.62, '#d7e8f2'); sky.addColorStop(0.63, '#2f6f9a'); sky.addColorStop(1, '#173f5c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 640, 360);
    const f = document.createElement('canvas'); f.width = 480; f.height = 134;
    drawFluke(f, e);
    ctx.save();
    ctx.translate(320 + photo.shift * 640, 170);
    ctx.rotate(photo.rot);
    ctx.scale(photo.zoom, photo.zoom);
    ctx.drawImage(f, -240, -67);
    ctx.restore();
    ctx.fillStyle = `rgba(10, 20, 30, ${photo.dark})`; ctx.fillRect(0, 0, 640, 360);
    const rng = seededRng(photo.seed);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let k = 0; k < photo.spray; k++) { ctx.beginPath(); ctx.arc(160 + rng() * 320, 150 + rng() * 120, 1 + rng() * 3.5, 0, 7); ctx.fill(); }
    return c;
  }
  function renderResearch(out) {
    const st = loadResearch(storage ?? { getItem: () => null, setItem() {} });
    const { rank, next } = rankOf(st.correct);
    out.append(
      el('span', { cls: 'zk-label', text: T('研究者ごっこ', 'Be a researcher') }),
      el('h1', { cls: 'zk-title', text: T('この尾びれは、だれ？', 'Whose fluke is this?') }),
      el('p', { cls: 'zk-note', text: T('研究者は、尾びれの裏の模様と傷あとで、クジラを1頭ずつ見分けます。海で撮った写真と、図鑑の尾びれを見くらべて、同じ子をえらんでください。', 'Researchers tell humpbacks apart by the pattern and scars under the fluke. Compare the photo from the sea with the flukes in your Book and pick the same whale.') }),
      el('p', { cls: 'zk-rank', text: T(`肩書き: ${rank.ja} ・ 正解 ${st.correct}回 ・ 連続の最高 ${st.best}回${next ? ` ・ あと${next.more}回で「${next.rank.ja}」` : ''}`, `Title: ${rank.en} · ${st.correct} correct · best streak ${st.best}${next ? ` · ${next.more} more to “${next.rank.en}”` : ''}`) }),
    );
    if (entries.length < RESEARCH.minWhales) {
      out.append(el('p', { cls: 'zk-next', text: T(`図鑑に${RESEARCH.minWhales}頭以上のると、遊べます(いま${entries.length}頭)`, `Add at least ${RESEARCH.minWhales} whales to your Book to play (now ${entries.length})`) }));
      return;
    }
    if (!quiz || quiz.done === 'next') quiz = { round: researchRound(entries), picked: null };
    const { round } = quiz;
    const target = entries.find(e => e.id === round.answer);
    out.append(quizPhoto(target, round.photo));
    const row = el('div', { cls: 'zk-quiz-choices' });
    for (const id of round.choices) {
      const e = entries.find(x => x.id === id);
      const b = el('button', { cls: `zk-quiz-choice${quiz.picked != null ? (id === round.answer ? ' right' : id === quiz.picked ? ' wrong' : '') : ''}` },
        [flukeCanvas(e, 300, 84), el('span', { text: `${no(e.id)} ${e.displayName}` })]);
      b.disabled = quiz.picked != null;
      b.addEventListener('click', () => {
        quiz.picked = id;
        const ok = id === round.answer;
        saveResearch(storage ?? { setItem() {} }, answerResearch(st, ok));
        render();
      });
      row.append(b);
    }
    out.append(row);
    if (quiz.picked != null) {
      const ok = quiz.picked === round.answer;
      out.append(el('p', { cls: ok ? 'zk-quiz-ok' : 'zk-quiz-ng', text: ok
        ? T(`正解！ ${no(target.id)} ${target.displayName}でした`, `Correct! It was ${no(target.id)} ${target.displayName}`)
        : T(`ざんねん。正解は ${no(target.id)} ${target.displayName}でした。白いところの形と、傷あとを見くらべてみてね`, `Not quite. It was ${no(target.id)} ${target.displayName}. Compare the white shapes and the scars.`) }));
      const nextBtn = el('button', { cls: 'zk-share', text: T('つぎの写真', 'Next photo') });
      nextBtn.addEventListener('click', () => { quiz.done = 'next'; render(); });
      out.append(nextBtn);
    }
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
    out.append(bookShareButton());
    if (list.length) out.append(polaroids(list, 'large'));
  }

  // 図鑑まとめをシェアするボタン(撮った写真と、付けた名前を1枚に)
  function bookShareButton() {
    const b = el('button', { cls: 'zk-share', text: T('写真と名前を1枚にまとめてシェア(X・Instagram)', 'Share my photos and whales in one image (X, Instagram)') });
    b.addEventListener('click', async () => {
      const shots = (await photos.list()).sort((x, y) => y.time - x.time).slice(0, 6);
      share(b, () => bookCard({
        photos: shots.map(p => photos.url(p)),
        captions: shots.map(p => (p.whales ?? []).map(nameOf).filter(n => entries.some(x => x.displayName === n)).join(T('、', ', '))),
        entries, total: bookTotal(entries), url: pageUrl(),
      }), shareText({ kind: 'book', met: entries.length, total: bookTotal(entries) }), 'whale-book.jpg');
    });
    return b;
  }

  let renderId = 0;
  async function render() {
    const id = ++renderId;
    count.textContent = T(`${entries.length} / ${bookTotal(entries)} 頭`, `${entries.length} / ${bookTotal(entries)}`);
    const e = state.detail && entries.find(x => x.id === state.detail);
    back.hidden = !e && state.tab === 'whales';
    renderTabs();
    const out = el('div', { cls: 'zk-sheet' });
    if (state.tab === 'photos') await renderPhotos(out);
    else if (state.tab === 'songs') renderSongs(out);
    else if (state.tab === 'research') renderResearch(out);
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
    close() { panel.hidden = true; viewer.hidden = true; },
  };
}
