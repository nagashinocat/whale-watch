import { AUDIO } from '../logic/config.js';
import { waveTargetGain, whaleTargetGain } from '../logic/gains.js';

export const SOUND_FILES = Object.freeze({
  'waves-cliff': 'assets/audio/waves-cliff.mp3',
  'waves-boat': 'assets/audio/waves-boat.mp3',
  'waves-beach': 'assets/audio/waves-beach.mp3',
  'waves-surface': 'assets/audio/waves-surface.mp3',
  humpback: 'assets/audio/humpback-song.mp3',
  sperm: 'assets/audio/sperm-clicks.mp3',
  splash: 'assets/audio/splash.mp3',
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
    for (const name of ['cliff', 'boat', 'beach', 'surface']) {
      const buffer = buffers[`waves-${name}`];
      if (!buffer) continue;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = name === camera ? 1 : 0;
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
      if (cam === camera) return;
      if (started) {
        if (waveGains[camera]) rampTo(waveGains[camera].gain, ctx, 0, AUDIO.fadeMs);
        if (waveGains[cam]) rampTo(waveGains[cam].gain, ctx, 1, AUDIO.fadeMs);
      }
      camera = cam;
    },

    // クジラの音を鳴らす。maxMs を超える音は、そこでフェードアウトして止める。
    playWhale(name, { gain = 1, maxMs = Infinity } = {}) {
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
      node.connect(env).connect(whaleBus);
      src.start(now);
      src.stop(now + length + 0.05);
    },
  };
}
