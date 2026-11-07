import { AUDIO } from '../logic/config.js';
import { AUDIO_DISTANCE, waveTargetGain, whaleTargetGain } from '../logic/gains.js';
import { WHISPER, HYDROPHONE } from '../logic/whisper.js';
import { songPlan } from '../logic/songs.js';

export const SOUND_FILES = Object.freeze({
  // 公開用に軽くした形(m4a)。読めないブラウザでは、同じ名前の wav を読む(tools/audio/compress.sh)。
  // 波の音のくり返しの継ぎ目は、重ねてなめらかにつなぐので、圧縮しても出ない
  'waves-cliff': 'assets/audio/waves-cliff.m4a',
  'waves-surface': 'assets/audio/waves-surface.m4a',
  humpback: 'assets/audio/humpback-song.m4a',
  'humpback-call': 'assets/audio/humpback-call.m4a',
  sperm: 'assets/audio/sperm-clicks.m4a',
  splash: 'assets/audio/splash.m4a',
  // 潮吹きの息の音(合成。tools/audio/make_blow.py)
  blow: 'assets/audio/blow.m4a',
  // ジャンプの着水の「ドーン」と、飛び出すときの「ザバァ」(合成。tools/audio/make_breach.py)
  breach: 'assets/audio/breach.m4a',
  'breach-rise': 'assets/audio/breach-rise.m4a',
  // 尾びれ・胸びれで水面をたたく「バシーン」「ベチャン」(合成。tools/audio/make_slap.py)
  'tail-slap': 'assets/audio/tail-slap.m4a',
  'pec-slap': 'assets/audio/pec-slap.m4a',
  // 泡の網の泡がはじける音(合成。tools/audio/make_bubbles.py)
  bubbles: 'assets/audio/bubbles.m4a',
});

// 音ファイルをまとめて読む。読めなかったものは null。
// onLoaded(name, buffer): 1つ読めるたびに呼ぶ(小さい鳴き声のファイルは、大きな波の音を待たずに使える)
export async function loadBuffers(ctx, files = SOUND_FILES, onLoaded = null) {
  const entries = await Promise.all(Object.entries(files).map(async ([name, url]) => {
    const buffer = await loadOne(ctx, url);
    if (buffer) onLoaded?.(name, buffer);
    return [name, buffer];
  }));
  return Object.fromEntries(entries);
}

// 1つ読む。大きなファイル(波の音)は、電波が弱いと途中で失敗することがあるので、もう一度だけ読みなおす
async function loadOne(ctx, url) {
  // 軽い m4a を2回ためして、だめなら予備の wav
  const tries = url.endsWith('.m4a') ? [url, url, url.replace(/\.m4a$/, '.wav')] : [url, url];
  for (const u of tries) {
    try {
      const res = await fetch(u);
      if (!res.ok) continue;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      // つぎをためす
    }
  }
  return null;
}

// 波の音のくり返し: 同じ音を、終わりの OVERLAP 秒と次のはじめを重ねて、つぎつぎに鳴らす(継ぎ目が聞こえない)。
// 重ねるところは、音の大きさが変わらないように、片方を sin、もう片方を cos の形で入れかえる
export const WAVE_LOOP = Object.freeze({ overlap: 3, ahead: 40 });
export function crossfadeCurve(n = 64, rising = true) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1); c[i] = rising ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2); }
  return c;
}

// カメラごとの波の音。上空は崖の上と同じ遠い波の音を使う
export const waveSound = camera => (camera === 'near' ? 'surface' : 'cliff');   // 間近は水面の近くの波の音

// 読めなかった波の音のカメラ(どのカメラでも、使う波の音が読めていれば空)
export function camerasWithoutWaves(buffers, cameras = ['cliff', 'sky', 'near']) {
  return cameras.filter(c => !buffers[`waves-${waveSound(c)}`]);
}

// 水しぶきやジャンプの音。距離に合わせてくぐもらせる
const WATER_SOUNDS = new Set(['splash', 'breach', 'breach-rise', 'tail-slap', 'pec-slap']);
// 始まりの勢いが大事な音(ゆっくり始めない)
export const SUDDEN_SOUNDS = new Set([...WATER_SOUNDS, 'blow']);
// 距離 d(m)のときの、くぐもらせる高さ(Hz)。30mで約1万6千、100mで約5千、いちばん低くても900
export const muffleFrequency = d => Math.min(16000, Math.max(900, (16000 * 30) / Math.max(30, d)));

// 今の値から目標値まで、重ならないようにフェードする。
function rampTo(param, ctx, target, ms) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(target, now + ms / 1000);
}

// 波とクジラの音の経路。
// options.waveAhead: 波の音を何秒先まで予約しておくか(ためすときに長くする)
export function createMixer(ctx, buffers, { waveAhead = WAVE_LOOP.ahead } = {}) {
  let mode = 'normal';
  let volume = 0.5;
  let camera = 'cliff';
  let started = false;

  // おやすみタイマーで全体をだんだん小さくするための出口(タイマーの知らせの音は通さない)
  // いちばん最後の出口(スマホでアプリを切りかえたときに、ここで音をすばやく小さくする。src/logic/away.js)
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(master);
  const waveBus = ctx.createGain();
  waveBus.gain.value = 0;
  // 水中マイクのとき、波の音の高い音を弱める(ふだんはそのまま通す)
  const waveFilter = ctx.createBiquadFilter();
  waveFilter.type = 'lowpass';
  waveFilter.frequency.value = 20000;
  waveBus.connect(waveFilter).connect(out);
  let underwater = false;

  // クジラの音は必ずコンプレッサー(リミッター)を通す
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -24;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  limiter.connect(out);
  const whaleBus = ctx.createGain();
  whaleBus.gain.value = 0;
  whaleBus.connect(limiter);
  // 親子のささやき(おやすみモードでも鳴る、とても小さな声)。高い音を弱めて、やわらかく
  const whisperBus = ctx.createGain();
  whisperBus.gain.value = 0;
  const whisperSoft = ctx.createBiquadFilter();
  whisperSoft.type = 'lowpass';
  whisperSoft.frequency.value = WHISPER.lowpassHz;
  whisperBus.connect(whisperSoft).connect(out);
  // タイマーの知らせは、おやすみタイマーで小さくした出口を通さない(別のリミッターから直接鳴らす)
  const alarmLimiter = ctx.createDynamicsCompressor();
  alarmLimiter.threshold.value = -24;
  alarmLimiter.ratio.value = 12;
  alarmLimiter.connect(master);

  const waveGains = {};
  let listenerAt = [0, 0, 0];

  // 波の音を、重ねながらつぎつぎに鳴らす(WAVE_LOOP)。先の ahead 秒ぶんまで予約しておき、ときどき足す
  const waveNext = {};
  function scheduleWave(name) {
    const buffer = buffers[`waves-${name}`];
    const g = waveGains[name];
    if (!buffer || !g) return;
    const X = Math.min(WAVE_LOOP.overlap, buffer.duration / 4);
    const step = buffer.duration - X;
    // 画面が止まっていて予約が切れていたら、いまから(ふわっと)はじめなおす
    if (waveNext[name] < ctx.currentTime) waveNext[name] = ctx.currentTime + 0.05;
    while (waveNext[name] < ctx.currentTime + waveAhead) {
      const at = waveNext[name];
      const first = at <= ctx.currentTime + 0.2 && !waveNext[`${name}:started`];
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const env = ctx.createGain();
      if (first) env.gain.setValueAtTime(1, at);
      else { env.gain.setValueAtTime(0, at); env.gain.setValueCurveAtTime(crossfadeCurve(64, true), at, X); }
      env.gain.setValueCurveAtTime(crossfadeCurve(64, false), at + step, X);
      src.connect(env).connect(g);
      src.start(at);
      src.stop(at + buffer.duration + 0.05);
      waveNext[`${name}:started`] = true;
      waveNext[name] = at + step;
    }
  }
  function startWave(name) {
    const buffer = buffers[`waves-${name}`];
    if (!buffer || waveGains[name]) return;
    const g = ctx.createGain();
    g.gain.value = name === waveSound(camera) ? 1 : 0;
    g.connect(waveBus);
    waveGains[name] = g;
    waveNext[name] = ctx.currentTime + 0.05;
    scheduleWave(name);
  }
  // 先の予約をときどき足す(画面が止まっているあいだも、予約したぶんは鳴りつづける)
  const waveTimer = typeof setInterval === 'function' ? setInterval(() => { for (const n of ['cliff', 'surface']) scheduleWave(n); }, 5000) : null;
  void waveTimer;
  function startWaves() {
    for (const name of ['cliff', 'surface']) startWave(name);
  }

  // まだ読みこめていなかった鳴き声(読めたら、残りの時間だけ鳴らす)
  const pending = [];

  function applyLevels() {
    rampTo(waveBus.gain, ctx, waveTargetGain(volume) * (underwater ? HYDROPHONE.waveLevel : 1), AUDIO.fadeMs);
    rampTo(whaleBus.gain, ctx, whaleTargetGain({ mode, volume }) * (underwater ? HYDROPHONE.whaleBoost : 1), AUDIO.fadeMs);
    rampTo(whisperBus.gain, ctx, waveTargetGain(volume) * WHISPER.level, AUDIO.fadeMs);
  }

  // タイマーの知らせ。おやすみモードでも鳴らす(自分で決めた時間なので)。
  // 音量が小さくても聞こえるよう、いちばん小さくても 0.3 にする。距離で小さくしない
  function playAlarm({ ringMs = 60000, everyMs = 11000, name = 'humpback-call' } = {}) {
    const buffer = buffers[name] ?? buffers.humpback;
    if (!buffer) return () => {};
    const bus = ctx.createGain();
    bus.gain.value = Math.max(0.3, waveTargetGain(volume)) * 0.9;
    bus.connect(alarmLimiter);
    const now = ctx.currentTime + 0.05;
    const sources = [];
    for (let t = 0; t < ringMs / 1000; t += everyMs / 1000) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      // 毎回少しだけ高さを変えて、同じ声のくり返しに聞こえないようにする
      src.playbackRate.value = 0.94 + 0.12 * ((sources.length * 0.618) % 1);
      const env = ctx.createGain();
      const len = Math.min(buffer.duration / src.playbackRate.value, ringMs / 1000 - t);
      env.gain.setValueAtTime(0, now + t);
      env.gain.linearRampToValueAtTime(1, now + t + 0.6);
      env.gain.setValueAtTime(1, now + t + Math.max(0.7, len - 1));
      env.gain.linearRampToValueAtTime(0, now + t + len);
      src.connect(env).connect(bus);
      src.start(now + t);
      src.stop(now + t + len + 0.05);
      sources.push(src);
    }
    let stopped = false;
    return function stop() {
      if (stopped) return;
      stopped = true;
      rampTo(bus.gain, ctx, 0, 800);
      setTimeout(() => { for (const s of sources) { try { s.stop(); } catch { /* もう止まっている */ } } bus.disconnect(); }, 900);
    };
  }

  return {
    playAlarm,
    start(cam) {
      if (started) return;
      started = true;
      camera = cam ?? camera;
      startWaves();
      applyLevels();
    },

    setMode(m) {
      mode = m;
      if (started) applyLevels();
    },

    // 水中マイク: 波の音がこもり、クジラの声が近くなる
    setUnderwater(on) {
      underwater = on;
      rampTo(waveFilter.frequency, ctx, on ? HYDROPHONE.waveLowpassHz : 20000, AUDIO.fadeMs);
      if (started) applyLevels();
    },

    // 歌を、その月の歌のならべ方と高さで鳴らす(テーマごとに、録音の決まった場所をつないでいく)
    // 録音がまだ読めていなければ、読めたときに、ふつうの歌として鳴らす
    playSong(version, { maxMs = 60000, position = null, gain = 1, bus = 'whale' } = {}) {
      if (!buffers.humpback) { this.playWhale('humpback', { maxMs, position, gain, wait: true }); return; }
      for (const seg of songPlan(version, maxMs / 1000)) {
        this.playWhale('humpback', { offset: seg.offset, duration: seg.duration, delay: seg.at, rate: version.rate, position, gain, bus, fadeSec: 0.6 });
      }
    },

    // 親子のささやき: 一声の録音の短いところを、小さく、低く、やわらかく
    playWhisper(calls) {
      for (const c of calls) this.playWhale('humpback-call', { offset: c.offset, duration: c.duration, delay: c.at, rate: c.rate, gain: c.gain, bus: 'whisper', fadeSec: 0.08 });
    },

    // 全体の大きさの倍率(0〜1)。ms かけて変える
    // アプリが見えなくなる・もどってくるときの、全体の大きさ(away: true で小さく)
    setAway(away, ms) {
      rampTo(master.gain, ctx, away ? 0 : 1, ms);
    },

    setFade(level, ms = 1000) {
      rampTo(out.gain, ctx, Math.max(0, Math.min(1, level)), ms);
    },

    setVolume(v) {
      volume = v;
      if (started) applyLevels();
    },

    setCamera(cam) {
      const from = waveSound(camera), to = waveSound(cam);
      if (started && from !== to) {
        if (waveGains[from]) rampTo(waveGains[from].gain, ctx, 0, AUDIO.fadeMs);
        if (waveGains[to]) rampTo(waveGains[to].gain, ctx, 1, AUDIO.fadeMs);
      }
      camera = cam;
    },

    // あとから読めた音を足す。波の音ならすぐ流しはじめ、待っていた鳴き声があれば鳴らす
    addBuffer(name, buffer) {
      buffers[name] = buffer;
      if (!started) return;
      if (name.startsWith('waves-')) startWave(name.slice(6));
      for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i];
        if (p.name !== name) continue;
        pending.splice(i, 1);
        const left = p.opts.maxMs - (ctx.currentTime - p.at) * 1000;
        if (left > 3000) this.playWhale(name, { ...p.opts, maxMs: left });
      }
    },

    // クジラの音を鳴らす。maxMs を超える音は、そこでフェードアウトして止める。
    // その音が読み込めているか
    has(name) {
      return !!buffers[name];
    },

    // 聞いている位置と向き(カメラ)。position は [x, y, z]、forward は前の向き
    setListener(position, forward) {
      listenerAt = position;
      const l = ctx.listener;
      if (l.positionX) {
        l.positionX.value = position[0]; l.positionY.value = position[1]; l.positionZ.value = position[2];
        l.forwardX.value = forward[0]; l.forwardY.value = forward[1]; l.forwardZ.value = forward[2];
        l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
      } else {
        l.setPosition?.(...position);
        l.setOrientation?.(...forward, 0, 1, 0);
      }
    },

    // position を渡すと、その場所から聞こえる(遠いほど小さく、左右の向きもわかる)
    // rate: 再生の速さ(1 より大きいと少し高い音)。くり返す音を、毎回少しずつちがう音にする
    // wait: まだ読みこめていなければ、読めたときに残りの時間だけ鳴らす(長い歌や鳴き声)
    // offset・duration: 録音の何秒目から何秒ぶんか / delay: 何秒後に鳴らすか / fadeSec: 出だしと終わりのフェード
    // bus: whale(ふつう)・preview(図鑑の試し聞き。おやすみモードでも鳴る)・whisper(ささやき)
    playWhale(name, { gain = 1, maxMs = Infinity, position = null, rate = 1, wait = false, offset = 0, duration = null, delay = 0, fadeSec = null, bus = 'whale' } = {}) {
      const buffer = buffers[name];
      if (started && !buffer && wait && Number.isFinite(maxMs)) {
        pending.push({ name, at: ctx.currentTime, opts: { gain, maxMs, position, rate } });
        return;
      }
      if (!started || !buffer) return;
      const now = ctx.currentTime + Math.max(0, delay);
      const part = Math.max(0.05, Math.min(duration ?? buffer.duration, buffer.duration - offset));
      const length = Math.min(part / rate, maxMs / 1000);
      // 歌や鳴き声は、急に大きくならないようにゆっくり始める。
      // 水をたたく音・ジャンプの音・潮吹きは、始まりの勢いが大事なので、そのまま鳴らす
      const sudden = SUDDEN_SOUNDS.has(name);
      const fade = fadeSec ?? Math.min(2, length / 3);
      const fadeIn = sudden ? 0.004 : fade;
      const fadeOut = sudden && length >= part / rate - 0.01 ? 0.05 : fade;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const env = ctx.createGain();
      const level = (name === 'splash' ? 0.6 : 1) * Math.min(1, Math.max(0, gain));
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(level, now + fadeIn);
      env.gain.setValueAtTime(level, now + length - fadeOut);
      env.gain.linearRampToValueAtTime(0, now + length);

      let node = src;
      if (WATER_SOUNDS.has(name)) {
        // 水の音は、遠いほど高い音が弱まってくぐもる(低い「ドーン」は遠くまで届く)
        const muffle = ctx.createBiquadFilter();
        muffle.type = 'lowpass';
        muffle.frequency.value = position ? muffleFrequency(Math.hypot(...position.map((v, i) => v - listenerAt[i]))) : 2000;
        node = node.connect(muffle);
      }
      node = node.connect(env);
      if (position) {
        // 遠いほど小さく。近くても、いまの音量の上限より大きくはしない(refDistance より近いと小さくしないだけ)
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = AUDIO_DISTANCE.refDistance;
        panner.rolloffFactor = AUDIO_DISTANCE.rolloffFactor;
        panner.maxDistance = 10000;
        if (panner.positionX) {
          panner.positionX.value = position[0]; panner.positionY.value = position[1]; panner.positionZ.value = position[2];
        } else {
          panner.setPosition?.(...position);
        }
        node = node.connect(panner);
      }
      node.connect(bus === 'preview' ? limiter : bus === 'whisper' ? whisperBus : whaleBus);
      src.start(now, offset);
      src.stop(now + length + 0.05);
    },
  };
}
