import { MENU_HIDE_MS } from '../logic/config.js';
import { drawFluke } from './flukeCanvas.js';
import { FLUKE_ID } from '../logic/flukeId.js';

// 日付を「11月6日」の形に
const day = ms => { const d = new Date(ms); return `${d.getMonth() + 1}月${d.getDate()}日`; };

const CAMERA_LABELS = { sky: '上空', cliff: '崖の上', near: '間近' };
const TIME_LABELS = { auto: '自動', morning: '朝', day: '昼', evening: '夕方', night: '夜' };
// 特別にきれいな時間
const SPECIAL_LABELS = { golden: 'ゴールデンアワー', blue: 'ブルーアワー' };

// 起動画面とメニュー。
export function createMenu(root, handlers) {
  root.innerHTML = `
    <div class="start" data-start>
      <p>タップしてはじめる</p>
    </div>
    <div class="menu" data-menu hidden>
      <div class="row">
        <div class="seg" role="group" aria-label="モード">
          <button data-mode="sleep">おやすみ</button>
          <button data-mode="normal">ふつう</button>
        </div>
        <button class="summon" data-summon>クジラを呼ぶ</button>
      </div>
      <p class="status" data-status hidden></p>
      <label class="volume">音量<input type="range" min="0" max="1" step="0.01" data-volume></label>
      <div class="seg cams" role="group" aria-label="カメラ">
        ${Object.entries(CAMERA_LABELS).map(([k, v]) => `<button data-camera="${k}">${v}</button>`).join('')}
      </div>
      <div class="seg times" role="group" aria-label="時間">
        ${Object.entries(TIME_LABELS).map(([k, v]) => `<button data-time="${k}">${v}</button>`).join('')}
      </div>
      <div class="special">
        <span class="label">特別な時間</span>
        <div class="seg" role="group" aria-label="特別な時間">
          ${Object.entries(SPECIAL_LABELS).map(([k, v]) => `<button data-time="${k}">${v}</button>`).join('')}
        </div>
      </div>
      <div class="row foot">
        <small class="credits" data-credits></small>
        <button class="full" data-zukan-open>クジラ図鑑</button>
        <button class="full" data-full>全画面</button>
      </div>
      <p class="notice" data-notice hidden></p>
    </div>
    <section class="zukan" data-zukan hidden aria-label="クジラ図鑑">
      <div class="zukan-head">
        <h2>クジラ図鑑</h2>
        <button class="full" data-zukan-close>閉じる</button>
      </div>
      <p class="zukan-note">尾びれの裏の模様は1頭ずつちがいます。尾びれを上げて潜ったクジラが、ここにのります。<span data-zukan-count></span></p>
      <ol class="zukan-list" data-zukan-list></ol>
    </section>
    <p class="toast" data-toast hidden></p>`;

  const $ = sel => root.querySelector(sel);
  const start = $('[data-start]');
  const menu = $('[data-menu]');
  const summon = $('[data-summon]');
  const status = $('[data-status]');
  const volume = $('[data-volume]');
  const notice = $('[data-notice]');
  const zukan = $('[data-zukan]');
  const toast = $('[data-toast]');
  let started = false;
  let toastTimer = null;
  let entries = [];

  function renderZukan() {
    const list = $('[data-zukan-list]');
    list.innerHTML = '';
    $('[data-zukan-count]').textContent = ` いままでに ${entries.length} / ${FLUKE_ID.size} 頭`;
    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'zukan-empty';
      li.textContent = 'まだだれものっていません。クジラが尾びれを上げて潜るのを待ちましょう';
      list.append(li);
      return;
    }
    for (const e of entries) {
      const li = document.createElement('li');
      const c = document.createElement('canvas');
      c.width = 176; c.height = 48;
      c.setAttribute('aria-hidden', 'true');
      drawFluke(c, e);
      const text = document.createElement('div');
      text.innerHTML = `<b></b><span></span>`;
      text.querySelector('b').textContent = e.name;
      text.querySelector('span').textContent = `${e.count}回 ・ さいご ${day(e.last)}`;
      li.append(c, text);
      list.append(li);
    }
  }
  let hideTimer = null;

  const fullscreenSupported = !!document.documentElement.requestFullscreen;
  if (!fullscreenSupported) $('[data-full]').hidden = true;

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { menu.hidden = true; }, MENU_HIDE_MS);
  }

  function showMenu() {
    menu.hidden = false;
    scheduleHide();
  }

  start.addEventListener('click', () => {
    if (started) return;
    started = true;
    start.hidden = true;
    handlers.onStart();
  });

  // 海をタップするとメニューが出る。メニューを触っている間は隠さない。
  document.addEventListener('pointerdown', e => {
    if (!started) return;
    if (zukan.contains(e.target)) return;
    if (menu.contains(e.target)) scheduleHide();
    else if (menu.hidden) showMenu();
    else menu.hidden = true;
  });
  menu.addEventListener('input', scheduleHide);

  root.querySelectorAll('[data-mode]').forEach(b =>
    b.addEventListener('click', () => handlers.onMode(b.dataset.mode)));
  root.querySelectorAll('[data-camera]').forEach(b =>
    b.addEventListener('click', () => handlers.onCamera(b.dataset.camera)));
  root.querySelectorAll('[data-time]').forEach(b =>
    b.addEventListener('click', () => handlers.onTime(b.dataset.time)));
  summon.addEventListener('click', () => handlers.onSummon());
  volume.addEventListener('input', () => handlers.onVolume(Number(volume.value)));
  $('[data-full]').addEventListener('click', () => handlers.onFullscreen());
  $('[data-zukan-open]').addEventListener('click', () => {
    renderZukan();
    zukan.hidden = false;
    menu.hidden = true;
  });
  $('[data-zukan-close]').addEventListener('click', () => { zukan.hidden = true; });

  return {
    setValues({ mode, camera, volume: v, time }) {
      root.querySelectorAll('[data-time]').forEach(b =>
        b.classList.toggle('on', b.dataset.time === time));
      root.querySelectorAll('[data-mode]').forEach(b =>
        b.classList.toggle('on', b.dataset.mode === mode));
      root.querySelectorAll('[data-camera]').forEach(b =>
        b.classList.toggle('on', b.dataset.camera === camera));
      volume.value = String(v);
    },
    setSummonEnabled(enabled) {
      summon.disabled = !enabled;
    },
    setSummonStatus(text) {
      status.hidden = !text;
      status.textContent = text ?? '';
    },
    showNotice(text) {
      notice.hidden = false;
      notice.textContent = text;
    },
    // 図鑑の中身(最後に見た順)
    setZukan(list) {
      entries = list;
      if (!zukan.hidden) renderZukan();
    },
    // 画面の上に、しばらくお知らせを出す
    showToast(text) {
      toast.textContent = text;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 7000);
    },
    showCredits(lines) {
      $('[data-credits]').textContent = lines.join(' / ');
    },
  };
}
