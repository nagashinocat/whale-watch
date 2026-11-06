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
  // 泡の網の泡がはじける音(合成。tools/audio/make_bubbles.py)
  bubbles: 'assets/audio/bubbles.wav',
});

// 音ファイルをまとめて読む。読めなかったものは null。
export async function loadBuffers(ctx, files = SOUND_FILES) {
  const entries = await Promise.all(Object.entries(files).map(async ([name, url]) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return [name, null];
      return [name, await ctx.decodeAudioData(await res.arrayBuffer())];
    } catch {
      return [name, null];
    }
  }));
  return Object.fromEntries(entries);
}

// カメラごとの波の音。上空は崖の上と同じ遠い波の音を使う
const waveSound = camera => (camera === 'near' ? 'surface' : 'cliff');   // 間近は水面の近くの波の音

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

  function startWaves() {
    for (const name of ['cliff', 'surface']) {
      const buffer = buffers[`waves-${name}`];
      if (!buffer) continue;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = name === waveSound(camera) ? 1 : 0;
      src.connect(g).connect(waveBus);
      src.start();
      waveGains[name] = g;
    }
  }

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

    // クジラの音を鳴らす。maxMs を超える音は、そこでフェードアウトして止める。
    // その音が読み込めているか
    has(name) {
      return !!buffers[name];
    },

    // 聞いている位置と向き(カメラ)。position は [x, y, z]、forward は前の向き
    setListener(position, forward) {
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
    playWhale(name, { gain = 1, maxMs = Infinity, position = null } = {}) {
      const buffer = buffers[name];
      if (!started || !buffer) return;
      const now = ctx.currentTime;
      const length = Math.min(buffer.duration, maxMs / 1000);
      const fade = Math.min(2, length / 3);

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const env = ctx.createGain();
      const level = (name === 'splash' ? 0.5 : 1) * Math.min(1, Math.max(0, gain));
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(level, now + fade);
      env.gain.setValueAtTime(level, now + length - fade);
      env.gain.linearRampToValueAtTime(0, now + length);

      let node = src;
      if (name === 'splash') {
        // 遠くでくぐもって聞こえるようにする
        const muffle = ctx.createBiquadFilter();
        muffle.type = 'lowpass';
        muffle.frequency.value = 800;
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
