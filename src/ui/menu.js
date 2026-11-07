import { TIME_PRESETS, INTERVALS, SHUTTER_SPOTS } from '../logic/config.js';
import { TIMER, remainingText, clockText, atClock } from '../logic/timer.js';
import { tr } from '../logic/i18n.js';
import { PICKABLE } from '../logic/plus.js';
import { SLEEP_TIMER } from '../logic/sleepTimer.js';
import { ADS, skipLabel } from '../logic/ads.js';
import { patternLabel } from '../logic/patterns.js';

// 操作パネル(カメラアプリのような形)。
// 上: いまの見え方(カメラ・時間)と、おやすみ・音量・全画面の丸いボタン
// 下: 空の色の帯(時間)、景色の絵(カメラ)、図鑑・シャッター(写真)・呼ぶ
// 画面をタップすると出て、もう一度タップすると消える(勝手には消えない)

const T = (ja, en) => tr({ ja, en });
const CAMERA_LABELS = { cliff: T('崖の上', 'Cliff'), sky: T('上空', 'Sky'), near: T('間近', 'Up close') };
const TIME_LABELS = { auto: T('自動', 'Auto'), morning: T('朝', 'Morning'), day: T('昼', 'Day'), evening: T('夕方', 'Evening'), night: T('夜', 'Night'), golden: T('ゴールデンアワー', 'Golden hour'), blue: T('ブルーアワー', 'Blue hour') };
const TIMER_IDLE = () => T('決めた時間になると、クジラが鳴きながら知らせに来ます', 'When the time comes, a whale swims up calling to let you know.');
// バナー広告の場所(広告が使えるときだけ見える。中身は広告の会社のタグを入れる)
const adSlot = b => `<div class="ad-slot" data-ad="${b.id}" style="--w:${b.width}px;--h:${b.height}px" hidden><span>${T('広告', 'Ad')}</span></div>`;
const SLEEP_IDLE = () => T('波の音をだんだん小さくして、静かに止めます。小さくなりはじめたら、クジラは来ません', 'Fades the waves out slowly, then stops. No whales come once it starts fading.');
const LANG_LABELS = { auto: T('自動', 'Auto'), ja: '日本語', en: 'English' };

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
export const rangeLabel = ({ min, max }) => (min % 60 === 0 && max % 60 === 0
  ? T(`${min / 60}〜${max / 60}時間`, `${min / 60}–${max / 60} h`) : T(`${min}〜${max}分`, `${min}–${max} min`));

// 景色の小さな絵(崖の上・上空・間近)
const SCENES = {
  cliff: '<rect width="100" height="60" fill="#0a4f8a"></rect><rect width="100" height="20" fill="#90b6ef"></rect><path d="M0 60 L0 42 L22 46 L34 60 Z" fill="#3b3a35"></path><path d="M58 36 C 64 33, 72 33, 76 36" stroke="#16181b" stroke-width="3" fill="none" stroke-linecap="round"></path>',
  sky: '<rect width="100" height="60" fill="#0d5a96"></rect><path d="M28 32 C 40 24, 62 24, 72 30 L 80 26 L 78 32 L 82 38 L 72 34 C 60 40, 40 40, 28 32 Z" fill="#16181b"></path><path d="M44 36 L 40 46 M 56 36 L 60 46" stroke="#e6e8ea" stroke-width="3" stroke-linecap="round"></path>',
  near: '<rect width="100" height="60" fill="#90b6ef"></rect><rect y="32" width="100" height="28" fill="#0a4f8a"></rect><path d="M40 32 C 42 16, 52 8, 58 10 C 62 16, 62 26, 60 32 Z" fill="#16181b"></path><path d="M0 48 C 16 40, 30 54, 50 46 C 70 38, 84 54, 100 46 L100 60 L0 60 Z" fill="#1a6aa8"></path>',
};

// 線の絵のアイコン
const ICON = {
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path>',
  panel: '<rect x="4" y="4" width="16" height="16" rx="4"></rect><path d="M8 15h8M8 11h5"></path>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>',
  sound: '<path d="M4 10h4l5-4v12l-5-4H4z"></path><path d="M16 9a4 4 0 0 1 0 6"></path>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"></path>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"></path><path d="M5 17a3 3 0 0 1 3-3h11"></path>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle>',
  whale: '<path d="M3 13c2-4 7-6 12-5l3-2v3c1.5 1 2.5 2 3 3l-3 1c-3 4-10 5-15 0z"></path>',
  sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2"></path>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"></path>',
  dark: '<rect x="6" y="3" width="12" height="18" rx="2.5"></rect><path d="M14.5 9.5a3 3 0 1 1-3-3 2.3 2.3 0 0 0 3 3z"></path>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
  clock: '<circle cx="12" cy="13" r="7.5"></circle><path d="M12 9v4l2.5 2M9.5 3h5"></path>',
};
const icon = (name, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

export function createMenu(root, handlers) {
  root.innerHTML = `
    <div class="landing" data-landing>
      <div class="landing-inner">
        ${adSlot(ADS.banners[0])}
        <header class="landing-hero">
          <img src="assets/icons/icon-192.png" alt="" width="96" height="96">
          <h1>${T('クジラが<span>見</span>てる', 'Whale <span>Watch</span>')}</h1>
          <p class="landing-tag">${T('波の音と、ときどきクジラ。', 'Ocean waves, and now and then, a whale.')}</p>
        </header>
        <button class="landing-start" data-start>${T('さぁ、クジラたちに会いにいこう', 'Let\'s go meet the whales')}</button>
        <small class="start-note">${T('海のむこうから、クジラたちが見守っています', 'From across the sea, the whales are watching over you')}</small>
        <section class="landing-guide" aria-labelledby="landing-guide-title">
          <h2 id="landing-guide-title">${T('かんたんガイド', 'Quick guide')}</h2>
          <ol>
            <li>${icon('panel', 22)}<div><b>${T('海をタップ', 'Tap the sea')}</b><span>${T('操作パネルが出ます。もう一度タップで閉じます', 'to open the control panel. Tap again to close it')}</span></div></li>
            <li>${icon('whale', 22)}<div><b>${T('ときどきクジラが来る', 'Whales drop by')}</b><span>${T('30〜90分に1回くらい。待てないときは「呼ぶ」', 'about every 30–90 minutes. Can\'t wait? Tap “Call”')}</span></div></li>
            <li>${icon('book', 22)}<div><b>${T('写真を撮って図鑑に', 'Snap and collect')}</b><span>${T('尾びれの模様で1頭ずつ見分けて、回遊の旅も追えます', 'Tell whales apart by their flukes and follow their migrations')}</span></div></li>
            <li>${icon('moon', 22)}<div><b>${T('寝かしつけにも', 'For bedtime')}</b><span>${T('おやすみタイマーで、波の音が静かに止まります', 'The sleep timer fades the waves out gently')}</span></div></li>
          </ol>
          <p class="landing-links"><a href="guide.html">${T('くわしい使い方ガイド', 'Full guide')}</a><span aria-hidden="true">・</span><a href="about.html">${T('このアプリについて', 'About this app')}</a></p>
        </section>
        ${adSlot(ADS.banners[1])}
      </div>
    </div>
    <div class="adplayer" data-adplayer hidden role="dialog" aria-label="${T('広告', 'Advertisement')}">
      <span class="ad-badge">${T('広告', 'Ad')}</span>
      <video data-advideo playsinline preload="none"></video>
      <button class="ad-skip" data-adskip disabled></button>
    </div>
    <div class="hud" data-menu hidden>
      <div class="hud-top">
        <span class="pill" data-now></span>
        <div class="hud-round">
          <button class="round" data-full aria-label="${T('全画面', 'Full screen')}">${icon('full', 20)}</button>
          <button class="round" data-timer aria-label="${T('タイマーと、クジラが来る間隔', 'Timer and how often whales come')}" aria-expanded="false">${icon('clock', 21)}</button>
          <button class="round" data-sound aria-label="${T('音量', 'Volume')}" aria-expanded="false">${icon('sound', 20)}</button>
          <button class="round" data-dark aria-label="${T('画面を真っ暗にする(音はそのまま)', 'Turn the screen dark (sound keeps playing)')}">${icon('dark', 21)}</button>
          <button class="round" data-sleep aria-label="${T('おやすみモード', 'Sleep mode')}" aria-pressed="false">${icon('moon', 22)}</button>
        </div>
      </div>
      <div class="timer-pop" data-timerpop hidden>
        <p class="timer-now" data-timernow>${TIMER_IDLE()}</p>
        <div class="timer-chips" role="group" aria-label="${T('何分後', 'In how long')}">
          ${TIMER.presets.map(m => `<button data-after="${m}">${m < 60 ? T(`${m}分後`, `${m} min`) : T(`${m / 60}時間後`, `${m / 60} h`)}</button>`).join('')}
        </div>
        <form class="timer-clock" data-timerclock>
          <label>${T('時刻で', 'At')}<input type="time" data-timertime required></label>
          <button type="submit">${T('この時刻に', 'Set')}</button>
        </form>
        <button class="timer-cancel" data-timercancel hidden>${T('タイマーをやめる', 'Cancel timer')}</button>
        <small>${T('画面をつけたまま、このページを開いておいてください(画面が消えると鳴りません)', 'Keep this page open with the screen on (it can\'t ring once the screen turns off).')}</small>
        <div class="interval" role="group" aria-label="${T('おやすみタイマー', 'Sleep timer')}">
          <p class="interval-title">${icon('moon', 15)}${T('おやすみタイマー', 'Sleep timer')}</p>
          <p class="timer-now" data-sleepnow>${SLEEP_IDLE()}</p>
          <div class="timer-chips">
            ${SLEEP_TIMER.presets.map(m => `<button data-sleepafter="${m}">${m < 60 ? T(`${m}分`, `${m} min`) : m % 60 ? T(`${Math.floor(m / 60)}時間半`, `${m / 60} h`) : T(`${m / 60}時間`, `${m / 60} h`)}</button>`).join('')}
          </div>
          <button class="timer-cancel" data-sleepcancel hidden>${T('おやすみタイマーをやめる', 'Cancel sleep timer')}</button>
        </div>
        <div class="interval" role="group" aria-label="${T('クジラが来る間隔', 'How often whales come')}">
          <p class="interval-title">${T('クジラが来る間隔', 'How often whales come')}</p>
          <div class="interval-chips">
            ${Object.entries(INTERVALS).map(([k, v]) => `<button data-interval="${k}" aria-pressed="false"><b>${tr(v.label)}</b><span>${rangeLabel(v)}</span>${k === 'often' ? `<i class="plus-tag" data-plustag>${T('プラス', 'Plus')}</i>` : ''}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="pick-pop" data-pickpop hidden role="dialog" aria-label="${T('えらんで呼ぶ', 'Choose what to see')}">
        <div class="pick-head">
          <p>${icon('spark', 18)}${T('見たい姿をえらんでね', 'What would you like to see?')}</p>
          <button class="pick-close" data-pickclose aria-label="${T('閉じる', 'Close')}">×</button>
        </div>
        <label class="pick-whale">${T('来てほしいクジラ', 'Which whale')}
          <select data-pickwhale><option value="">${T('おまかせ', 'Any whale')}</option></select>
        </label>
        <div class="pick-grid">
          ${PICKABLE.map(n => `<button data-pick="${n}">${patternLabel(n)}</button>`).join('')}
        </div>
        <small>${T('数秒で来てくれます。来たクジラは図鑑にものります', 'It arrives in a few seconds and is added to your Book.')}</small>
      </div>
      <div class="plus-sheet" data-plussheet hidden role="dialog" aria-labelledby="plus-title">
        <p class="plus-kicker">${icon('spark', 16)}${T('クジラが見てる', 'Whale Watch')}</p>
        <h2 id="plus-title">${T('プラス', 'Plus')}</h2>
        <ul>
          <li><b>${T('えらんで呼ぶ', 'Choose what to see')}</b>${T('大ジャンプ、バブルネット、目が合う…見たい姿を、すぐに呼べます', 'Call up any of 17 behaviors, from full breaches to bubble-nets, right away')}</li>
          <li><b>${T('来てほしいクジラ', 'Pick the whale')}</b>${T('図鑑にのっている、お気に入りの子を呼べます', 'Bring back a favorite whale from your Book')}</li>
          <li><b>${T('よく来る(5〜15分)', 'Often (5–15 min)')}</b>${T('クジラがいちばんたくさん来る間隔', 'The most frequent whale visits')}</li>
        </ul>
        <p class="plus-price" data-plusprice></p>
        <button class="plus-buy" data-plusbuy>${T('プラスにする', 'Get Plus')}</button>
        <button class="plus-later" data-pluslater>${T('あとで', 'Not now')}</button>
      </div>
      <div class="vol-pop" data-volpop hidden>
        <label class="vol-row">${T('音量', 'Volume')}<input type="range" min="0" max="1" step="0.01" data-volume></label>
        <button class="vol-toggle" data-hydro aria-pressed="false">${icon('mic', 18)}<span><b>${T('水中マイク', 'Hydrophone')}</b><small>${T('水の中の音を聞く。遠くの歌が聞こえることも', 'Listen underwater. Distant songs may drift in')}</small></span></button>
        <button class="vol-toggle" data-whisper aria-pressed="true">${icon('moon', 18)}<span><b>${T('親子のささやき', 'Mother–calf whispers')}</b><small>${T('おやすみモードのとき、とても小さく聞こえる', 'Very soft, only in sleep mode')}</small></span></button>
      </div>
      <div class="hud-bottom">
        <p class="sleep-note" data-sleepnote hidden>${icon('moon', 16)}${T('おやすみモード中 ・ クジラの声は鳴らず、波の音だけ', 'Sleep mode · waves only, no whale calls')}</p>
        <div class="sky">
          <div class="sky-labels" aria-hidden="true">
            ${['morning', 'day', 'evening', 'night'].map(k => `<span style="left:${barPosition(TIME_PRESETS[k]) * 100}%">${TIME_LABELS[k]}</span>`).join('')}
          </div>
          <button class="sky-bar" data-skybar aria-label="${T('時間をえらぶ(押した場所に近い時間になります)', 'Choose the time of day')}">
            <span class="sky-sun" data-sun>${icon('sun', 18)}</span>
          </button>
          <div class="chips" role="group" aria-label="${T('時間', 'Time of day')}">
            <button data-time="auto">${T('自動(いまの空)', 'Auto (real sky)')}</button>
            <button data-time="golden">${TIME_LABELS.golden}</button>
            <button data-time="blue">${TIME_LABELS.blue}</button>
          </div>
        </div>
        <div class="cams" role="group" aria-label="${T('見る場所', 'View')}">
          ${Object.entries(CAMERA_LABELS).map(([k, v]) => `
            <button class="cam" data-camera="${k}">
              <svg viewBox="0 0 100 60" aria-hidden="true">${SCENES[k]}</svg>
              <span>${v}</span>
            </button>`).join('')}
        </div>
        <p class="status" data-status hidden></p>
        <div class="actions">
          <button class="act" data-zukan-open>${icon('book', 24)}${T('図鑑', 'Book')}<span class="badge" data-badge>0/24</span></button>
          <button class="shutter" data-photo aria-label="${T('写真を撮る', 'Take a photo')}">${icon('camera', 30)}</button>
          <button class="act act-main" data-summon>${icon('whale', 24)}${T('呼ぶ', 'Call')}</button>
        </div>
        <button class="pick-open" data-pickopen aria-expanded="false">${icon('spark', 18)}${T('えらんで呼ぶ', 'Choose what to see')}<i class="plus-tag" data-plustag>${T('プラス', 'Plus')}</i></button>
        <div class="shutter-spot" role="group" aria-label="${T('パネルを閉じても残る、写真のボタンの場所', 'Where to keep the photo button when the panel is closed')}">
          <span>${icon('camera', 16)}${T('閉じても残るボタン', 'Photo button')}</span>
          ${Object.entries(SHUTTER_SPOTS).map(([k, v]) => `<button data-spot="${k}" aria-pressed="false">${tr(v)}</button>`).join('')}
        </div>
        <p class="notice" data-notice hidden></p>
        <small class="credits" data-credits></small>
        <div class="shutter-spot lang-pick" role="group" aria-label="言語 / Language">
          <span>言語 / Language</span>
          ${Object.entries(LANG_LABELS).map(([k, v]) => `<button data-lang="${k}" aria-pressed="false">${v}</button>`).join('')}
        </div>
        <a class="about-link guide-link" href="guide.html">${T('使い方ガイド', 'How to use')}</a>
        <a class="about-link" href="about.html">${T('このアプリについて(素材・データの扱い)', 'About this app (credits, privacy)')}</a>
      </div>
    </div>
    <button class="float-shutter" data-floatshutter hidden aria-label="${T('写真を撮る', 'Take a photo')}">${icon('camera', 26)}</button>
    <span class="timer-mark" data-timermark hidden>${icon('clock', 16)}<span data-timermarktext></span></span>
    <div class="alarm" data-alarm hidden role="alert">
      <p>${icon('clock', 22)}<span data-alarmtext>${T('時間です', 'Time\'s up')}</span></p>
      <button data-alarmstop>${T('止める', 'Stop')}</button>
    </div>
    <div class="blackout" data-blackout hidden><p>${T('タップでもどります', 'Tap to come back')}</p></div>
    <div class="rest" data-rest hidden>
      <p class="rest-title">${icon('moon', 26)}${T('おやすみなさい', 'Good night')}</p>
      <p>${T('タップすると、また波の音が流れます', 'Tap to bring the waves back')}</p>
    </div>
    <p class="hint" data-hint hidden role="status"></p>
    <button class="update" data-update hidden>${T('新しい版があります。タップで更新', 'A new version is ready. Tap to update')}</button>
    <span class="sleep-mark" data-sleepmark hidden aria-label="${T('おやすみモード中', 'Sleep mode on')}">${icon('moon', 18)}</span>
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
  let current = { mode: 'normal', camera: 'cliff', time: 'auto' };

  if (!document.documentElement.requestFullscreen) $('[data-full]').hidden = true;

  // パネルは勝手には消えない(タップで出したり消したりだけ)。前は数秒で消えていた名残で、呼ぶ場所は残してある
  function scheduleHide() {}

  function showMenu() {
    menu.hidden = false;
    handlers.onMenuShown?.();
    showSleepMark();
    scheduleHide();
  }

  // パネルを閉じているあいだも、おやすみモードなら右上に小さく暗い月を出す(夜でもまぶしくない明るさ)
  function showSleepMark() {
    sleepMark.hidden = !(started && current.mode === 'sleep' && menu.hidden);
    timerMark.hidden = !(started && timerAt != null && menu.hidden);
    // パネルを閉じているあいだだけ出す(開いているときはパネルの中のシャッターを使う)
    // 真っ暗な画面と「おやすみなさい」のときは出さない
    floatShutter.hidden = !(started && menu.hidden && shutterSpot !== 'off' && blackout.hidden && rest.hidden);
    floatShutter.dataset.at = shutterSpot;
    floatShutter.classList.toggle('dim', current.mode === 'sleep');   // おやすみモードでは暗めに
  }

  const landing = $('[data-landing]');
  const adPlayer = $('[data-adplayer]');
  const adVideo = $('[data-advideo]');
  const adSkip = $('[data-adskip]');
  let adOn = false;
  start.addEventListener('click', () => {
    if (started) return;
    started = true;
    landing.hidden = true;
    // 広告動画は、押したこの瞬間に流しはじめる(スマホは、押したときでないと音つきで流せない)
    const ad = handlers.adToPlay?.();
    if (ad) playAd(ad);
    showSleepMark();
    handlers.onStart({ ad: !!ad });
  });
  // 広告動画: 数秒たつとスキップできる。終わったら(見られなかったときも)アプリへ
  function playAd(ad) {
    adOn = true;
    adPlayer.hidden = false;
    adVideo.src = ad.src;
    const t0 = performance.now();
    let timer = null;
    const done = () => {
      if (!adOn) return;
      adOn = false;
      clearInterval(timer);
      adVideo.pause();
      adVideo.removeAttribute('src');
      adVideo.load();
      adPlayer.hidden = true;
      handlers.onAdDone?.();
    };
    const tick = () => {
      const sec = (performance.now() - t0) / 1000;
      const s2 = skipLabel(sec, tr);
      adSkip.textContent = s2.text;
      adSkip.disabled = !s2.ready;
      if (sec > ad.maxSec) done();
    };
    tick();
    timer = setInterval(tick, 250);
    adSkip.onclick = done;
    adVideo.onended = done;
    adVideo.onerror = done;
    adVideo.play().catch(() => {
      // 音つきで流せないときは、音を消して流す。それもだめなら、すぐアプリへ
      adVideo.muted = true;
      adVideo.play().catch(done);
    });
  }

  // 海をタップするとパネルが出て、もう一度タップすると消える
  document.addEventListener('pointerdown', e => {
    if (!started) return;
    // 真っ暗な画面と「おやすみなさい」は、タップ(click)でもどす。ここではパネルを出さない
    if (blackout.contains(e.target) || rest.contains(e.target) || update.contains(e.target) || adOn) return;
    if (!hint.hidden) hideHint();
    // 図鑑や写真を見ているあいだは、パネルを出したり隠したりしない
    if (handlers.isOverlay?.(e.target)) return;
    if (alarm.contains(e.target)) return;
    if (floatShutter.contains(e.target)) return;   // 残したシャッターを押してもパネルは出さない
    if (menu.contains(e.target)) scheduleHide();
    else if (menu.hidden) showMenu();
    else hideMenu();
  });
  function hideMenu() {
    menu.hidden = true;
    volpop.hidden = true; soundBtn.setAttribute('aria-expanded', 'false');
    timerPop.hidden = true; timerBtn.setAttribute('aria-expanded', 'false');
    closePick(); plusSheet.hidden = true;
    showSleepMark();
  }

  // ---- 真っ暗な画面・おやすみなさい・はじめての案内・新しい版 ----
  const blackout = $('[data-blackout]');
  const rest = $('[data-rest]');
  const hint = $('[data-hint]');
  const update = $('[data-update]');
  let hintTimer = null;
  function hideHint() { hint.hidden = true; clearTimeout(hintTimer); }
  $('[data-dark]').addEventListener('click', () => handlers.onDark?.(true));
  blackout.addEventListener('click', () => handlers.onDark?.(false));
  rest.addEventListener('click', () => handlers.onWake?.());
  // おやすみタイマー
  const sleepNow = $('[data-sleepnow]');
  const sleepCancel = $('[data-sleepcancel]');
  let sleepOn = false;
  root.querySelectorAll('[data-sleepafter]').forEach(b => b.addEventListener('click', () => {
    handlers.onSleepTimer?.(Number(b.dataset.sleepafter));
    closeTimerPop();
  }));
  sleepCancel.addEventListener('click', () => { handlers.onSleepCancel?.(); closeTimerPop(); });

  // ---- プラス: えらんで呼ぶ・来てほしいクジラ・よく来る ----
  const pickOpen = $('[data-pickopen]');
  const pickPop = $('[data-pickpop]');
  const pickWhale = $('[data-pickwhale]');
  const plusSheet = $('[data-plussheet]');
  let plus = false;
  const openPlus = () => { closePick(); timerPop.hidden = true; plusSheet.hidden = false; };
  function closePick() { pickPop.hidden = true; pickOpen.setAttribute('aria-expanded', 'false'); }
  pickOpen.addEventListener('click', () => {
    if (!plus) { openPlus(); return; }
    if (!pickPop.hidden) { closePick(); return; }
    // 来てほしいクジラは、図鑑にのっている子だけ(開くたびに作りなおす)
    const keep = pickWhale.value;
    pickWhale.length = 1;
    for (const w of handlers.pickWhales?.() ?? []) pickWhale.append(new Option(w.name, String(w.id)));
    pickWhale.value = [...pickWhale.options].some(o => o.value === keep) ? keep : '';
    volpop.hidden = true; timerPop.hidden = true;
    pickPop.hidden = false;
    pickOpen.setAttribute('aria-expanded', 'true');
  });
  $('[data-pickclose]').addEventListener('click', closePick);
  root.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    if (handlers.onPick?.(b.dataset.pick, pickWhale.value ? Number(pickWhale.value) : null) !== false) closePick();
  }));
  $('[data-plusbuy]').addEventListener('click', () => handlers.onPlusBuy?.());
  $('[data-pluslater]').addEventListener('click', () => { plusSheet.hidden = true; });
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
    if (!plus && b.dataset.interval === 'often') { openPlus(); return; }
    handlers.onInterval?.(b.dataset.interval);
    scheduleHide();
  }));
  $('[data-alarmstop]').addEventListener('click', () => handlers.onAlarmStop?.());
  // パネルを閉じても残るシャッター
  floatShutter.addEventListener('click', () => handlers.onPhoto());
  root.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => handlers.onLang?.(b.dataset.lang)));
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
  const hydroBtn = $('[data-hydro]'), whisperBtn = $('[data-whisper]');
  hydroBtn.addEventListener('click', () => handlers.onHydrophone?.(hydroBtn.getAttribute('aria-pressed') !== 'true'));
  whisperBtn.addEventListener('click', () => handlers.onWhisper?.(whisperBtn.getAttribute('aria-pressed') !== 'true'));
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
    now.textContent = `${CAMERA_LABELS[current.camera] ?? ''}${T(' ・ ', ' · ')}${TIME_LABELS[current.time] ?? ''}`;
    const sleep = current.mode === 'sleep';
    sleepNote.hidden = !sleep;
    sleepBtn.setAttribute('aria-label', sleep ? T('おやすみモード(オン)。押すとクジラの声がもどります', 'Sleep mode on. Tap to bring back whale calls') : T('おやすみモード(オフ)。押すとクジラの声が止まります', 'Sleep mode off. Tap to mute whale calls'));
    showSleepMark();
  }

  return {
    setValues({ mode, camera, volume: v, time, interval = 'normal', shutter = 'center', lang: langChoice = 'auto', whisper = true, hydrophone = false }) {
      current = { mode, camera, time };
      hydroBtn.setAttribute('aria-pressed', String(hydrophone));
      hydroBtn.classList.toggle('on', hydrophone);
      whisperBtn.setAttribute('aria-pressed', String(whisper));
      whisperBtn.classList.toggle('on', whisper);
      root.querySelectorAll('[data-lang]').forEach(b => {
        b.classList.toggle('on', b.dataset.lang === langChoice);
        b.setAttribute('aria-pressed', String(b.dataset.lang === langChoice));
      });
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
      timerBtn.classList.toggle('on', on || sleepOn);
      timerCancel.hidden = !on;
      const left = on ? T(`${clockText(at)}に鳴ります(${remainingText(at - Date.now())})`, `Rings at ${clockText(at)} (${remainingText(at - Date.now())})`) : '';
      timerNow.textContent = on ? left : TIMER_IDLE();
      timerBtn.setAttribute('aria-label', on ? T(`タイマー: ${left}`, `Timer: ${left}`) : T('タイマーと、クジラが来る間隔', 'Timer and how often whales come'));
      $('[data-timermarktext]').textContent = on ? remainingText(at - Date.now()) : '';
      showSleepMark();
    },
    // 「時間です」の知らせ
    showAlarm(text = T('時間です', 'Time\'s up')) {
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
      root.querySelectorAll('[data-pick]').forEach(b => { b.disabled = !enabled; });
    },
    // プラスが使えるか。使えないときは「プラス」の札を出し、押すと案内を出す
    // offered: 売っているか。売っていなくて使えないときは、プラスの項目ごと隠す
    setPlus(unlocked, { price = '', canBuy = true, offered = true } = {}) {
      plus = unlocked;
      const show = unlocked || offered;
      pickOpen.hidden = !show;
      $('[data-interval="often"]').hidden = !show;
      root.querySelectorAll('[data-plustag]').forEach(t => { t.hidden = unlocked; });
      $('[data-plusprice]').textContent = price;
      $('[data-plusprice]').hidden = !price;
      $('[data-plusbuy]').disabled = !canBuy;
      $('[data-plusbuy]').textContent = canBuy ? T('プラスにする', 'Get Plus') : T('準備中です', 'Coming soon');
      if (unlocked) plusSheet.hidden = true;
      else closePick();
    },
    openPlus,
    // おやすみタイマー(text: 「23:40に止まります」など。null でなし)
    setSleepTimer(text) {
      sleepOn = text != null;
      sleepNow.textContent = text ?? SLEEP_IDLE();
      sleepCancel.hidden = !sleepOn;
      timerBtn.classList.toggle('on', sleepOn || timerAt != null);
    },
    // 画面を真っ暗にする(パネルも閉じる)。「タップでもどります」は少しして消える
    setDark(on) {
      if (on) hideMenu();
      blackout.hidden = !on;
      showSleepMark();
      blackout.classList.remove('fade');
      if (on) { void blackout.offsetWidth; blackout.classList.add('fade'); }
    },
    // おやすみタイマーが終わったときの、暗い「おやすみなさい」
    setResting(on) {
      if (on) hideMenu();
      rest.hidden = !on;
      showSleepMark();
    },
    // はじめての案内の吹き出し。at: 'center'(海のまん中) | 'panel'(パネルの上)
    showHint(text, at = 'center', ms = 9000) {
      hint.textContent = text;
      hint.dataset.at = at;
      hint.hidden = false;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(hideHint, ms);
    },
    hideHint,
    // 新しい版があるとき。押すと onTap
    showUpdate(onTap) {
      update.hidden = false;
      update.onclick = () => { update.disabled = true; onTap(); };
    },
    isOpen: () => !menu.hidden,
    // 広告の場所を見せる(広告が使えるとき)
    showAdSlots(on) { root.querySelectorAll('[data-ad]').forEach(s => { s.hidden = !on; }); },
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
