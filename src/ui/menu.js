import { MENU_HIDE_MS, TIME_PRESETS, INTERVALS, SHUTTER_SPOTS } from '../logic/config.js';
import { TIMER, remainingText, clockText, atClock } from '../logic/timer.js';

// 操作パネル(カメラアプリのような形)。
// 上: いまの見え方(カメラ・時間)と、おやすみ・音量・全画面の丸いボタン
// 下: 空の色の帯(時間)、景色の絵(カメラ)、図鑑・シャッター(写真)・呼ぶ
// 画面をタップすると出て、しばらくすると消える(赤ちゃんを寝かせるときにじゃまにならないように)

const CAMERA_LABELS = { cliff: '崖の上', sky: '上空', near: '間近' };
const TIME_LABELS = { auto: '自動', morning: '朝', day: '昼', evening: '夕方', night: '夜', golden: 'ゴールデンアワー', blue: 'ブルーアワー' };

// 空の色の帯の上の位置(朝5時 0% 〜 夜23時 100%)
const HOUR_FROM = 5, HOUR_TO = 23;
export const barPosition = h => Math.min(1, Math.max(0, (h - HOUR_FROM) / (HOUR_TO - HOUR_FROM)));
// 帯を押した場所から、いちばん近い時間(朝・昼・夕方・夜)
export function nearestTime(fraction) {
  const h = HOUR_FROM + fraction * (HOUR_TO - HOUR_FROM);
  let best = 'morning';
  for (const k of ['morning', 'day', 'evening', 'night']) if (Math.abs(TIME_PRESETS[k] - h) < Math.abs(TIME_PRESETS[best] - h)) best = k;
  return best;
}

// 来る間隔のことば(「5〜15分」「1〜3時間」)
export const rangeLabel = ({ min, max }) => (min % 60 === 0 && max % 60 === 0 ? `${min / 60}〜${max / 60}時間` : `${min}〜${max}分`);

// 景色の小さな絵(崖の上・上空・間近)
const SCENES = {
  cliff: '<rect width="100" height="60" fill="#0a4f8a"></rect><rect width="100" height="20" fill="#90b6ef"></rect><path d="M0 60 L0 42 L22 46 L34 60 Z" fill="#3b3a35"></path><path d="M58 36 C 64 33, 72 33, 76 36" stroke="#16181b" stroke-width="3" fill="none" stroke-linecap="round"></path>',
  sky: '<rect width="100" height="60" fill="#0d5a96"></rect><path d="M28 32 C 40 24, 62 24, 72 30 L 80 26 L 78 32 L 82 38 L 72 34 C 60 40, 40 40, 28 32 Z" fill="#16181b"></path><path d="M44 36 L 40 46 M 56 36 L 60 46" stroke="#e6e8ea" stroke-width="3" stroke-linecap="round"></path>',
  near: '<rect width="100" height="60" fill="#90b6ef"></rect><rect y="32" width="100" height="28" fill="#0a4f8a"></rect><path d="M40 32 C 42 16, 52 8, 58 10 C 62 16, 62 26, 60 32 Z" fill="#16181b"></path><path d="M0 48 C 16 40, 30 54, 50 46 C 70 38, 84 54, 100 46 L100 60 L0 60 Z" fill="#1a6aa8"></path>',
};

// 線の絵のアイコン
const ICON = {
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>',
  sound: '<path d="M4 10h4l5-4v12l-5-4H4z"></path><path d="M16 9a4 4 0 0 1 0 6"></path>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"></path>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"></path><path d="M5 17a3 3 0 0 1 3-3h11"></path>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle>',
  whale: '<path d="M3 13c2-4 7-6 12-5l3-2v3c1.5 1 2.5 2 3 3l-3 1c-3 4-10 5-15 0z"></path>',
  sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2"></path>',
  clock: '<circle cx="12" cy="13" r="7.5"></circle><path d="M12 9v4l2.5 2M9.5 3h5"></path>',
};
const icon = (name, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

export function createMenu(root, handlers) {
  root.innerHTML = `
    <div class="start" data-start>
      <p>タップしてはじめる</p>
    </div>
    <div class="hud" data-menu hidden>
      <div class="hud-top">
        <span class="pill" data-now></span>
        <div class="hud-round">
          <button class="round" data-full aria-label="全画面">${icon('full', 20)}</button>
          <button class="round" data-timer aria-label="タイマーと、クジラが来る間隔" aria-expanded="false">${icon('clock', 21)}</button>
          <button class="round" data-sound aria-label="音量" aria-expanded="false">${icon('sound', 20)}</button>
          <button class="round" data-sleep aria-label="おやすみモード" aria-pressed="false">${icon('moon', 22)}</button>
        </div>
      </div>
      <div class="timer-pop" data-timerpop hidden>
        <p class="timer-now" data-timernow>決めた時間になると、クジラが鳴きながら知らせに来ます</p>
        <div class="timer-chips" role="group" aria-label="何分後">
          ${TIMER.presets.map(m => `<button data-after="${m}">${m < 60 ? `${m}分` : `${m / 60}時間`}後</button>`).join('')}
        </div>
        <form class="timer-clock" data-timerclock>
          <label>時刻で<input type="time" data-timertime required></label>
          <button type="submit">この時刻に</button>
        </form>
        <button class="timer-cancel" data-timercancel hidden>タイマーをやめる</button>
        <small>画面をつけたまま、このページを開いておいてください(画面が消えると鳴りません)</small>
        <div class="interval" role="group" aria-label="クジラが来る間隔">
          <p class="interval-title">クジラが来る間隔</p>
          <div class="interval-chips">
            ${Object.entries(INTERVALS).map(([k, v]) => `<button data-interval="${k}" aria-pressed="false"><b>${v.label}</b><span>${rangeLabel(v)}</span></button>`).join('')}
          </div>
        </div>
      </div>
      <label class="vol-pop" data-volpop hidden>音量<input type="range" min="0" max="1" step="0.01" data-volume></label>
      <div class="hud-bottom">
        <p class="sleep-note" data-sleepnote hidden>${icon('moon', 16)}おやすみモード中 ・ クジラの声は鳴らず、波の音だけ</p>
        <div class="sky">
          <div class="sky-labels" aria-hidden="true">
            ${['morning', 'day', 'evening', 'night'].map(k => `<span style="left:${barPosition(TIME_PRESETS[k]) * 100}%">${TIME_LABELS[k]}</span>`).join('')}
          </div>
          <button class="sky-bar" data-skybar aria-label="時間をえらぶ(押した場所に近い時間になります)">
            <span class="sky-sun" data-sun>${icon('sun', 18)}</span>
          </button>
          <div class="chips" role="group" aria-label="時間">
            <button data-time="auto">自動(いまの空)</button>
            <button data-time="golden">ゴールデンアワー</button>
            <button data-time="blue">ブルーアワー</button>
          </div>
        </div>
        <div class="cams" role="group" aria-label="見る場所">
          ${Object.entries(CAMERA_LABELS).map(([k, v]) => `
            <button class="cam" data-camera="${k}">
              <svg viewBox="0 0 100 60" aria-hidden="true">${SCENES[k]}</svg>
              <span>${v}</span>
            </button>`).join('')}
        </div>
        <p class="status" data-status hidden></p>
        <div class="actions">
          <button class="act" data-zukan-open>${icon('book', 24)}図鑑<span class="badge" data-badge>0/24</span></button>
          <button class="shutter" data-photo aria-label="写真を撮る">${icon('camera', 30)}</button>
          <button class="act act-main" data-summon>${icon('whale', 24)}呼ぶ</button>
        </div>
        <div class="shutter-spot" role="group" aria-label="パネルを閉じても残る、写真のボタンの場所">
          <span>${icon('camera', 16)}閉じても残るボタン</span>
          ${Object.entries(SHUTTER_SPOTS).map(([k, v]) => `<button data-spot="${k}" aria-pressed="false">${v}</button>`).join('')}
        </div>
        <p class="notice" data-notice hidden></p>
        <small class="credits" data-credits></small>
      </div>
    </div>
    <button class="float-shutter" data-floatshutter hidden aria-label="写真を撮る">${icon('camera', 26)}</button>
    <span class="timer-mark" data-timermark hidden>${icon('clock', 16)}<span data-timermarktext></span></span>
    <div class="alarm" data-alarm hidden role="alert">
      <p>${icon('clock', 22)}<span data-alarmtext>時間です</span></p>
      <button data-alarmstop>止める</button>
    </div>
    <span class="sleep-mark" data-sleepmark hidden aria-label="おやすみモード中">${icon('moon', 18)}</span>
    <p class="toast" data-toast hidden></p>
    <div class="flash" data-flash hidden></div>`;

  const $ = sel => root.querySelector(sel);
  const start = $('[data-start]');
  const menu = $('[data-menu]');
  const summon = $('[data-summon]');
  const status = $('[data-status]');
  const volume = $('[data-volume]');
  const volpop = $('[data-volpop]');
  const soundBtn = $('[data-sound]');
  const sleepBtn = $('[data-sleep]');
  const notice = $('[data-notice]');
  const toast = $('[data-toast]');
  const flash = $('[data-flash]');
  const sun = $('[data-sun]');
  const now = $('[data-now]');
  const sleepNote = $('[data-sleepnote]');
  const timerBtn = $('[data-timer]');
  const timerPop = $('[data-timerpop]');
  const timerNow = $('[data-timernow]');
  const timerCancel = $('[data-timercancel]');
  const timerMark = $('[data-timermark]');
  const alarm = $('[data-alarm]');
  let timerAt = null;
  const floatShutter = $('[data-floatshutter]');
  let shutterSpot = 'center';
  const sleepMark = $('[data-sleepmark]');
  let started = false;
  let toastTimer = null;
  let hideTimer = null;
  let current = { mode: 'normal', camera: 'cliff', time: 'auto' };

  if (!document.documentElement.requestFullscreen) $('[data-full]').hidden = true;

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      // タイマーを決めているあいだは隠さない
      if (!timerPop.hidden) { scheduleHide(); return; }
      menu.hidden = true; volpop.hidden = true; soundBtn.setAttribute('aria-expanded', 'false'); showSleepMark();
    }, MENU_HIDE_MS);
  }

  function showMenu() {
    menu.hidden = false;
    showSleepMark();
    scheduleHide();
  }

  // パネルを閉じているあいだも、おやすみモードなら右上に小さく暗い月を出す(夜でもまぶしくない明るさ)
  function showSleepMark() {
    sleepMark.hidden = !(started && current.mode === 'sleep' && menu.hidden);
    timerMark.hidden = !(started && timerAt != null && menu.hidden);
    // パネルを閉じているあいだだけ出す(開いているときはパネルの中のシャッターを使う)
    floatShutter.hidden = !(started && menu.hidden && shutterSpot !== 'off');
    floatShutter.dataset.at = shutterSpot;
    floatShutter.classList.toggle('dim', current.mode === 'sleep');   // おやすみモードでは暗めに
  }

  start.addEventListener('click', () => {
    if (started) return;
    started = true;
    start.hidden = true;
    showSleepMark();
    handlers.onStart();
  });

  // 海をタップするとパネルが出る。パネルを触っている間は隠さない。
  document.addEventListener('pointerdown', e => {
    if (!started) return;
    // 図鑑や写真を見ているあいだは、パネルを出したり隠したりしない
    if (handlers.isOverlay?.(e.target)) return;
    if (alarm.contains(e.target)) return;
    if (floatShutter.contains(e.target)) return;   // 残したシャッターを押してもパネルは出さない
    if (menu.contains(e.target)) scheduleHide();
    else if (menu.hidden) showMenu();
    else { menu.hidden = true; showSleepMark(); }
  });
  menu.addEventListener('input', scheduleHide);

  sleepBtn.addEventListener('click', () => handlers.onMode(current.mode === 'sleep' ? 'normal' : 'sleep'));
  soundBtn.addEventListener('click', () => {
    volpop.hidden = !volpop.hidden;
    soundBtn.setAttribute('aria-expanded', String(!volpop.hidden));
    if (!volpop.hidden) { timerPop.hidden = true; timerBtn.setAttribute('aria-expanded', 'false'); }
  });
  // タイマー
  timerBtn.addEventListener('click', () => {
    timerPop.hidden = !timerPop.hidden;
    timerBtn.setAttribute('aria-expanded', String(!timerPop.hidden));
    if (!timerPop.hidden) { volpop.hidden = true; soundBtn.setAttribute('aria-expanded', 'false'); }
    scheduleHide();
  });
  const closeTimerPop = () => { timerPop.hidden = true; timerBtn.setAttribute('aria-expanded', 'false'); scheduleHide(); };
  root.querySelectorAll('[data-after]').forEach(b => b.addEventListener('click', () => {
    handlers.onTimerSet?.(Date.now() + Number(b.dataset.after) * 60000);
    closeTimerPop();
  }));
  $('[data-timerclock]').addEventListener('submit', e => {
    e.preventDefault();
    const at = atClock($('[data-timertime]').value, Date.now());
    if (at == null) return;
    handlers.onTimerSet?.(at);
    closeTimerPop();
  });
  timerCancel.addEventListener('click', () => { handlers.onTimerCancel?.(); closeTimerPop(); });
  root.querySelectorAll('[data-interval]').forEach(b => b.addEventListener('click', () => {
    handlers.onInterval?.(b.dataset.interval);
    scheduleHide();
  }));
  $('[data-alarmstop]').addEventListener('click', () => handlers.onAlarmStop?.());
  // パネルを閉じても残るシャッター
  floatShutter.addEventListener('click', () => handlers.onPhoto());
  root.querySelectorAll('[data-spot]').forEach(b => b.addEventListener('click', () => {
    handlers.onShutterSpot?.(b.dataset.spot);
    scheduleHide();
  }));
  root.querySelectorAll('[data-camera]').forEach(b =>
    b.addEventListener('click', () => handlers.onCamera(b.dataset.camera)));
  root.querySelectorAll('[data-time]').forEach(b =>
    b.addEventListener('click', () => handlers.onTime(b.dataset.time)));
  // 空の色の帯: 押した場所に近い時間
  $('[data-skybar]').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = r.width ? (e.clientX - r.left) / r.width : 0.5;
    handlers.onTime(nearestTime(Math.min(1, Math.max(0, f))));
  });
  summon.addEventListener('click', () => handlers.onSummon());
  volume.addEventListener('input', () => handlers.onVolume(Number(volume.value)));
  $('[data-full]').addEventListener('click', () => handlers.onFullscreen());
  $('[data-zukan-open]').addEventListener('click', () => {
    menu.hidden = true;
    showSleepMark();
    handlers.onZukan();
  });
  // 写真: パネルを閉じて、シャッターを切る
  $('[data-photo]').addEventListener('click', () => {
    menu.hidden = true;
    showSleepMark();
    handlers.onPhoto();
  });

  function showNow() {
    now.textContent = `${CAMERA_LABELS[current.camera] ?? ''} ・ ${TIME_LABELS[current.time] ?? ''}`;
    const sleep = current.mode === 'sleep';
    sleepNote.hidden = !sleep;
    sleepBtn.setAttribute('aria-label', sleep ? 'おやすみモード(オン)。押すとクジラの声がもどります' : 'おやすみモード(オフ)。押すとクジラの声が止まります');
    showSleepMark();
  }

  return {
    setValues({ mode, camera, volume: v, time, interval = 'normal', shutter = 'center' }) {
      current = { mode, camera, time };
      shutterSpot = shutter;
      root.querySelectorAll('[data-spot]').forEach(b => {
        b.classList.toggle('on', b.dataset.spot === shutter);
        b.setAttribute('aria-pressed', String(b.dataset.spot === shutter));
      });
      root.querySelectorAll('[data-interval]').forEach(b => {
        b.classList.toggle('on', b.dataset.interval === interval);
        b.setAttribute('aria-pressed', String(b.dataset.interval === interval));
      });
      root.querySelectorAll('[data-time]').forEach(b => b.classList.toggle('on', b.dataset.time === time));
      root.querySelectorAll('[data-camera]').forEach(b => {
        b.classList.toggle('on', b.dataset.camera === camera);
        b.setAttribute('aria-pressed', String(b.dataset.camera === camera));
      });
      sleepBtn.classList.toggle('on', mode === 'sleep');
      sleepBtn.setAttribute('aria-pressed', String(mode === 'sleep'));
      volume.value = String(v);
      if (TIME_PRESETS[time] != null) this.setSunHours(TIME_PRESETS[time]);
      showNow();
    },
    // 空の色の帯の上の、いまの太陽(夜は月)の位置
    setSunHours(h) {
      sun.style.left = `${barPosition(h) * 100}%`;
      const night = h < 5.5 || h > 19;
      sun.classList.toggle('night', night);
      sun.innerHTML = icon(night ? 'moon' : 'sun', 18);
    },
    // タイマー(at: 鳴る時刻のミリ秒。null でなし)。残り時間の表示も、これで新しくする
    setTimer(at) {
      timerAt = at;
      const on = at != null;
      timerBtn.classList.toggle('on', on);
      timerCancel.hidden = !on;
      const left = on ? `${clockText(at)}に鳴ります(${remainingText(at - Date.now())})` : '';
      timerNow.textContent = on ? left : '決めた時間になると、クジラが鳴きながら知らせに来ます';
      timerBtn.setAttribute('aria-label', on ? `タイマー: ${left}` : 'タイマーと、クジラが来る間隔');
      $('[data-timermarktext]').textContent = on ? remainingText(at - Date.now()) : '';
      showSleepMark();
    },
    // 「時間です」の知らせ
    showAlarm(text = '時間です') {
      $('[data-alarmtext]').textContent = text;
      alarm.hidden = false;
    },
    hideAlarm() {
      alarm.hidden = true;
    },
    // 図鑑にのっている数
    setZukanCount(n, total) {
      $('[data-badge]').textContent = `${n}/${total}`;
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
    // シャッターを切ったときの、画面の白い光
    flash() {
      flash.hidden = false;
      flash.classList.remove('go');
      void flash.offsetWidth;
      flash.classList.add('go');
      setTimeout(() => { flash.hidden = true; }, 450);
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
