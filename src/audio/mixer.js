import { AUDIO } from '../logic/config.js';
import { AUDIO_DISTANCE, waveTargetGain, whaleTargetGain } from '../logic/gains.js';

export const SOUND_FILES = Object.freeze({
  // 波の音はくり返しても継ぎ目が出ないよう、圧縮しない形式(wav)にしてある
  'waves-cliff': 'assets/audio/waves-cliff.wav',
  'waves-surface': 'assets/audio/waves-surface.wav',
  humpback: 'assets/audio/humpback-song.wav',
  'humpback-call': 'assets/audio/humpback-call.wav',
  sperm: 'assets/audio/sperm-clicks.wav',
  splash: 'assets/audio/splash.wav',
  // 潮吹きの息の音(合成。tools/audio/make_blow.py)
  blow: 'assets/audio/blow.wav',
  // ジャンプの着水の「ドーン」と、飛び出すときの「ザバァ」(合成。tools/audio/make_breach.py)
  breach: 'assets/audio/breach.wav',
  'breach-rise': 'assets/audio/breach-rise.wav',
  // 尾びれ・胸びれで水面をたたく「バシーン」「ベチャン」(合成。tools/audio/make_slap.py)
  'tail-slap': 'assets/audio/tail-slap.wav',
  'pec-slap': 'assets/audio/pec-slap.wav',
  // 泡の網の泡がはじける音(合成。tools/audio/make_bubbles.py)
  bubbles: 'assets/audio/bubbles.wav',
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
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      // もう一度
    }
  }
  return null;
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
export function createMixer(ctx, buffers) {
  let mode = 'normal';
  let volume = 0.5;
  let camera = 'cliff';
  let started = false;

  const waveBus = ctx.createGain();
  waveBus.gain.value = 0;
  waveBus.connect(ctx.destination);

  // クジラの音は必ずコンプレッサー(リミッター)を通す
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -24;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  limiter.connect(ctx.destination);
  const whaleBus = ctx.createGain();
  whaleBus.gain.value = 0;
  whaleBus.connect(limiter);

  const waveGains = {};
  let listenerAt = [0, 0, 0];

  function startWave(name) {
    const buffer = buffers[`waves-${name}`];
    if (!buffer || waveGains[name]) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = name === waveSound(camera) ? 1 : 0;
    src.connect(g).connect(waveBus);
    src.start();
    waveGains[name] = g;
  }
  function startWaves() {
    for (const name of ['cliff', 'surface']) startWave(name);
  }

  // まだ読みこめていなかった鳴き声(読めたら、残りの時間だけ鳴らす)
  const pending = [];

  function applyLevels() {
    rampTo(waveBus.gain, ctx, waveTargetGain(volume), AUDIO.fadeMs);
    rampTo(whaleBus.gain, ctx, whaleTargetGain({ mode, volume }), AUDIO.fadeMs);
  }

  return {
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
    playWhale(name, { gain = 1, maxMs = Infinity, position = null, rate = 1, wait = false } = {}) {
      const buffer = buffers[name];
      if (started && !buffer && wait && Number.isFinite(maxMs)) {
        pending.push({ name, at: ctx.currentTime, opts: { gain, maxMs, position, rate } });
        return;
      }
      if (!started || !buffer) return;
      const now = ctx.currentTime;
      const length = Math.min(buffer.duration / rate, maxMs / 1000);
      // 歌や鳴き声は、急に大きくならないようにゆっくり始める。
      // 水をたたく音・ジャンプの音・潮吹きは、始まりの勢いが大事なので、そのまま鳴らす
      const sudden = SUDDEN_SOUNDS.has(name);
      const fade = Math.min(2, length / 3);
      const fadeIn = sudden ? 0.004 : fade;
      const fadeOut = sudden && length >= buffer.duration / rate - 0.01 ? 0.05 : fade;

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
      node.connect(whaleBus);
      src.start(now);
      src.stop(now + length + 0.05);
    },
  };
}
