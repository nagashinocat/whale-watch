import * as THREE from 'three';
import { PATTERNS } from '../logic/patterns.js';
import { createWhaleMesh, prepareWhaleGeometry } from './whaleModel.js';
import { WHALE_SPECS, surfacedCenterY, bodySection, finTip } from '../logic/whaleShape.js';
import { divingYaw } from '../logic/behavior.js';
import { followFactor } from '../logic/quality.js';
import { SPOT } from './cameras.js';

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

// t が a から b のあいだで 0 → 1 になる
const smoothstepT = (t, a, b) => ease((t - a) / (b - a));

// 胸びれの先の位置(side: 1 が右)
function finWorld(w, side) {
  const t = finTip(w.kind, side).tip;
  return w.group.localToWorld(new THREE.Vector3(t[0] * w.length, t[1] * w.length, t[2] * w.length)).toArray();
}

// 体から流れ落ちる水を出す場所(背中の線・胸びれの先・尾びれの先)。体長1の比率
function wetPoints(kind) {
  const pts = [];
  for (let u = 0.05; u <= 0.95; u += 0.075) {
    const s = bodySection(kind, u);
    pts.push([0, s.centerY + s.halfHeight, -0.5 + u * 0.94]);
  }
  if (kind === 'humpback') { pts.push(finTip(kind, 1).tip, finTip(kind, -1).tip); }
  pts.push([0.15, 0, 0.47], [-0.15, 0, 0.47]);
  return pts;
}
const WET = { humpback: wetPoints('humpback'), sperm: wetPoints('sperm') };

// 点の真下の海面
const onWater = p => [p[0], 0, p[2]];

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
// カメラに体の横を見せて泳ぐ向き(左右どちらか ±10度)。
// 横から見ると、長い胸びれや背中の形で、ひと目でクジラだとわかる
function crossingYaw() {
  return (Math.random() < 0.5 ? 90 : -90) + (Math.random() * 20 - 10);
}

// 横切る出方の泳ぐ速さ(m/秒)。出発点の計算に使う
// クジラは決まった場所に出て、画面から出ないように、その場でゆっくり泳ぐ(片側10mくらいまで)
const SWIM_SPEED = { spout: 0.5, fluke: 0.8, motherCalf: 0.33, breach: 0.38 };

// 出方ごとの動き。each: (whales, t秒) で姿勢を決める。cues: その時刻に一度だけ起きること。
const MOTIONS = {
  spout({ start, yaw }) {
    const speed = SWIM_SPEED.spout;
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
    const speed = SWIM_SPEED.fluke;
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
        { at: 19.5, run: (fx, [w]) => fx.effects.splash(onWater(bodyPoint(w, -0.5)), 'small', headingOf(w)) },
        { at: 21, run: (fx, [w]) => fx.effects.foam(bodyPoint(w, -0.3), 7000) },
        // 潜ったあとに、なめらかな足あとが残る
        { at: 23, run: (fx, [w]) => fx.footprint?.(bodyPoint(w, -0.5), yaw) },
      ],
    };
  },

  motherCalf({ start, yaw }) {
    const speed = SWIM_SPEED.motherCalf;
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
          // 体を立てて飛び出し、いちばん高いところは水面から6mほど(ふつうは4.5m、ときには6m以上)。
          // 体の半分以上が水から出て、横向きに倒れて着水する
          y = -8 + 34.4 * u - 34.4 * u * u;
          pitch = lerp(75, -10, u ** 1.6);
          roll = lerp(0, 80, u);
        } else { y = -8 - ease((t - 12) / 6) * 6; pitch = -10; roll = 80; }
        const along = t < 8 ? t * 0.3 : 2.4 + Math.min(t - 8, 6) * 1.2;
        w.group.position.set(start[0] + f[0] * along, y, start[2] + f[2] * along);
        w.group.rotation.set(D2R(pitch), D2R(yaw), D2R(roll));
      },
      cues: [
        { at: 8.4, run: (fx, [w]) => fx.effects.splash(onWater(bodyPoint(w, 0.4)), 'small', headingOf(w)) },
        {
          at: 8 + 0.82 * 4,
          run: (fx, [w]) => {
            const p = bodyPoint(w, 0);
            fx.effects.splash([p[0], 0, p[2]], 'large', headingOf(w));
            fx.impact?.([p[0], 0, p[2]], 1);
            fx.effects.foam([p[0], 0, p[2]], 12000);
            fx.playSound('splash', { position: [p[0], 0, p[2]] });
          },
        },
      ],
    };
  },

  // スパイホップ: 体を縦にしてゆっくり上がり、頭だけを出して、こちらを見ながらまわりを見回す
  spyhop({ start }) {
    const headOut = 4;   // 海面から出る頭の高さ(m)。頭は体長の約3分の1
    return {
      whales: [{ kind: 'humpback', swim: 0.2 }],
      each([w], t, D) {
        const rise = ease(t / 9) - ease((t - (D - 9)) / 6);
        const tipY = lerp(-4, headOut, rise) + Math.sin(t * 0.7) * 0.15 * rise;
        const pitch = 85;
        // おなか(のどの白いところ)をカメラに向け、ゆっくり左右を見回す
        const look = 180 + 35 * Math.sin(t * 0.22) * smoothstepT(t, 9, 13);
        w.group.position.set(start[0], tipY - (w.length / 2) * Math.sin(D2R(pitch)), start[2]);
        w.group.rotation.set(D2R(pitch), D2R(look), 0);
      },
      cues: [
        { at: 3.5, run: (fx, [w]) => fx.effects.foam(onWater([start[0], 0, start[2]]), 6000) },
      ],
    };
  },

  // 胸びれで水面をたたく: 横に転がって片方の胸びれを空に上げ、何度も水面に打ちつける
  pecSlap({ start, yaw }) {
    const period = 3.2, first = 6, count = 7;
    // 0 で胸びれがいちばん上、1 で水面をたたく(すばやく振り下ろし、ゆっくり持ち上げる)
    const stroke = t => {
      if (t < first) return 0;
      const ph = ((t - first) % period) / period;
      return ph < 0.25 ? ease(ph / 0.25) : 1 - ease((ph - 0.25) / 0.75);
    };
    const cues = [];
    for (let k = 0; k < count; k++) {
      cues.push({
        at: first + k * period + 0.25 * period,
        run: (fx, [w]) => {
          const tip = finWorld(w, 1);
          fx.effects.splash(onWater(tip), 'small', headingOf(w));
          fx.impact?.(onWater(tip), 0.4);
          fx.playSound('splash', { gain: 0.6, position: onWater(tip) });
        },
      });
    }
    return {
      whales: [{ kind: 'humpback', swim: 0.3 }],
      each([w], t, D) {
        const active = t < first + count * period ? 1 : 0;
        const on = ease(t / 4) * (1 - ease((t - (D - 5)) / 4));
        // 胸びれは体から斜め下に出ているので、120度転がると真上を向き、40度まで戻すと水面をたたく
        const roll = on * (120 - 80 * stroke(t) * active);
        const y = lerp(-5, -1.1, ease(t / 4)) - 4 * ease((t - (D - 4)) / 4);
        w.group.position.set(start[0], y, start[2]);
        w.group.rotation.set(0, D2R(yaw), D2R(roll));
      },
      cues,
    };
  },

  // 尾びれで水面をたたく: 頭を下げて尾びれを持ち上げ、水面に強く打ちつける。それを何度もくり返す
  lobtail({ start, yaw }) {
    const period = 3.6, first = 7, count = 5;
    const cues = [];
    for (let k = 0; k < count; k++) {
      cues.push({
        at: first + k * period + 0.7,
        run: (fx, [w]) => {
          const tail = onWater(bodyPoint(w, -0.5));
          fx.effects.splash(tail, 'small', headingOf(w));
          fx.effects.splash(tail, 'small', headingOf(w));
          fx.impact?.(tail, 0.7);
          fx.playSound('splash', { gain: 0.8, position: tail });
        },
      });
    }
    cues.push({ at: first + count * period + 3, run: (fx, [w]) => fx.footprint?.(bodyPoint(w, -0.4), yaw) });
    return {
      whales: [{ kind: 'humpback', swim: 0.3 }],
      each([w], t, D) {
        let pitch;
        if (t < first) pitch = lerp(0, -55, ease((t - 2) / 5));
        else if (t < first + count * period) {
          const ph = (t - first) % period;
          // すばやく打ちつけて(1秒)、ゆっくり持ち上げる(2.6秒)
          pitch = ph < 1.0 ? lerp(-55, -5, ease(ph / 1.0) ** 1.6) : lerp(-5, -55, ease((ph - 1.0) / 2.6));
        } else pitch = lerp(-55, -70, ease((t - first - count * period) / 3));
        const y = lerp(-6, -2.4, ease(t / 4)) - 10 * ease((t - (D - 5)) / 5);
        w.group.position.set(start[0], y, start[2]);
        w.group.rotation.set(D2R(pitch), D2R(yaw), 0);
      },
      cues,
    };
  },

  // 呼んだクジラ: 沖から近くまで来て、止まって歌い、向きを変えて潜って帰る
  summon() {
    const from = [60, SPOT[2] - 220];
    const stay = [SPOT[0], SPOT[2]];
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
          run: (fx, [w]) => fx.playSound('humpback', { maxMs: (85 - PATTERNS.summon.songAtMs / 1000) * 1000, position: bodyPoint(w, 0) }),
        },
        { at: 45, run: (fx, [w]) => blow(fx, w) },
        { at: 70, run: (fx, [w]) => blow(fx, w) },
        { at: 106.5, run: (fx, [w]) => fx.effects.splash(onWater(bodyPoint(w, -0.5)), 'small', headingOf(w)) },
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
    // 尾びれを見せる出方は、カメラから遠ざかる向き(尾びれの裏がこちらを向き、画面のまんなかに来る)
    const yaw = name === 'fluke' || name === 'lobtail' ? divingYaw(Math.random) : crossingYaw();
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
      // 決めた姿勢へ、なめらかに追いかける(動きの急な変わり目で、がくっとならないように)
      const k = followFactor(dt);
      for (const w of act.whales) {
        if (!w.smooth) {
          w.smooth = { pos: w.group.position.clone(), quat: w.group.quaternion.clone() };
        } else {
          w.smooth.pos.lerp(w.group.position, k);
          w.smooth.quat.slerp(w.group.quaternion, k);
          w.group.position.copy(w.smooth.pos);
          w.group.quaternion.copy(w.smooth.quat);
        }
      }
      act.motion.cues.forEach((c, i) => {
        if (act.t >= c.at && !act.fired.has(i)) {
          act.fired.add(i);
          c.run(fx, act.whales);
        }
      });
      for (const w of act.whales) {
        w.mixer.update(dt);
        pourWater(w, dt);
      }
    }
  }

  // 体のうち、水から上がってきている場所から水を流れ落とす
  function pourWater(w, dt) {
    if (dt <= 0 || !fx.effects.cascade) return;
    const pts = WET[w.kind];
    w.prevY ??= new Array(pts.length).fill(-Infinity);
    pts.forEach((p, i) => {
      const world = w.group.localToWorld(new THREE.Vector3(p[0] * w.length, p[1] * w.length + 0.1, p[2] * w.length)).toArray();
      const rising = (world[1] - w.prevY[i]) / dt;
      w.prevY[i] = world[1];
      if (world[1] > 0.2 && rising > 0.3 && rising < 40) {
        const n = Math.min(6, Math.round(Math.min(rising, 4) * 18 * dt + Math.random()));
        if (n > 0) fx.effects.cascade(world, n);
      }
    });
  }

  return { models, play, update };
}
