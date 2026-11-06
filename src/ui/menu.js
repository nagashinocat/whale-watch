import { MENU_HIDE_MS } from '../logic/config.js';

const CAMERA_LABELS = { sky: '上空', cliff: '崖の上', surface: '水面', near: '間近' };
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
        <button class="full" data-full>全画面</button>
      </div>
      <p class="notice" data-notice hidden></p>
    </div>`;

  const $ = sel => root.querySelector(sel);
  const start = $('[data-start]');
  const menu = $('[data-menu]');
  const summon = $('[data-summon]');
  const status = $('[data-status]');
  const volume = $('[data-volume]');
  const notice = $('[data-notice]');
  let started = false;
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
    showCredits(lines) {
      $('[data-credits]').textContent = lines.join(' / ');
    },
  };
}
