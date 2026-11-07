// 図鑑のクジラと撮った写真を、1枚の画像にまとめる(X や Instagram に共有できる大きさ)。
// 大きさは 1080×1350(Instagram の縦長の投稿と同じ 4:5。X でもそのまま見られる)
import { tr } from '../logic/i18n.js';

const T = (ja, en) => tr({ ja, en });
export const CARD = Object.freeze({ width: 1080, height: 1350 });
const FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", system-ui, sans-serif';
const MONO = '"M PLUS 1 Code", ui-monospace, monospace';
const PAPER = '#f3ecdd', INK = '#2b2620', DIM = '#6b6456', RED = '#b8432f', NAVY = '#0b2a4a';

// アプリの名前と、共有するときの言葉
export const APP_NAME = () => T('クジラが見てる', 'Whale Watch');
export const HASHTAG = () => T('#クジラが見てる', '#WhaleWatchApp');

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// 文字を、はばに合わせて行に分ける(日本語は1文字ずつ、英語は単語ごと)
export function wrapLines(ctx, text, width, maxLines = 3) {
  const words = /[぀-ヿ一-鿿]/.test(text) ? Array.from(text) : text.split(/(\s+)/);
  const lines = [];
  let line = '', cut = false;
  for (const w of words) {
    const next = line + w;
    if (ctx.measureText(next).width > width && line.trim()) {
      lines.push(line.trim());
      line = w.trimStart();
      if (lines.length === maxLines) { cut = true; break; }
    } else line = next;
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  if (cut) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > width && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

// 画像を、決めた枠いっぱいに(はみだすところは切って)描く
function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

// ポラロイド写真のように、白いふちを付けて少しかたむけて貼る
function polaroid(ctx, img, cx, cy, w, h, deg, caption) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  const pad = Math.round(w * 0.035), bottom = caption ? Math.round(w * 0.13) : pad;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad + bottom);
  ctx.shadowColor = 'transparent';
  if (img) cover(ctx, img, -w / 2, -h / 2, w, h);
  else { ctx.fillStyle = '#5d8db5'; ctx.fillRect(-w / 2, -h / 2, w, h); }
  if (caption) {
    ctx.fillStyle = DIM;
    ctx.font = `${Math.round(w * 0.055)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(caption, 0, h / 2 + bottom * 0.68, w);
  }
  ctx.restore();
}

function background(ctx) {
  const { width: W, height: H } = CARD;
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  // 紙の書類(図鑑と同じ色)
  ctx.fillStyle = '#d9b97f';
  roundRect(ctx, 40, 150, W - 80, H - 230, 36); ctx.fill();
  ctx.fillStyle = PAPER;
  roundRect(ctx, 64, 176, W - 128, H - 282, 24); ctx.fill();
  // 上の帯: アプリの名前
  ctx.fillStyle = '#eef3f7';
  ctx.font = `700 54px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(APP_NAME(), 64, 96);
  ctx.font = `30px ${FONT}`;
  ctx.fillStyle = 'rgba(238,243,247,0.75)';
  ctx.textAlign = 'right';
  ctx.fillText(T('わたしのクジラ図鑑', 'My Whale Book'), W - 64, 96);
}

function footer(ctx, url) {
  const { width: W, height: H } = CARD;
  ctx.fillStyle = 'rgba(238,243,247,0.8)';
  ctx.font = `28px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(HASHTAG(), 64, H - 34);
  if (url) {
    ctx.textAlign = 'right';
    ctx.font = `24px ${MONO}`;
    ctx.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W - 64, H - 36, W * 0.55);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 「確認 ○回」のはんこ
function stamp(ctx, x, y, count) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.21);
  ctx.strokeStyle = RED; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = RED; ctx.textAlign = 'center';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(T('確認', 'Seen'), 0, -18);
  ctx.font = `700 46px ${MONO}`;
  ctx.fillText(T(`${count}回`, `×${count}`), 0, 34);
  ctx.restore();
}

// 1頭のカード。entry: 図鑑の1頭、photos: そのクジラの写真(新しい順、data: の文字)、
// portrait: 全身の姿の絵(なければ null)、drawFlukeOn(canvas): 尾びれの裏を描く、features: 特徴の文(いくつか)
export async function whaleCard({ entry, photos = [], portrait = null, drawFlukeOn, features = [], url = '' }) {
  const c = document.createElement('canvas');
  c.width = CARD.width; c.height = CARD.height;
  const ctx = c.getContext('2d');
  background(ctx);
  const [main, ...rest] = await Promise.all(photos.slice(0, 3).map(loadImage));
  const port = await loadImage(portrait);
  // いちばん新しい写真を大きく(なければ全身の姿)
  if (main) polaroid(ctx, main, 540, 470, 860, 484, -1.5);
  else if (port) polaroid(ctx, port, 540, 450, 860, 350, -1.5);
  else {
    // 写真がないときは、尾びれの裏を大きく
    const f = document.createElement('canvas'); f.width = 860; f.height = 240; drawFlukeOn?.(f);
    ctx.fillStyle = '#4f7fa8'; roundRect(ctx, 110, 300, 860, 330, 18); ctx.fill();
    ctx.drawImage(f, 110, 345);
  }
  // 名前と番号
  ctx.textAlign = 'left';
  ctx.fillStyle = DIM;
  ctx.font = `28px ${MONO}`;
  ctx.fillText(`No.${String(entry.id).padStart(2, '0')}  ${T('ザトウクジラ', 'Humpback whale')}`, 110, 800);
  ctx.fillStyle = INK;
  ctx.font = `700 84px ${FONT}`;
  ctx.fillText(entry.displayName, 106, 896, 700);
  stamp(ctx, 880, 850, entry.count);
  // 特徴
  ctx.font = `34px ${FONT}`;
  ctx.fillStyle = INK;
  let y = 970;
  for (const line of wrapLines(ctx, features.join(T('。', '. ')), 860, 2)) { ctx.fillText(line, 110, y); y += 50; }
  // 下: 尾びれの裏と、ほかの写真
  const f = document.createElement('canvas'); f.width = 380; f.height = 106; drawFlukeOn?.(f);
  ctx.fillStyle = '#4f7fa8'; roundRect(ctx, 110, 1080, 400, 130, 14); ctx.fill();
  ctx.drawImage(f, 120, 1092);
  ctx.fillStyle = DIM; ctx.font = `24px ${FONT}`;
  ctx.fillText(T('尾びれの裏', 'Fluke underside'), 112, 1240);
  rest.forEach((img, i) => polaroid(ctx, img, 650 + i * 200, 1150, 170, 120, i ? 4 : -3));
  footer(ctx, url);
  return c;
}

// 図鑑まとめのカード。photos: 写真(新しい順)、names: 写真ごとに写っているクジラの名前、
// entries: 図鑑のクジラ(名前を並べる)、total: 全部の頭数
export async function bookCard({ photos = [], captions = [], entries = [], total = 24, url = '' }) {
  const c = document.createElement('canvas');
  c.width = CARD.width; c.height = CARD.height;
  const ctx = c.getContext('2d');
  background(ctx);
  ctx.fillStyle = INK; ctx.textAlign = 'left';
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(T('クジラ図鑑', 'Whale Book'), 110, 280);
  ctx.font = `700 44px ${MONO}`;
  ctx.fillStyle = RED;
  ctx.textAlign = 'right';
  ctx.fillText(T(`${entries.length} / ${total} 頭`, `${entries.length} / ${total}`), 970, 280);
  // 写真を6枚まで(2列×3段)
  const imgs = await Promise.all(photos.slice(0, 6).map(loadImage));
  const n = imgs.length;
  const cols = 2, w = 330, h = 196, rowH = 252, first = 420;
  imgs.forEach((img, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    polaroid(ctx, img, 325 + col * 430, first + row * rowH, w, h, [-3, 2.5, 1.5, -2, -1.5, 3][i], captions[i]);
  });
  // 写真がないとき・少ないときは、名前をならべる場所を広くする
  const top = n ? first + (Math.ceil(n / cols) - 1) * rowH + h / 2 + 110 : 360;
  ctx.textAlign = 'left';
  ctx.fillStyle = DIM; ctx.font = `28px ${FONT}`;
  ctx.fillText(T('会えたクジラ', 'Whales I have met'), 110, top);
  ctx.fillStyle = INK; ctx.font = `36px ${FONT}`;
  const names = entries.map(e => e.displayName);
  let y = top + 56;
  for (const line of wrapLines(ctx, names.join(T('、', ', ')), 860, Math.max(1, Math.floor((CARD.height - 140 - y) / 52)))) { ctx.fillText(line, 110, y); y += 52; }
  footer(ctx, url);
  return c;
}

// 共有する言葉
export function shareText({ kind, name, count, met, total }) {
  if (kind === 'whale') return T(`わたしのクジラ「${name}」に${count}回会えました ${HASHTAG()}`, `I've met my whale "${name}" ${count} time${count > 1 ? 's' : ''} ${HASHTAG()}`);
  return T(`クジラ図鑑 ${met}/${total}頭 ${HASHTAG()}`, `My Whale Book: ${met}/${total} whales ${HASHTAG()}`);
}

// 画像を共有する。スマホでは共有の画面(X・Instagram などを選べる)を出す。
// 出せないときは 'fallback' を返す(画像を表示して、保存してもらう)
export async function shareCanvas(canvas, { text, url, filename = 'whale-ocean.jpg' }) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) return 'fallback';
  const file = new File([blob], filename, { type: 'image/jpeg' });
  const data = { files: [file], text: url ? `${text} ${url}` : text };
  try {
    if (navigator.canShare?.(data)) { await navigator.share(data); return 'shared'; }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  return 'fallback';
}
