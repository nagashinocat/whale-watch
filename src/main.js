import { createOcean } from './scene/ocean.js';
import { createWhales } from './scene/whales.js';
import { createEffects } from './scene/effects.js';
import { createFootprints } from './scene/footprints.js';
import { SPOT } from './scene/cameras.js';
import { setEyeLight, setWhaleGlow } from './scene/whaleModel.js';
import { cameraShake } from './logic/behavior.js';
import { PATTERNS, PATTERN_LABELS, resolvePattern, voiceSound } from './logic/patterns.js';
import { spawnPosition } from './logic/spawn.js';
import { createMixer, loadBuffers, camerasWithoutWaves } from './audio/mixer.js';
import { rangeLabel, createMenu } from './ui/menu.js';
import { createScheduler } from './logic/scheduler.js';
import { loadSettings, saveSettings } from './logic/settings.js';
import { tr, listJoin } from './logic/i18n.js';
import { hoursFor, blendHours } from './logic/time.js';
import { realSky } from './logic/places.js';
import { AUDIO, INTERVALS } from './logic/config.js';
import { loadBook, saveBook, nextVisitor, recordSighting, recordPhoto, bookEntries, setNickname, displayName, population, bookTotal } from './logic/flukeId.js';
import { traitsText } from './logic/traits.js';
import { sightingMessage, countsForZukan } from './logic/zukan.js';
import { TIMER, timerState, loadTimer, saveTimer, clockText, remainingText } from './logic/timer.js';
import { PHOTOS } from './logic/photos.js';
import { createZukan } from './ui/zukan.js';
import { createPhotoStore } from './ui/photoStore.js';
import { portraitOf } from './scene/portrait.js';
import { PLUS, loadPlus, savePlus, usableInterval, pickableWhales } from './logic/plus.js';
import { patternLabel } from './logic/patterns.js';
import { SLEEP_TIMER, sleepTimerFor, sleepPhase, fadeLevel } from './logic/sleepTimer.js';
import { loadHints, markHint, nextHint, HINT_TEXT } from './logic/hints.js';
import { makeBackup, parseBackup, mergeBooks, newPhotos, backupFileName } from './logic/backup.js';

// メニューに表示する素材のクレジット(assets/CREDITS.md と合わせる)
const CREDITS = [
  tr({ ja: '波と水しぶきの音', en: 'Wave and splash sounds' }) + ': Rmutt, plantmonkey, Fission9 (Freesound / CC0)',
  tr({ ja: 'クジラの声', en: 'Whale sounds' }) + ': NOAA Fisheries, NOAA PMEL Acoustics Program (pmel.noaa.gov/acoustics/multimedia.html)',
];

const params = new URLSearchParams(location.search);
// 確認用: ?debug=1(&fast=1) か、公開ページではアドレスの最後に #debug(#debug-fast)
// 動作確認用のページでは window.WHALE_DEBUG = true にしてある
const DEBUG = window.WHALE_DEBUG === true || params.has('debug') || location.hash.startsWith('#debug');
const FAST = params.has('fast') || location.hash === '#debug-fast';

const settings = loadSettings(safeStorage());
// 有料の「プラス」が使えるか。使えないのに「よく来る」が保存されていたら、「たくさん来る」にする
const plus = loadPlus(safeStorage());
settings.interval = usableInterval(settings.interval, plus.unlocked);
// クジラ図鑑(尾びれの模様で見分けたクジラの記録)
let book = loadBook(safeStorage());
let forcedVisitor = null;
let timerVisitor = null;
let pickedWhale = null, eventWhale = null;   // プラスの「来てほしいクジラ」(呼んだときに決め、来たときに使う)   // タイマーで知らせに来るクジラの番号
let countingSightings = true;   // いまの出方を図鑑に数えるか(「呼ぶ」で来たクジラは数えない)
let pendingSightings = [], sightingTimer = null;   // まとめて出すお知らせ   // 動作確認用: 出すクジラの番号
// 撮った写真(この端末のブラウザに保存する)
const photos = createPhotoStore();
const ocean = createOcean(document.getElementById('sea'));
const scheduler = createScheduler({ now: Date.now(), intervalScale: FAST ? 1 / 30 : 1, frequency: settings.interval });

let mixer = null;
let audioCtx = null;
const effects = createEffects(ocean.scene);
ocean.addUpdater(effects.update);
// 潜ったクジラの足あと(海面のなめらかな跡)
const footprints = createFootprints();
ocean.addSurfaceDecal(footprints.group);
ocean.addUpdater(footprints.update);
ocean.onPalette(footprints.setPalette);
ocean.onPalette(setEyeLight);
ocean.onPalette(palette => effects.setLight(palette.light));
// とくべつな子の模様は、夜だけ光る(太陽が沈んでから、月が見えはじめるころに合わせて明るくなる)
ocean.onPalette((palette, sun) => setWhaleGlow(sun?.moonlight ?? 0));
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
  visitor(taken = [], { solo = false } = {}) {
    // 動作確認のページで「出すクジラ」を選んでいたら、その子を出す
    if (forcedVisitor && !taken.includes(forcedVisitor)) return forcedVisitor;
    // プラスで「来てほしいクジラ」を選んで呼んだときは、その子が来る
    if (eventWhale && !taken.includes(eventWhale)) return eventWhale;
    // タイマーで知らせに来るクジラは、先に決めてある(お知らせに名前を出すため)
    if (timerVisitor && !taken.includes(timerVisitor)) { const id = timerVisitor; timerVisitor = null; return id; }
    let id = nextVisitor(book, Math.random, { solo });
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
  if (event.kind === 'summon' || event.kind === 'pick') menu.setSummonStatus(null);
  if (event.kind === 'pick') { eventWhale = pickedWhale; pickedWhale = null; }
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
    // 動作確認とタイマーは、出番係の順番とは別に出す
    if (event.kind === 'pick') eventWhale = null;
    if (event.kind !== 'debug' && event.kind !== 'timer') scheduler.endEvent(Date.now());
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
  // プラスを使える・使えないを切りかえる(両方の見え方を確かめるため)
  const plusToggle = document.createElement('button');
  const plusText = () => { plusToggle.textContent = plus.unlocked ? 'プラス: 使える(押すと使えない状態へ)' : 'プラス: 使えない(押すと使える状態へ)'; };
  plusText();
  plusToggle.addEventListener('pointerdown', e => e.stopPropagation());
  plusToggle.addEventListener('click', () => { setPlusUnlocked(!plus.unlocked); plusText(); });
  panel.append(clear, plusToggle, status);
  document.body.append(panel);
}

const menu = createMenu(document.getElementById('ui'), {
  async onStart() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    audioCtx = ctx;
    setTimeout(() => showHint(false), 1500);   // はじめての人には「海をタップすると…」
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
    if (silent.length === 3) menu.showNotice(tr({ ja: '波の音を読み込めませんでした', en: 'Could not load the wave sounds' }));
    else if (silent.length) menu.showNotice(tr({ ja: '一部のカメラの波の音を読み込めませんでした', en: 'Could not load the wave sounds for some views' }));
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
  // クジラが来る間隔を選びなおす(次に来るまでの時間も、新しい間隔で決めなおす)
  onInterval(name) {
    if (!INTERVALS[name]) return;
    settings.interval = name;
    scheduler.setFrequency(name, Date.now());
    save();
    const r = INTERVALS[name];
    menu.showToast(tr({ ja: `「${tr(r.label)}」: クジラが帰ってから、${rangeLabel(r)}くらいで次が来ます`, en: `"${tr(r.label)}": the next whale comes about ${rangeLabel(r)} after the last one leaves` }));
  },
  onTimerSet(at) {
    timer = { at };
    saveTimer(safeStorage(), timer);
    updateQuiet();   // タイマーのあいだは、ほかのクジラは自然には出てこない
    menu.setTimer(at);
    refreshScreen();
    menu.showToast(tr({ ja: `${clockText(at)}に、クジラが鳴きながら知らせに来ます`, en: `At ${clockText(at)}, a whale will come calling to let you know` }));
  },
  onTimerCancel() {
    timer = null;
    updateQuiet();
    saveTimer(safeStorage(), null);
    menu.setTimer(null);
    refreshScreen();
  },
  // おやすみタイマー: 決めた時間をかけて、だんだん小さくして止める
  onSleepTimer(minutes) {
    sleepT = sleepTimerFor(minutes, Date.now());
    mixer?.setFade(1, 1000);
    menu.setSleepTimer(sleepText());
    updateQuiet();
    refreshScreen();
    menu.showToast(tr({ ja: `${clockText(sleepT.end)}に、波の音が静かに止まります。画面を真っ暗にするボタンもどうぞ`, en: `The waves will fade out and stop at ${clockText(sleepT.end)}. Try the dark-screen button too.` }));
  },
  onSleepCancel() {
    sleepT = null;
    mixer?.setFade(1, 2000);
    menu.setSleepTimer(null);
    updateQuiet();
    refreshScreen();
  },
  onWake() { wakeFromRest(); },
  // 画面を真っ暗にする(音はそのまま)
  onDark(on) {
    menu.setDark(on);
    ocean.setEco(on || resting);
  },
  onMenuShown() { showHint(true); },
  onAlarmStop() {
    stopAlarm();
  },
  onVolume(volume) {
    settings.volume = volume;
    mixer?.setVolume(volume);
    save();
  },
  // プラス: 見たい姿(と、来てほしいクジラ)をえらんで呼ぶ
  onPick(pattern, whaleId) {
    if (!plus.unlocked) { menu.openPlus(); return false; }
    if (!scheduler.summon(Date.now(), pattern, PLUS.pickDelayMs)) return false;
    pickedWhale = whaleId;
    const who = whaleId ? displayName(whaleId, book) : null;
    menu.setSummonStatus(tr({
      ja: `${who ? `${who}が` : ''}「${patternLabel(pattern)}」をしに来ます…`,
      en: `${who ? `${who} is` : 'A whale is'} coming: ${patternLabel(pattern)}…`,
    }));
    menu.setSummonEnabled(false);
    return true;
  },
  pickWhales: () => pickableWhales(book),
  // 支払いの方法が決まるまでは「準備中」。動作確認のページでは、押すとすぐ使えるようになる
  onPlusBuy() {
    if (!DEBUG) return;
    setPlusUnlocked(true);
    menu.showToast(tr({ ja: 'プラスが使えるようになりました(動作確認)', en: 'Plus unlocked (test)' }));
  },
  onSummon() {
    if (scheduler.summon(Date.now())) {
      menu.setSummonStatus(tr({ ja: '呼んでいます…(呼んだクジラは図鑑に数えません)', en: 'Calling… (whales you call are not counted in your Book)' }));
      menu.setSummonEnabled(false);
    }
  },
  // 図鑑のクジラに名前を付ける
  onZukan() { zukan.open(); },
  onPhoto() { takePhoto(); },
  // パネルを閉じても残る写真のボタンの場所
  // 言語を選びなおしたら、保存してページを読みなおす(画面の文を全部その言語で作りなおすため)
  onLang(choice) {
    if (settings.lang === choice) return;
    settings.lang = choice;
    saveSettings(safeStorage(), settings);
    location.reload();
  },
  onShutterSpot(spot) {
    settings.shutter = spot;
    save();
  },
  isOverlay: target => zukan.contains(target),
  onFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  },
});

menu.setValues(settings);
function setPlusUnlocked(on) {
  plus.unlocked = on;
  // 売り出すまでは保存しない(動作確認で切りかえても、そのページを開いているあいだだけ)
  if (PLUS.offered) savePlus(safeStorage(), plus);
  menu.setPlus(on, { canBuy: DEBUG, offered: PLUS.offered });
  const usable = usableInterval(settings.interval, on);
  if (usable !== settings.interval) { settings.interval = usable; scheduler.setFrequency(usable, Date.now()); save(); }
}
menu.setPlus(plus.unlocked, { canBuy: DEBUG, offered: PLUS.offered });
menu.showCredits(CREDITS);
document.title = tr({ ja: 'クジラが見てる', en: 'Whale Watch' });
// 図鑑の中身と、パネルの図鑑のしるし(何頭のっているか)を新しくする
// これまでに撮った写真に写っているクジラも、全身の姿がのるようにする(この決まりにする前に撮った写真)
photos.list().then(list => {
  const r = recordPhoto(book, list.flatMap(p => p.whales ?? []), Date.now());
  if (r.book === book || Object.keys(r.book).every(k => r.book[k] === book[k])) return;
  book = r.book;
  saveBook(safeStorage(), book);
  showBook();
}).catch(() => {});

function showBook() {
  const list = bookEntries(book);
  zukan.setEntries(list);
  menu.setZukanCount(list.length, bookTotal());
}

// 図鑑(メニューのあとに作る。メニューが画面の部品を作りなおすので)
const nameOf = id => (book[id]?.count > 0 ? displayName(id, book) : tr({ ja: 'まだ図鑑にいないクジラ', en: 'a whale not yet in your Book' }));
const zukan = createZukan(document.getElementById('ui'), {
  photos,
  // 図鑑と写真を1つのファイルに書き出す。共有のシートが使えれば「ファイルに保存」などを選べる
  async onBackup() {
    const data = makeBackup({ book, photos: (await photos.list()).map(p => ({ ...p, src: photos.url(p) })) });
    const name = backupFileName();
    const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return tr({ ja: '書き出しました。新しい端末では「ファイルから読み込む」でもどせます', en: 'Saved. On a new device, use “Load from a file” to restore.' });
      }
    } catch (e) {
      if (e?.name === 'AbortError') return '';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    return tr({ ja: `「${name}」を保存しました。新しい端末では「ファイルから読み込む」でもどせます`, en: `Saved “${name}”. On a new device, use “Load from a file” to restore.` });
  },
  // 書き出したファイルを読み込んで、いまの図鑑と合わせる
  async onRestore(file) {
    let data;
    try { data = parseBackup(await file.text()); } catch (e) {
      return e?.reason === 'notBackup'
        ? tr({ ja: 'このアプリのバックアップのファイルではないようです', en: 'This doesn\'t look like a Whale Watch backup file.' })
        : tr({ ja: 'ファイルを読めませんでした', en: 'Could not read the file.' });
    }
    const before = bookEntries(book).length;
    book = mergeBooks(book, data.book);
    saveBook(safeStorage(), book);
    const fresh = newPhotos(await photos.list(), data.photos).sort((x, y) => x.time - y.time);
    for (const p of fresh) await photos.add(p);
    showBook();
    zukan.refresh();
    const added = bookEntries(book).length - before;
    return tr({ ja: `読み込みました(図鑑に${added}頭ふえて、写真が${fresh.length}枚ふえました)`, en: `Loaded: ${added} more whale${added === 1 ? '' : 's'} and ${fresh.length} more photo${fresh.length === 1 ? '' : 's'}.` });
  },
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
    // 写ったクジラは、図鑑に全身の姿がのる
    const r = recordPhoto(book, ids, Date.now());
    book = r.book;
    saveBook(safeStorage(), book);
    showBook();
    const unlocked = r.newly.map(nameOf);
    menu.showToast(tr({
      ja: `写真を撮りました${names.length ? `(${listJoin(names)}が写っています)` : ''}。${unlocked.length ? `図鑑に${listJoin(unlocked)}の全身の姿がのりました。` : ''}図鑑の「写真」で見られます${saved ? '' : '(この端末に保存できないので、ページを閉じると消えます)'}`,
      en: `Photo taken${names.length ? ` (with ${listJoin(names)})` : ''}. ${unlocked.length ? `Full-body portrait of ${listJoin(unlocked)} added to your Book. ` : ''}See it under Photos in your Book${saved ? '' : ' (this device can\'t save it, so it will be gone when you close the page)'}`,
    }));
    zukan.refresh();
  } catch {
    menu.showToast(tr({ ja: '写真を撮れませんでした', en: 'Could not take the photo' }));
  }
}
ocean.setCamera(settings.camera);
updateTime();
ocean.start();

// 一度開いたら電波がなくても動くように、アプリのファイルを端末にとっておく(sw.js)。
// 動作確認のページと、https でないところでは使わない
if ('serviceWorker' in navigator && !DEBUG && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // 新しい版がとどいたら「タップで更新」を出す。押したら新しい版に切りかえて、読みなおす
  let updating = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => {
      if (!w || !navigator.serviceWorker.controller) return;   // はじめて開いたときは出さない
      menu.showUpdate(() => { updating = true; w.postMessage('skipWaiting'); });
    };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
    });
    // 開きっぱなしでも、ときどき新しい版がないか見る
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => { /* 使えなくても、ふつうに動く */ });
}

// 出番係は描画と独立して動かす(画面が隠れていても音のクジラは来る)
setInterval(() => {
  const event = scheduler.tick(Date.now());
  if (event) handleEvent(event);
}, 1000);
// 空はなめらかに変わるよう10秒ごとに合わせる
setInterval(updateTime, 10 * 1000);

// ---- タイマー ----
// 決めた時間になったら、クジラが鳴きながら来て知らせる(図鑑には数えない)。
// 時刻は端末の時計でくらべるので、画面が止まっていても、もどってきたときにすぐ知らせる
let timer = loadTimer(safeStorage());
let alarmStop = null, alarmTimer = null;
menu.setTimer(timer?.at ?? null);

// ---- おやすみタイマー ----
let sleepT = null;     // { start, end }
let resting = false;   // 止まって「おやすみなさい」を出しているあいだ
// 自然にクジラを出さないとき: タイマーのあいだと、おやすみタイマーで小さくなりはじめてから
function updateQuiet(now = Date.now()) {
  const p = sleepPhase(now, sleepT);
  scheduler.setQuiet(!!timer || resting || p === 'fading' || p === 'done', now);
}
// 画面をつけたままにしてほしいとき(消えると音が止まるので)
const screenWanted = () => !!timer || (!!sleepT && !resting);
const refreshScreen = () => keepScreenOn(screenWanted());
const sleepText = () => (sleepT ? tr({ ja: `${clockText(sleepT.end)}に止まります(${remainingText(sleepT.end - Date.now())})`, en: `Stops at ${clockText(sleepT.end)} (${remainingText(sleepT.end - Date.now())})` }) : null);
function finishSleep() {
  sleepT = null;
  resting = true;
  mixer?.setFade(0, 1500);
  menu.setSleepTimer(null);
  menu.setDark(false);
  menu.setResting(true);
  ocean.setEco(true);
  updateQuiet();
  refreshScreen();   // 画面は消えてもよい
  // 音を止めて、電池を節約する(タイマーの知らせを待っているときは、止めない)
  setTimeout(() => { if (resting && !timer) audioCtx?.suspend().catch(() => {}); }, 2000);
}
function wakeFromRest() {
  if (!resting) return;
  resting = false;
  menu.setResting(false);
  ocean.setEco(false);
  audioCtx?.resume().catch(() => {});
  mixer?.setFade(1, SLEEP_TIMER.wakeFadeMs);
  updateQuiet();
  refreshScreen();
}
setInterval(() => {
  if (!sleepT) return;
  const now = Date.now();
  if (sleepPhase(now, sleepT) === 'done') { finishSleep(); return; }
  mixer?.setFade(fadeLevel(now, sleepT), 1100);
  menu.setSleepTimer(sleepText());
  updateQuiet(now);
}, 1000);
updateQuiet();

// ---- はじめての案内 ----
const hints = loadHints(safeStorage());
function showHint(panelOpen) {
  const step = nextHint(hints, panelOpen);
  // パネルを開いたら、「海をタップすると…」はもう出さない
  if (panelOpen) markHint(safeStorage(), hints, 'tap');
  if (!step || menu.isOpen() !== panelOpen) return;
  menu.showHint(HINT_TEXT[step](), panelOpen ? 'panel' : 'center', panelOpen ? 12000 : 10000);
  if (step === 'panel') markHint(safeStorage(), hints, 'panel');
}

// タイマーのあいだは、画面が消えないようにたのむ(できない端末では何もしない)
let wakeLock = null;
async function keepScreenOn(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && screenWanted()) keepScreenOn(true); });
if (timer) keepScreenOn(true);

function stopAlarm() {
  alarmStop?.();
  alarmStop = null;
  clearTimeout(alarmTimer);
  menu.hideAlarm();
}

function ringTimer(at) {
  timer = null;
  wakeFromRest();   // おやすみタイマーで止まっていても、知らせは鳴らす
  updateQuiet();
  saveTimer(safeStorage(), null);
  menu.setTimer(null);
  refreshScreen();
  stopAlarm();
  // 知らせに来るクジラを先に決めて、その子の名前で知らせる
  timerVisitor = forcedVisitor ?? nextVisitor(book);
  const who = displayName(timerVisitor, book);
  menu.showAlarm(tr({ ja: `${who}が時間を教えてくれたよ(${clockText(at)})`, en: `${who} came to tell you it's time (${clockText(at)})` }));
  // おやすみモードでも鳴らす。止めるボタンを押すか、しばらくすると止まる
  alarmStop = mixer?.playAlarm({ ringMs: TIMER.ringMs, everyMs: TIMER.callEveryMs }) ?? null;
  alarmTimer = setTimeout(stopAlarm, TIMER.ringMs + 1000);
  // クジラが顔を出して知らせに来る(間近のカメラでは、すぐ目の前まで)
  handleEvent({ kind: 'timer', pattern: settings.camera === 'near' ? 'eyeContact' : 'spyhop' });
}

setInterval(() => {
  if (!timer) return;
  const now = Date.now();
  const state = timerState(timer.at, now);
  if (state === 'ring') ringTimer(timer.at);
  else if (state === 'missed') {
    menu.showToast(tr({ ja: `タイマーの時間(${clockText(timer.at)})を過ぎていました`, en: `The timer (${clockText(timer.at)}) went off while the page was asleep` }));
    timer = null;
    updateQuiet(now);
    saveTimer(safeStorage(), null);
    menu.setTimer(null);
    refreshScreen();
  } else menu.setTimer(timer.at);   // 残り時間の表示を新しくする
}, 1000);

// 見えていないときは描画を止めて電池を節約する
document.addEventListener('visibilitychange', () => {
  if (document.hidden) ocean.stop();
  else {
    updateTime();
    ocean.start();
  }
});

export { ocean, scheduler, handleEvent, DEBUG };
