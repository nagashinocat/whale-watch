import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createOcean } from './scene/ocean.js';
import { createWhales } from './scene/whales.js';
import { createEffects } from './scene/effects.js';
import { PATTERNS, resolvePattern } from './logic/patterns.js';
import { spawnPosition } from './logic/spawn.js';
import { createMixer, loadBuffers } from './audio/mixer.js';
import { createMenu } from './ui/menu.js';
import { createScheduler } from './logic/scheduler.js';
import { loadSettings, saveSettings } from './logic/settings.js';
import { hoursFor, blendHours } from './logic/time.js';
import { AUDIO } from './logic/config.js';

// メニューに表示する素材のクレジット(assets/CREDITS.md と合わせる)
const CREDITS = ['クジラの声: NOAA'];

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = params.has('fast');

const settings = loadSettings(safeStorage());
const ocean = createOcean(document.getElementById('sea'));
const scheduler = createScheduler({ now: Date.now(), intervalScale: FAST ? 1 / 30 : 1 });

let mixer = null;
const effects = createEffects(ocean.scene);
ocean.addUpdater(effects.update);
const whalesReady = createWhales(ocean.scene, new GLTFLoader(), {
  effects,
  playSound: (name, opts) => mixer?.playWhale(name, opts),
});
whalesReady.then(w => ocean.addUpdater(w.update));

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}

function save() {
  saveSettings(safeStorage(), settings);
  menu.setValues(settings);
}

let skyHours = null;    // 今の空の時刻
let skyTransition = 0;  // 移り変わりの番号(新しい切り替えが来たら古いものを止める)

// 空を今の設定の時刻に合わせる。smooth なら3秒かけて移り変わる。
function updateTime(smooth = false) {
  const target = hoursFor(settings.time, new Date());
  const id = ++skyTransition;
  if (!smooth || skyHours === null || document.hidden) {
    skyHours = target;
    ocean.setTime(target);
    return;
  }
  const from = skyHours;
  const startAt = performance.now();
  const step = now => {
    if (id !== skyTransition) return;
    const t = Math.min(1, (now - startAt) / AUDIO.fadeMs);
    skyHours = blendHours(from, target, t);
    ocean.setTime(skyHours);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function refreshSummonButton() {
  const busy = scheduler.isSummoning();
  menu.setSummonEnabled(!busy);
  if (!busy) menu.setSummonStatus(null);
}

// 出番係のイベントを、演出と音に渡す。終わったら出番係に知らせる。
async function handleEvent(event) {
  if (event.kind === 'summon') menu.setSummonStatus(null);
  try {
    const whales = await whalesReady;
    const name = resolvePattern(event.pattern, whales.models);
    const { sound, durationMs } = PATTERNS[name];
    if (sound) mixer?.playWhale(sound, { maxMs: durationMs });
    // 画面が隠れて描画が止まっていても、必ず決まった時間で終わらせる
    await Promise.race([
      whales.play(name, spawnPosition(Math.random)),
      new Promise(r => setTimeout(r, durationMs + 1000)),
    ]);
  } finally {
    if (event.kind !== 'debug') scheduler.endEvent(Date.now());
    refreshSummonButton();
  }
}

// 開発用: ?debug=1 で各出方をすぐ出せるボタンを表示する
if (DEBUG) {
  const panel = document.createElement('div');
  panel.className = 'debug';
  for (const name of Object.keys(PATTERNS)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', () => handleEvent({ kind: 'debug', pattern: name }));
    panel.append(b);
  }
  document.body.append(panel);
}

const menu = createMenu(document.getElementById('ui'), {
  async onStart() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    await ctx.resume();
    const buffers = await loadBuffers(ctx);
    if (!buffers[`waves-${settings.camera}`]) menu.showNotice('波の音を読み込めませんでした');
    mixer = createMixer(ctx, buffers);
    mixer.setMode(settings.mode);
    mixer.setVolume(settings.volume);
    mixer.start(settings.camera);
  },
  onMode(mode) {
    settings.mode = mode;
    mixer?.setMode(mode);
    save();
  },
  onCamera(camera) {
    settings.camera = camera;
    ocean.setCamera(camera);
    mixer?.setCamera(camera);
    save();
  },
  onTime(time) {
    settings.time = time;
    updateTime(true);
    save();
  },
  onVolume(volume) {
    settings.volume = volume;
    mixer?.setVolume(volume);
    save();
  },
  onSummon() {
    if (scheduler.summon(Date.now())) {
      menu.setSummonStatus('呼んでいます…');
      menu.setSummonEnabled(false);
    }
  },
  onFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  },
});

menu.setValues(settings);
menu.showCredits(CREDITS);
ocean.setCamera(settings.camera);
updateTime();
ocean.start();

// 出番係は描画と独立して動かす(画面が隠れていても音のクジラは来る)
setInterval(() => {
  const event = scheduler.tick(Date.now());
  if (event) handleEvent(event);
}, 1000);
setInterval(updateTime, 60 * 1000);

// 見えていないときは描画を止めて電池を節約する
document.addEventListener('visibilitychange', () => {
  if (document.hidden) ocean.stop();
  else {
    updateTime();
    ocean.start();
  }
});

export { ocean, scheduler, handleEvent, DEBUG };
