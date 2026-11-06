import { createOcean } from './scene/ocean.js';
import { createWhales } from './scene/whales.js';
import { createEffects } from './scene/effects.js';
import { createFootprints } from './scene/footprints.js';
import { SPOT } from './scene/cameras.js';
import { setEyeLight } from './scene/whaleModel.js';
import { cameraShake } from './logic/behavior.js';
import { PATTERNS, PATTERN_LABELS, resolvePattern, voiceSound } from './logic/patterns.js';
import { spawnPosition } from './logic/spawn.js';
import { createMixer, loadBuffers, camerasWithoutWaves } from './audio/mixer.js';
import { createMenu } from './ui/menu.js';
import { createScheduler } from './logic/scheduler.js';
import { loadSettings, saveSettings } from './logic/settings.js';
import { hoursFor, blendHours } from './logic/time.js';
import { realSky } from './logic/places.js';
import { AUDIO } from './logic/config.js';
import { loadBook, saveBook, nextVisitor, recordSighting, bookEntries, setNickname, displayName, population, FLUKE_ID } from './logic/flukeId.js';
import { traitsText } from './logic/traits.js';
import { sightingMessage, countsForZukan } from './logic/zukan.js';
import { PHOTOS } from './logic/photos.js';
import { createZukan } from './ui/zukan.js';
import { createPhotoStore } from './ui/photoStore.js';
import { portraitOf } from './scene/portrait.js';

// メニューに表示する素材のクレジット(assets/CREDITS.md と合わせる)
const CREDITS = ['波と水しぶきの音: Rmutt, plantmonkey, Fission9 (Freesound / CC0)', 'クジラの声: NOAA Fisheries, NOAA PMEL Acoustics Program (pmel.noaa.gov/acoustics/multimedia.html)'];

const params = new URLSearchParams(location.search);
// 確認用: ?debug=1(&fast=1) か、公開ページではアドレスの最後に #debug(#debug-fast)
// 動作確認用のページでは window.WHALE_DEBUG = true にしてある
const DEBUG = window.WHALE_DEBUG === true || params.has('debug') || location.hash.startsWith('#debug');
const FAST = params.has('fast') || location.hash === '#debug-fast';

const settings = loadSettings(safeStorage());
// クジラ図鑑(尾びれの模様で見分けたクジラの記録)
let book = loadBook(safeStorage());
let forcedVisitor = null;
let countingSightings = true;   // いまの出方を図鑑に数えるか(「呼ぶ」で来たクジラは数えない)
let pendingSightings = [], sightingTimer = null;   // まとめて出すお知らせ   // 動作確認用: 出すクジラの番号
// 撮った写真(この端末のブラウザに保存する)
const photos = createPhotoStore();
const ocean = createOcean(document.getElementById('sea'));
const scheduler = createScheduler({ now: Date.now(), intervalScale: FAST ? 1 / 30 : 1 });

let mixer = null;
const effects = createEffects(ocean.scene);
ocean.addUpdater(effects.update);
// 潜ったクジラの足あと(海面のなめらかな跡)
const footprints = createFootprints();
ocean.addSurfaceDecal(footprints.group);
ocean.addUpdater(footprints.update);
ocean.onPalette(footprints.setPalette);
ocean.onPalette(setEyeLight);
ocean.onPalette(palette => effects.setLight(palette.light));
const whalesReady = createWhales(ocean.scene, {
  effects,
  footprint: (position, yaw) => footprints.add(position, yaw),
  // 近くで大きな水しぶきが上がったら、画面が少し揺れる(power: 水しぶきの強さ 0〜1)
  impact(position, power = 1) {
    const c = ocean.camera.position;
    const d = Math.hypot(position[0] - c.x, position[1] - c.y, position[2] - c.z);
    ocean.shake(cameraShake(d) * power);
  },
  playSound: (name, opts) => mixer?.playWhale(name, opts),
  // この出方に来るクジラ(図鑑にのっているクジラが、ときどきもう一度来る)。taken は同じ出方ですでに来ているクジラ
  visitor(taken = []) {
    // 動作確認のページで「出すクジラ」を選んでいたら、その子を出す
    if (forcedVisitor && !taken.includes(forcedVisitor)) return forcedVisitor;
    let id = nextVisitor(book);
    for (let k = 0; k < 20 && taken.includes(id); k++) id = nextVisitor(book);
    return id;
  },
  // 姿を見せたら(鳴き声だけのときと、「呼ぶ」で来たときは数えない)、図鑑に記録してお知らせする。
  // 群れで何頭も来たときは、少し待ってからお知らせを1つにまとめる
  sighted(w) {
    if (!w.individual || !countingSightings) return;
    const r = recordSighting(book, w.individual.id, Date.now());
    book = r.book;
    saveBook(safeStorage(), book);
    showBook();
    pendingSightings.push({ name: displayName(w.individual.id, book), first: r.first, count: r.count });
    clearTimeout(sightingTimer);
    sightingTimer = setTimeout(() => {
      menu.showToast(sightingMessage(pendingSightings));
      pendingSightings = [];
    }, 1500);
  },
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

// 今の設定の空。「自動」のときは、本物の太陽と月に合わせる
function skyTarget() {
  if (settings.time === 'auto') {
    const real = realSky(new Date());
    return { hours: real.hours, sunAzimuth: real.sunAzimuth, moon: real.moon };
  }
  return { hours: hoursFor(settings.time, new Date()) };
}

// 空を今の設定に合わせる。smooth なら3秒かけて移り変わる。
function updateTime(smooth = false) {
  const target = skyTarget();
  const id = ++skyTransition;
  menu.setSunHours(target.hours);
  if (!smooth || skyHours === null || document.hidden) {
    skyHours = target.hours;
    ocean.setSky(target);
    return;
  }
  const from = skyHours;
  const startAt = performance.now();
  const step = now => {
    if (id !== skyTransition) return;
    const t = Math.min(1, (now - startAt) / AUDIO.fadeMs);
    skyHours = blendHours(from, target.hours, t);
    ocean.setSky({ ...target, hours: skyHours });
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// 音を聞く位置と向きを、カメラに合わせる
function updateListener() {
  if (!mixer) return;
  const c = ocean.camera;
  c.updateMatrixWorld();
  const f = c.getWorldDirection(new c.position.constructor());
  mixer.setListener([c.position.x, c.position.y, c.position.z], [f.x, f.y, f.z]);
}

function refreshSummonButton() {
  const busy = scheduler.isSummoning();
  menu.setSummonEnabled(!busy);
  if (!busy) menu.setSummonStatus(null);
}

// 出番係のイベントを、演出と音に渡す。終わったら出番係に知らせる。
async function handleEvent(event) {
  if (event.kind === 'summon') menu.setSummonStatus(null);
  countingSightings = countsForZukan(event);
  try {
    const whales = await whalesReady;
    // 「目が合う」は間近のカメラのすぐ前で起きるので、崖の上からは見えない(崖の真下になる)。かわりにスパイホップ
    const wanted = event.pattern === 'eyeContact' && settings.camera === 'cliff' ? 'spyhop' : event.pattern;
    const name = resolvePattern(wanted, whales.models);
    const { sound, durationMs } = PATTERNS[name];
    // 鳴き声だけのときは、長い歌と短い一声をまぜて選ぶ
    const voice = name === 'voice' && mixer
      ? voiceSound(Math.random, { humpback: mixer.has('humpback'), 'humpback-call': mixer.has('humpback-call') })
      : sound;
    // 声はクジラの出る場所から聞こえる
    // まだ読みこみ中なら、読めたときに残りの時間だけ鳴らす
    if (voice) mixer?.playWhale(voice, { maxMs: durationMs, position: [...SPOT], wait: true });
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
  const title = document.createElement('p');
  title.className = 'debug-title';
  title.textContent = '動作確認';
  const status = document.createElement('p');
  status.className = 'debug-status';
  status.textContent = 'ボタンを押すと、すぐにクジラが出ます。音も聞くときは、先に画面をタップしてはじめてください';
  panel.append(title);
  let playing = 0;
  for (const name of Object.keys(PATTERNS)) {
    const b = document.createElement('button');
    b.textContent = PATTERN_LABELS[name];
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', async () => {
      playing++;
      status.textContent = `再生中: ${PATTERN_LABELS[name]}(約${Math.round(PATTERNS[name].durationMs / 1000)}秒)`;
      await handleEvent({ kind: 'debug', pattern: name });
      if (--playing === 0) status.textContent = '終わりました。ほかのボタンも試せます';
    });
    panel.append(b);
  }
  // 出すクジラを選ぶ(個性を確かめるため)
  const pick = document.createElement('select');
  pick.setAttribute('aria-label', '出すクジラ');
  pick.append(new Option('出すクジラ: おまかせ', ''));
  for (const ind of population()) {
    const t = traitsText(ind);
    pick.append(new Option(`${ind.name}${t.length ? `(${t[0]})` : ''}`, String(ind.id)));
  }
  pick.addEventListener('pointerdown', e => e.stopPropagation());
  pick.addEventListener('change', () => {
    forcedVisitor = pick.value ? Number(pick.value) : null;
    status.textContent = forcedVisitor ? `つぎに出るおとなのザトウクジラは「${pick.selectedOptions[0].text}」です` : 'クジラはおまかせで出ます';
  });
  panel.append(pick);
  // 図鑑を空にする(はじめて見るときのお知らせを、もう一度ためすため)
  const clear = document.createElement('button');
  clear.textContent = '図鑑を空にする';
  clear.addEventListener('pointerdown', e => e.stopPropagation());
  clear.addEventListener('click', () => {
    book = {};
    saveBook(safeStorage(), book);
    showBook();
    status.textContent = '図鑑を空にしました';
  });
  panel.append(clear, status);
  document.body.append(panel);
}

const menu = createMenu(document.getElementById('ui'), {
  async onStart() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    await ctx.resume();
    // iPhone などでは、電話や通知、ほかのアプリに切りかえたあと、音が止まったままになることがある。
    // 画面をさわったときと、画面にもどってきたときに、音をもう一度動かす
    const wake = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
    document.addEventListener('pointerdown', wake);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    // 音は読めたものから順に使う(大きな波の音を待たずに、鳴き声や水の音を鳴らせる)
    mixer = createMixer(ctx, {});
    mixer.setMode(settings.mode);
    mixer.setVolume(settings.volume);
    mixer.start(settings.camera);
    updateListener();
    const buffers = await loadBuffers(ctx, undefined, (name, buffer) => mixer.addBuffer(name, buffer));
    // 間近は「水面の波の音」、崖の上と上空は「遠い波の音」を使う(カメラの名前そのままのファイルはない)
    const silent = camerasWithoutWaves(buffers);
    if (silent.length === 3) menu.showNotice('波の音を読み込めませんでした');
    else if (silent.length) menu.showNotice('一部のカメラの波の音を読み込めませんでした');
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
    updateListener();
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
      menu.setSummonStatus('呼んでいます…(呼んだクジラは図鑑に数えません)');
      menu.setSummonEnabled(false);
    }
  },
  // 図鑑のクジラに名前を付ける
  onZukan() { zukan.open(); },
  onPhoto() { takePhoto(); },
  isOverlay: target => zukan.contains(target),
  onFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  },
});

menu.setValues(settings);
menu.showCredits(CREDITS);
// 図鑑の中身と、パネルの図鑑のしるし(何頭のっているか)を新しくする
function showBook() {
  const list = bookEntries(book);
  zukan.setEntries(list);
  menu.setZukanCount(list.length, FLUKE_ID.size);
}

// 図鑑(メニューのあとに作る。メニューが画面の部品を作りなおすので)
const nameOf = id => (book[id] ? displayName(id, book) : 'まだ図鑑にいないクジラ');
const zukan = createZukan(document.getElementById('ui'), {
  photos,
  portrait: portraitOf,
  nameOf,
  onRename(id, name) {
    book = setNickname(book, id, name);
    saveBook(safeStorage(), book);
    showBook();
  },
});
showBook();

// 写真を撮る: 画面を写して保存し、写っていたクジラを覚えておく(図鑑のその子のページに集まる)
async function takePhoto() {
  menu.flash();
  try {
    const whales = await whalesReady;
    const ids = whales.visibleIndividuals(ocean.camera);
    const blob = await ocean.snapshot(PHOTOS);
    if (!blob) throw new Error('no image');
    const { saved } = await photos.add({ time: Date.now(), whales: ids, camera: settings.camera, blob });
    const names = ids.map(nameOf);
    menu.showToast(`写真を撮りました${names.length ? `(${names.join('、')}が写っています)` : ''}。図鑑の「写真」で見られます${saved ? '' : '(この端末に保存できないので、ページを閉じると消えます)'}`);
    zukan.refresh();
  } catch {
    menu.showToast('写真を撮れませんでした');
  }
}
ocean.setCamera(settings.camera);
updateTime();
ocean.start();

// 出番係は描画と独立して動かす(画面が隠れていても音のクジラは来る)
setInterval(() => {
  const event = scheduler.tick(Date.now());
  if (event) handleEvent(event);
}, 1000);
// 空はなめらかに変わるよう10秒ごとに合わせる
setInterval(updateTime, 10 * 1000);

// 見えていないときは描画を止めて電池を節約する
document.addEventListener('visibilitychange', () => {
  if (document.hidden) ocean.stop();
  else {
    updateTime();
    ocean.start();
  }
});

export { ocean, scheduler, handleEvent, DEBUG };
