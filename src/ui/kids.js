// 子供用モードの画面: 大きな「クジラをよぶ」ボタンと、写真のボタンと、大人が長押しでもどるボタン。
// ほかのボタン(図鑑・時間・音・カメラの切りかえなど)は、子供用モードのあいだは隠す(index.html の .kids-mode)
import { tr } from '../logic/i18n.js';
import { KIDS } from '../logic/kids.js';
import { icon } from './menu.js';

const T = (ja, en) => tr({ ja, en });

export function createKidsScreen(root, handlers) {
  const el = document.createElement('div');
  el.className = 'kids';
  el.hidden = true;
  el.innerHTML = `
    <div class="kids-top">
      <p class="kids-count" data-kidscount aria-live="polite"></p>
      <button class="kids-exit" data-kidsexit aria-label="${T('ふつうのモードにもどる(長押し)', 'Back to normal mode (press and hold)')}">
        <span class="kids-exit-ring" data-kidsring aria-hidden="true"></span>
        <span class="kids-exit-text">${T('おとなの人: ながおしで もどる', 'Grown-ups: press and hold to exit')}</span>
      </button>
    </div>
    <p class="kids-say" data-kidssay hidden></p>
    <div class="kids-bottom">
      <button class="kids-shutter" data-kidsphoto aria-label="${T('しゃしんを とる', 'Take a photo')}">${icon('camera', 34)}</button>
      <button class="kids-call" data-kidscall>${icon('whale', 40)}<span>${T('クジラを よぶ', 'Call a whale')}</span></button>
    </div>`;
  root.append(el);

  const $ = s => el.querySelector(s);
  const count = $('[data-kidscount]'), say = $('[data-kidssay]'), exit = $('[data-kidsexit]'), ring = $('[data-kidsring]');

  // 子供用モードのあいだは、海をタップしてもパネルを出さない(ボタンの外を押しても何も起きない)
  el.addEventListener('pointerdown', e => e.stopPropagation());

  let lastCall = 0;
  $('[data-kidscall]').addEventListener('click', () => {
    const now = Date.now();
    if (now - lastCall < KIDS.callGapMs) return;
    lastCall = now;
    handlers.onCall?.();
  });
  $('[data-kidsphoto]').addEventListener('click', () => handlers.onPhoto?.());

  // 長押しでもどる。指をはなしたら、やめる
  let hold = null;
  const cancel = () => {
    if (!hold) return;
    clearTimeout(hold);
    hold = null;
    exit.classList.remove('holding');
  };
  exit.addEventListener('pointerdown', e => {
    e.preventDefault();
    cancel();
    exit.classList.add('holding');
    ring.style.animationDuration = `${KIDS.exitHoldMs}ms`;
    hold = setTimeout(() => { hold = null; exit.classList.remove('holding'); handlers.onExit?.(); }, KIDS.exitHoldMs);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) exit.addEventListener(ev, cancel);
  exit.addEventListener('contextmenu', e => e.preventDefault());
  // キーボードでは、Enter を押しつづけてももどれる
  exit.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.repeat) exit.dispatchEvent(new PointerEvent('pointerdown')); });
  exit.addEventListener('keyup', e => { if (e.key === 'Enter') cancel(); });

  let sayTimer = null;
  return {
    el,
    show(on) {
      el.hidden = !on;
      document.body.classList.toggle('kids-mode', on);
      if (!on) cancel();
    },
    // 海にいるクジラの頭数(🐋 を並べる)
    setCount(n) {
      const k = Math.max(0, Math.min(KIDS.maxWhales, n));
      count.textContent = k ? '🐋'.repeat(k) : '';
      count.setAttribute('aria-label', T(`クジラ ${k}頭`, `${k} whale${k === 1 ? '' : 's'}`));
    },
    // 大きなひとこと(「とれたよ!」など)
    say(text, ms = 2500) {
      say.textContent = text;
      say.hidden = false;
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => { say.hidden = true; }, ms);
    },
  };
}
