import * as THREE from 'three';
import { PATTERNS } from '../logic/patterns.js';
import { createWhaleMesh, prepareWhaleGeometry } from './whaleModel.js';
import { WHALE_SPECS, surfacedCenterY } from '../logic/whaleShape.js';
import { divingYaw } from '../logic/behavior.js';

const D2R = THREE.MathUtils.degToRad;
const clamp01 = x => Math.min(1, Math.max(0, x));
const ease = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// クジラを1頭作る。外側の Group を動かせば位置と向きが変わる。頭は -Z 方向。
// swim: 0 で体をしならせない(寝ているクジラ)、1 でふつうに泳ぐ
function makeWhale(kind, scale = 1, swim = 1) {
  const whale = createWhaleMesh(kind, WHALE_SPECS[kind].lengthMeters * scale);
  whale.setSwim(swim);
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  group.add(whale.mesh);
  return { group, mixer: whale, length: whale.length, kind };
}

// 海面に浮かんだときの中心の高さ。exposed は背中が海面から出る高さ(m)
const surfaceCache = new Map();
function surfaceY(w, exposed) {
  const key = `${w.kind}:${w.length}:${exposed}`;
  if (!surfaceCache.has(key)) surfaceCache.set(key, surfacedCenterY(w.kind, w.length, exposed));
  return surfaceCache.get(key);
}

// 体の前後の点(頭 = +0.5、尾 = -0.5)のワールド座標
function bodyPoint(whale, along, up = 0) {
  return whale.group.localToWorld(new THREE.Vector3(0, up, -along * whale.length)).toArray();
}

// 鼻の穴の位置。ザトウクジラは頭のうしろの上、マッコウクジラは頭の前の左寄り
function blowhole(w) {
  if (w.kind === 'sperm') {
    return w.group.localToWorld(new THREE.Vector3(-0.6, 1.5, -0.49 * w.length)).toArray();
  }
  return bodyPoint(w, 0.28, 1);
}

// クジラの頭が向いている水平の向き
function headingOf(w) {
  const v = new THREE.Vector3(0, 0, -1).applyQuaternion(w.group.quaternion);
  return [v.x, 0, v.z];
}

// 頭の向きの角度(度)
function headingYaw(w) {
  const [x, , z] = headingOf(w);
  return THREE.MathUtils.radToDeg(Math.atan2(-x, -z));
}

// 潮吹き(クジラの種類と向きに合わせる)
function blow(fx, w) {
  fx.effects.spout(blowhole(w), { kind: w.kind, forward: headingOf(w) });
}

// 向き yaw(度)で前に進む方向
function forward(yawDeg) {
  const y = D2R(yawDeg);
  return [-Math.sin(y), 0, -Math.cos(y)];
}

// 横切るように泳ぐ向き(左右どちらか ±25度)
function crossingYaw() {
  return (Math.random() < 0.5 ? 90 : -90) + (Math.random() * 50 - 25);
}

// 横切る出方の泳ぐ速さ(m/秒)。出発点の計算に使う
const SWIM_SPEED = { spout: 2, fluke: 2.2, motherCalf: 1.5 };

// 出方ごとの動き。each: (whales, t秒) で姿勢を決める。cues: その時刻に一度だけ起きること。
const MOTIONS = {
  spout({ start, yaw }) {
    const speed = 2;
    return {
      whales: [{ kind: 'humpback' }],
      each([w], t, D) {
        const f = forward(yaw);
        const rise = ease(t / 5) - ease((t - (D - 8)) / 5);
        // 沈む前に背中を丸めて、背中の上のほうと背びれを見せる
        const round = ease((t - (D - 11)) / 3) * (1 - ease((t - (D - 6)) / 4));
        const y = lerp(-6, surfaceY(w, 0.8), rise) + Math.sin(t * 0.8) * 0.15 + 0.5 * round;
        w.group.position.set(start[0] + f[0] * speed * t, y, start[2] + f[2] * speed * t);
        w.group.rotation.set(D2R(Math.sin(t * 0.5) * 2 - 14 * round), D2R(yaw), 0);
      },
      cues: [
        { at: 5, run: (fx, [w]) => fx.effects.foam(bodyPoint(w, 0), 9000) },
        { at: 7, run: (fx, [w]) => blow(fx, w) },
        { at: 19, run: (fx, [w]) => blow(fx, w) },
      ],
    };
  },

  fluke({ start, yaw }) {
    const speed = 2.2;
    return {
      whales: [{ kind: 'humpback' }],
      each([w], t) {
        const f = forward(yaw);
        // 1) 浮かんで潮を吹く 2) 背中を丸めて背びれを見せる 3) 尾びれを真上近くまで立てて裏の模様を見せ、まっすぐ沈む
        const round = ease((t - 9) / 3);
        const dive = ease((t - 13) / 7);
        const pitch = -14 * round * (1 - dive) + lerp(0, -80, dive);
        const y = lerp(-6, surfaceY(w, 0.7), ease(t / 5)) + 0.5 * round * (1 - dive) - dive * 3 - ease((t - 20.5) / 5) * 14;
        w.group.position.set(start[0] + f[0] * speed * t, y, start[2] + f[2] * speed * t);
        w.group.rotation.set(D2R(pitch + Math.sin(t * 0.6) * 2 * (1 - dive)), D2R(yaw), 0);
      },
      cues: [
        { at: 6, run: (fx, [w]) => blow(fx, w) },
        { at: 19.5, run: (fx, [w]) => fx.effects.splash(bodyPoint(w, -0.5), 'small') },
        { at: 21, run: (fx, [w]) => fx.effects.foam(bodyPoint(w, -0.3), 7000) },
        // 潜ったあとに、なめらかな足あとが残る
        { at: 23, run: (fx, [w]) => fx.footprint?.(bodyPoint(w, -0.5), yaw) },
      ],
    };
  },

  motherCalf({ start, yaw }) {
    const speed = 1.5;
    // 浮いたり沈んだりの周期。子は親より頻繁に浮上する
    const breathe = (w, exposed, t, period) => surfaceY(w, exposed) - 2.4 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period));
    return {
      whales: [{ kind: 'humpback' }, { kind: 'humpback', scale: 0.4 }],
      each([mom, calf], t, D) {
        const f = forward(yaw);
        const r = [-f[2], 0, f[0]]; // 右方向
        const env = ease(t / 6) - ease((t - (D - 8)) / 6);
        const base = [start[0] + f[0] * speed * t, start[2] + f[2] * speed * t];
        mom.group.position.set(base[0], lerp(-7, breathe(mom, 0.7, t, 20), env), base[1]);
        mom.group.rotation.set(D2R(Math.sin(t * 0.4) * 2), D2R(yaw), 0);
        // 子は親の斜め後ろ
        calf.group.position.set(base[0] + r[0] * 5 - f[0] * 5, lerp(-5, breathe(calf, 0.35, t + 3, 12), env), base[1] + r[2] * 5 - f[2] * 5);
        calf.group.rotation.set(D2R(Math.sin(t * 0.7) * 3), D2R(yaw), 0);
      },
      cues: [
        { at: 10, run: (fx, [mom]) => blow(fx, mom) },
        { at: 30, run: (fx, [mom]) => blow(fx, mom) },
        { at: 15, run: (fx, [, calf]) => fx.effects.foam(bodyPoint(calf, 0), 5000) },
      ],
    };
  },

  sleeping({ start }) {
    const yaw = Math.random() * 360;
    return {
      whales: [{ kind: 'sperm', swim: 0 }],
      each([w], t, D) {
        // 縦向きに浮いて、頭だけ海面にわずかに出す
        const env = ease(t / 8) - ease((t - (D - 8)) / 8);
        const top = lerp(-6, 0.8, env) + Math.sin(t * 0.35) * 0.2;
        w.group.position.set(start[0], top - w.length / 2, start[2]);
        w.group.rotation.set(D2R(84), D2R(yaw), D2R(Math.sin(t * 0.25) * 3));
      },
      cues: [
        {
          at: 70,
          run: (fx, [w]) => {
            // 体が縦なので、頭のてっぺん(海面の少し上)から、向いている方の左前へ吹く
            const top = w.group.localToWorld(new THREE.Vector3(-0.6, 0, -0.5 * w.length)).toArray();
            fx.effects.spout(top, { kind: 'sperm', forward: [-Math.sin(D2R(yaw)), 0, -Math.cos(D2R(yaw))] });
          },
        },
      ],
    };
  },

  breach({ start, yaw }) {
    return {
      whales: [{ kind: 'humpback' }],
      each([w], t) {
        const f = forward(yaw);
        const u = clamp01((t - 8) / 4);
        let y, pitch, roll;
        if (t < 8) { y = -12; pitch = 20; roll = 0; }
        else if (t < 12) {
          y = -8 + 52 * u - 52 * u * u;   // 頂点で +5m
          pitch = lerp(70, -10, u);
          roll = lerp(0, 80, u);
        } else { y = -8 - ease((t - 12) / 6) * 6; pitch = -10; roll = 80; }
        const along = t < 8 ? t * 0.5 : 4 + (t - 8) * 2.5;
        w.group.position.set(start[0] + f[0] * along, y, start[2] + f[2] * along);
        w.group.rotation.set(D2R(pitch), D2R(yaw), D2R(roll));
      },
      cues: [
        { at: 8.4, run: (fx, [w]) => fx.effects.splash(bodyPoint(w, 0.4), 'small') },
        {
          at: 8 + 0.82 * 4,
          run: (fx, [w]) => {
            const p = bodyPoint(w, 0);
            fx.effects.splash([p[0], 0, p[2]], 'large');
            fx.effects.foam([p[0], 0, p[2]], 12000);
            fx.playSound('splash');
          },
        },
      ],
    };
  },

  // 呼んだクジラ: 沖から近くまで来て、止まって歌い、向きを変えて潜って帰る
  summon() {
    const from = [120, -600];
    const stay = [0, -180];
    return {
      whales: [{ kind: 'humpback' }],
      each([w], t) {
        let x, z, yaw, y, pitch = 0;
        const approach = ease(t / 40);
        const leave = ease((t - 85) / 20);
        const turn = ease((t - 80) / 8);
        const yawIn = THREE.MathUtils.radToDeg(Math.atan2(-(stay[0] - from[0]), -(stay[1] - from[1])));
        yaw = lerp(yawIn, 180 + yawIn, turn);
        x = lerp(from[0], stay[0], approach);
        z = lerp(from[1], stay[1], approach) - leave * 60;
        y = lerp(-7, surfaceY(w, 0.9), ease((t - 6) / 8)) + Math.sin(t * 0.6) * 0.15;
        const dive = ease((t - 100) / 8);
        pitch = lerp(0, -65, dive);
        y -= dive * 2.5 + ease((t - 107) / 5) * 14;
        w.group.position.set(x, y, z);
        w.group.rotation.set(D2R(pitch + Math.sin(t * 0.5) * 2 * (1 - dive)), D2R(yaw), 0);
      },
      cues: [
        { at: 14, run: (fx, [w]) => fx.effects.foam(bodyPoint(w, 0), 8000) },
        // 着いたら歌い始め、帰り始めるまで歌う
        {
          at: PATTERNS.summon.songAtMs / 1000,
          run: fx => fx.playSound('humpback', { maxMs: (85 - PATTERNS.summon.songAtMs / 1000) * 1000 }),
        },
        { at: 45, run: (fx, [w]) => blow(fx, w) },
        { at: 70, run: (fx, [w]) => blow(fx, w) },
        { at: 106.5, run: (fx, [w]) => fx.effects.splash(bodyPoint(w, -0.5), 'small') },
        { at: 110, run: (fx, [w]) => fx.footprint?.(bodyPoint(w, -0.5), headingYaw(w)) },
      ],
    };
  },
};

// fx: { effects, playSound(name) } — 演出から水しぶきと効果音を出すために使う
// クジラの形は計算で作るので、読み込みに失敗することはない
export async function createWhales(scene, fx) {
  const models = { humpback: true, sperm: true };
  // 画面が出たあと、ひと息おいてから形を作っておく(最初のクジラが出るときに引っかからないように)
  setTimeout(prepareWhaleGeometry, 2000);
  const acts = new Set();

  // 出方を再生する。決まった時間で必ず終わる(画面が隠れて描画が止まっていても)。
  function play(name, position) {
    const { durationMs, needs } = PATTERNS[name];
    if (!needs || !MOTIONS[name]) return new Promise(r => setTimeout(r, durationMs));

    // 渡された位置を中ほどで通るように、出発点を進む向きの反対へずらす
    const yaw = name === 'fluke' ? divingYaw(Math.random) : crossingYaw();
    const back = (SWIM_SPEED[name] ?? 0) * (durationMs / 1000) / 2;
    const f = forward(yaw);
    const start = [position[0] - f[0] * back, 0, position[2] - f[2] * back];
    const motion = MOTIONS[name]({ start, yaw });
    const act = {
      whales: motion.whales.map(w => makeWhale(w.kind, w.scale, w.swim)),
      motion,
      t: 0,
      D: durationMs / 1000,
      fired: new Set(),
    };
    for (const w of act.whales) scene.add(w.group);
    motion.each(act.whales, 0, act.D);
    acts.add(act);

    return new Promise(r => setTimeout(() => {
      for (const w of act.whales) scene.remove(w.group);
      acts.delete(act);
      r();
    }, durationMs));
  }

  function update(dt) {
    for (const act of acts) {
      act.t += dt;
      act.motion.each(act.whales, act.t, act.D);
      act.motion.cues.forEach((c, i) => {
        if (act.t >= c.at && !act.fired.has(i)) {
          act.fired.add(i);
          c.run(fx, act.whales);
        }
      });
      for (const w of act.whales) w.mixer.update(dt);
    }
  }

  return { models, play, update };
}
