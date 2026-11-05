import { createOcean } from './scene/ocean.js';
import { createMixer, loadBuffers } from './audio/mixer.js';
import { createMenu } from './ui/menu.js';
import { createScheduler } from './logic/scheduler.js';
import { loadSettings, saveSettings } from './logic/settings.js';

// メニューに表示する素材のクレジット(assets/CREDITS.md と合わせる)
const CREDITS = ['クジラの声: NOAA'];

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = params.has('fast');

const settings = loadSettings(safeStorage());
const ocean = createOcean(document.getElementById('sea'));
const scheduler = createScheduler({ now: Date.now(), intervalScale: FAST ? 1 / 30 : 1 });

let mixer = null;

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

function updateTime() {
  const d = new Date();
  ocean.setTime(d.getHours() + d.getMinutes() / 60);
}

function refreshSummonButton() {
  const busy = scheduler.isSummoning();
  menu.setSummonEnabled(!busy);
  if (!busy) menu.setSummonStatus(null);
}

// 出番係のイベントを、演出と音に渡す。終わったら出番係に知らせる。
async function handleEvent(event) {
  if (event.kind === 'summon') menu.setSummonStatus(null);
  mixer?.playWhale('humpback', { maxMs: 60000 });
  await new Promise(r => setTimeout(r, 60000));
  scheduler.endEvent(Date.now());
  refreshSummonButton();
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
