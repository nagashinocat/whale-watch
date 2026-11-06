import * as THREE from 'three';
import { PATTERNS } from '../logic/patterns.js';
import { createWhaleMesh, prepareWhaleGeometry } from './whaleModel.js';
import { WHALE_SPECS, surfacedCenterY, bodySection, finTip, jawPoint, faceFeatures } from '../logic/whaleShape.js';
import { FEEDING, feedingPose, BUBBLE_NET, bubbleNetGroup } from '../logic/feeding.js';
import { BREATH, diveSurfacing, calfBreaths } from '../logic/breathing.js';
import { SLEEP, sleepingGroup, headBob } from '../logic/sleep.js';
import { individual as individualById } from '../logic/flukeId.js';
import { lengthOf } from '../logic/zukan.js';
import { BREACH, breachPose, groupBreachPlan, calfBreachPlan, POD, podPlan, groupSpyhopPlan } from '../logic/breach.js';
import { divingYaw } from '../logic/behavior.js';
import { followFactor } from '../logic/quality.js';
import { SPOT, CAMERA_PRESETS } from './cameras.js';
import { eyeFrame, EYE } from '../logic/eyeShape.js';

const D2R = THREE.MathUtils.degToRad;
const clamp01 = x => Math.min(1, Math.max(0, x));
const ease = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// クジラを1頭作る。外側の Group を動かせば位置と向きが変わる。頭は -Z 方向。
// swim: 0 で体をしならせない(寝ているクジラ)、1 でふつうに泳ぐ
// individual: 尾びれの裏の模様で見分けられる1頭(おとなのザトウクジラだけ)
function makeWhale(kind, scale = 1, swim = 1, individual = null) {
  // 大きい子・小さめの子(個性)。図鑑の全長と同じ大きさにする
  const size = individual ? lengthOf(individual) / WHALE_SPECS.humpback.lengthMeters : 1;
  const whale = createWhaleMesh(kind, WHALE_SPECS[kind].lengthMeters * scale * size, { individual });
  whale.setSwim(swim);
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  group.add(whale.mesh);
  return { group, mixer: whale, length: whale.length, kind, individual };
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

// 潮吹き(クジラの種類と向きに合わせる)。「プシュー」という息の音も、クジラのいる場所から聞こえる
// calf: 子クジラ(潮吹きも息の音も小さい)
function blow(fx, w, { calf = false } = {}) {
  const at = blowhole(w);
  fx.effects.spout(at, { kind: w.kind, forward: headingOf(w), scale: calf ? BREATH.calfScale : 1 });
  fx.playSound('blow', { gain: calf ? BREATH.gain.calf : BREATH.gain.adult, maxMs: 4000, position: at });
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
// 尾びれの出方は何回か潮を吹くので長い。ゆっくり進んで、画面の外へ出ないようにする
const SWIM_SPEED = { spout: 0.5, fluke: 0.3, motherCalf: 0.33, breach: 0.38, groupBreach: 0.38, pod: POD.speed };

// スパイホップの姿勢: 体を縦にしてゆっくり上がり、頭(体長の約3分の1)を出して、こちらを見ながらまわりを見回す。
// D は出ている長さ、headOut は頭の出る高さ(m)、lookPhase は見回しのずれ、face はおなかを向ける向きのずれ(度)
function spyhopAt(w, t, D, at, headOut, lookPhase, face) {
  const rise = ease(t / 9) - ease((t - (D - 9)) / 6);
  const tipY = lerp(-4, headOut, rise) + Math.sin(t * 0.7 + lookPhase) * 0.15 * rise;
  const pitch = 85;
  // おなか(のどの白いところ)をカメラに向け、ゆっくり左右を見回す
  const look = 180 + face + 35 * Math.sin(t * 0.22 + lookPhase) * smoothstepT(t, 9, 13);
  w.group.position.set(at[0], tipY - (w.length / 2) * Math.sin(D2R(pitch)), at[2]);
  w.group.rotation.set(D2R(pitch), D2R(look), 0);
}

// 1頭のジャンプ(launch 秒に飛び出す)。start から yaw の向きへ跳ぶ。rollSign は倒れる向き(1 か -1)
function breachAt(w, t, launch, start, yaw, rollSign = 1) {
  const p = breachPose(t - launch, w.length / 14);
  const f = forward(yaw);
  w.group.position.set(start[0] + f[0] * p.along, p.y, start[2] + f[2] * p.along);
  w.group.rotation.set(D2R(p.pitch), D2R(yaw), D2R(p.roll * rollSign));
}

// ジャンプの水しぶきと音(i 番目のクジラ)。小さいクジラは小さなしぶき
function breachCues(i, launch) {
  return [
    {
      at: launch + 0.4,
      run: (fx, ws) => {
        const p = onWater(bodyPoint(ws[i], 0.4));
        fx.effects.splash(p, 'small', headingOf(ws[i]));
        // 水を割って体が出てくる「ザバァ」
        fx.playSound('breach-rise', { gain: 0.4 + 0.6 * (ws[i].length / 14), position: p });
      },
    },
    {
      at: launch + BREACH.air * BREACH.splashAt,
      run: (fx, ws) => {
        const w = ws[i], k = w.length / 14;
        const p = onWater(bodyPoint(w, 0));
        fx.effects.splash(p, k > 0.6 ? 'large' : 'small', headingOf(w));
        if (k <= 0.6) fx.effects.splash(p, 'small', headingOf(w));
        fx.impact?.(p, k);
        fx.effects.foam(p, 12000 * Math.max(0.5, k), { radius: 6 * Math.max(0.5, k) });
        // 着水の「ドーン」(小さいクジラは軽い音)
        fx.playSound(k > 0.6 ? 'breach' : 'splash', { gain: k > 0.6 ? 1 : 0.55, position: p });
      },
    },
  ];
}

// 右の向き(向き f に対して)
const rightOf = f => [-f[2], 0, f[0]];
const offsetBy = (p, r, side) => [p[0] + r[0] * side, 0, p[2] + r[2] * side];

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

  // 尾びれを上げて潜る: 浮かんで何回か潮を吹き(そのあいだは浅く沈んではまた浮かぶ)、
  // 最後の潮吹きのあと背中を丸め、尾びれを真上近くまで立てて裏の模様を見せ、まっすぐ沈む
  fluke({ start, yaw }) {
    const speed = SWIM_SPEED.fluke;
    const plan = diveSurfacing();
    const last = plan.blows[plan.blows.length - 1];
    return {
      whales: [{ kind: 'humpback' }],
      each([w], t) {
        const f = forward(yaw);
        const round = ease((t - plan.round) / 3);
        const dive = ease((t - plan.dive) / 7);
        const pitch = -14 * round * (1 - dive) + lerp(0, -80, dive);
        // 潮吹きのときに背中を出し、つぎの潮吹きまでのあいだは少し沈む
        let dip = 0;
        if (t < last) {
          const next = plan.blows.find(b => b >= t) ?? last;
          const prev = [...plan.blows].reverse().find(b => b < t) ?? 0;
          const k = (t - prev) / Math.max(1, next - prev);
          dip = prev ? Math.sin(Math.PI * clamp01(k)) * 1.3 : 0;
        }
        const y = lerp(-6, surfaceY(w, 0.7), ease(t / 5)) - dip + 0.5 * round * (1 - dive) - dive * 3 - ease((t - (plan.dive + 7.5)) / 5) * 14;
        w.group.position.set(start[0] + f[0] * speed * t, y, start[2] + f[2] * speed * t);
        w.group.rotation.set(D2R(pitch + Math.sin(t * 0.6) * 2 * (1 - dive) - 4 * dip), D2R(yaw), 0);
      },
      cues: [
        ...plan.blows.map(at => ({ at, run: (fx, [w]) => blow(fx, w) })),
        { at: plan.dive + 6.5, run: (fx, [w]) => fx.effects.splash(onWater(bodyPoint(w, -0.5)), 'small', headingOf(w)) },
        { at: plan.dive + 8, run: (fx, [w]) => fx.effects.foam(bodyPoint(w, -0.3), 7000) },
        // 潜ったあとに、なめらかな足あとが残る
        { at: plan.dive + 10, run: (fx, [w]) => fx.footprint?.(bodyPoint(w, -0.5), yaw) },
        // 尾びれの裏が見えたら、図鑑に記録する
        { at: plan.dive + 4, run: (fx, [w]) => fx.sighted?.(w) },
      ],
    };
  },

  // 親子: 母親はゆっくり泳いで2回だけ息をする。子どもは母親の斜めうしろにくっついて泳ぎ、
  // 母親より短い間隔で何度も浮かんで、小さな潮を吹く
  motherCalf({ start, yaw }) {
    const speed = SWIM_SPEED.motherCalf;
    const plan = calfBreaths();
    // 息をする時刻のまわりだけ水面に出て、あとは少し沈んでいる
    const near = (t, times, width) => Math.max(0, ...times.map(b => 1 - Math.min(1, Math.abs(t - b) / width)));
    const surfacing = (t, times, width) => ease(near(t, times, width));
    return {
      whales: [{ kind: 'humpback' }, { kind: 'humpback', scale: 0.4 }],
      each([mom, calf], t, D) {
        const f = forward(yaw);
        const r = [-f[2], 0, f[0]]; // 右方向
        const env = ease(t / 6) - ease((t - (D - 8)) / 6);
        const base = [start[0] + f[0] * speed * t, start[2] + f[2] * speed * t];
        const momUp = surfacing(t, plan.mother, 9);
        mom.group.position.set(base[0], lerp(-7, surfaceY(mom, 0.7) - 2.4 * (1 - momUp), env), base[1]);
        mom.group.rotation.set(D2R(Math.sin(t * 0.4) * 2 - 6 * (1 - momUp)), D2R(yaw), 0);
        // 子は親の斜めうしろ。浮かぶときは頭を少し上げて、ぴょこっと出る
        const calfUp = surfacing(t, plan.calf, 4);
        calf.group.position.set(
          base[0] + r[0] * 5 - f[0] * 5,
          lerp(-5, surfaceY(calf, 0.35) - 1.6 * (1 - calfUp), env),
          base[1] + r[2] * 5 - f[2] * 5);
        calf.group.rotation.set(D2R(Math.sin(t * 0.7) * 3 + 8 * calfUp * Math.sin(t * 1.2)), D2R(yaw), 0);
      },
      cues: [
        ...plan.mother.map(at => ({ at, run: (fx, [mom]) => blow(fx, mom) })),
        ...plan.calf.map(at => ({ at, run: (fx, [, calf]) => blow(fx, calf, { calf: true }) })),
        { at: 15, run: (fx, [, calf]) => fx.effects.foam(bodyPoint(calf, 0), 5000) },
      ],
    };
  },

  // マッコウクジラの休み方と眠り: はじめは水面に丸太のように横になって浮かび、ときどき潮を吹く。
  // それから5〜6頭がそろって縦になり、頭を水面すれすれにしてじっと眠る(ときどき頭が水面に出る)。
  // 眠っている頭のまわりは、水面がなめらかになる。しばらくすると、ひとりずつ目をさまして横になり、
  // 息をして、カチカチ鳴きながらゆっくり泳ぎ去る
  sleeping({ start }) {
    const group = sleepingGroup();
    const headPos = (w, g) => [start[0] + g.offset[0], 0, start[2] + g.offset[1]];
    return {
      whales: group.map(g => ({ kind: 'sperm', swim: 0, scale: g.scale })),
      each(ws, t, D) {
        ws.forEach((w, i) => {
          const g = group[i];
          const arrive = ease((t - i * 1.2) / 6);
          const stand = ease((t - (SLEEP.logEnd + i * 0.6)) / (SLEEP.sleepAt - SLEEP.logEnd - 2));
          const wake = ease((t - g.wake) / SLEEP.wakeTurn);
          const upright = stand * (1 - wake);
          const away = Math.max(0, t - g.wake - SLEEP.wakeTurn);
          const leave = ease((t - (D - 8)) / 8);
          const pitch = 84 * upright - 10 * leave;
          // 横になっているときは背中が水面から少し出る。縦のときは頭のてっぺんが水面すれすれ
          const lying = surfaceY(w, 0.6);
          const sleepingTop = g.top + headBob(g, t) + Math.sin(t * 0.3 + i) * 0.08;
          // 頭を水面の近くにおいたまま、体を立てたり寝かせたりする(頭が急に持ち上がらない)
          const head = lerp(lerp(-6, lying, arrive), sleepingTop, upright);
          const y = head - (w.length / 2) * Math.sin(D2R(pitch)) - leave * 6;
          const f = forward(g.yaw);
          const drift = away * 0.8;
          w.mixer.setSwim(0.4 * wake);
          w.group.position.set(start[0] + g.offset[0] + f[0] * drift, y, start[2] + g.offset[1] + f[2] * drift);
          w.group.rotation.set(D2R(pitch), D2R(g.yaw), D2R(Math.sin(t * 0.2 + i) * 3 * upright));
        });
      },
      cues: [
        // 横になって休んでいるあいだの潮吹き(頭の前の左寄りから、ななめ前へ)
        ...group.flatMap((g, i) => g.logBlows.map(at => ({ at, run: (fx, ws) => blow(fx, ws[i]) }))),
        // 眠っている頭のまわりの、なめらかな水面
        ...SLEEP.slicks.flatMap(at => group.map((g, i) => ({ at: at + i * 0.4, run: (fx, ws) => fx.footprint?.(headPos(ws[i], g), g.yaw) }))),
        // 目をさまして横になったら、息をする
        ...group.map((g, i) => ({ at: g.wake + SLEEP.wakeTurn - 0.5, run: (fx, ws) => blow(fx, ws[i]) })),
        // 起きると、カチカチという音で話しはじめる
        { at: Math.min(...group.map(g => g.wake)) + 3, run: fx => fx.playSound('sperm', { maxMs: 12000, position: [start[0], -4, start[2]] }) },
      ],
    };
  },

  breach({ start, yaw }) {
    const launch = BREACH.approach;
    return {
      whales: [{ kind: 'humpback' }],
      each([w], t) { breachAt(w, t, launch, start, yaw); },
      cues: breachCues(0, launch),
    };
  },

  // 群れでジャンプ: 2〜3頭が横にならび、少しずつずれて跳ぶ。外側の2頭は鏡に映したように反対へ倒れる
  groupBreach({ start, yaw }) {
    const plan = groupBreachPlan();
    const r = rightOf(forward(yaw));
    return {
      whales: plan.map(() => ({ kind: 'humpback' })),
      each(ws, t) { ws.forEach((w, i) => breachAt(w, t, plan[i].launch, offsetBy(start, r, plan[i].side), yaw, plan[i].rollSign)); },
      cues: plan.flatMap((p, i) => breachCues(i, p.launch)),
    };
  },

  // 親子でジャンプ: 母親は水面でゆっくり息をしている。そのそばで子どもが何度も跳んで練習し、
  // 最後は母親が子どもとならんで、鏡に映したようにいっしょに跳ぶ
  calfBreach({ start, yaw }) {
    const plan = calfBreachPlan();
    const r = rightOf(forward(yaw));
    const momAt = offsetBy(start, r, -4.5), calfAt = offsetBy(start, r, 4);
    return {
      whales: [{ kind: 'humpback' }, { kind: 'humpback', scale: 0.4 }],
      each([mom, calf], t) {
        // 母親: はじめは水面でただよって息をし、跳ぶ前に深くもぐって勢いをつける
        const before = plan.mother - BREACH.approach;
        if (t < before) {
          const sink = ease((t - (before - 4)) / 4);
          const y = lerp(lerp(-6, surfaceY(mom, 0.7), ease(t / 5)) + Math.sin(t * 0.7) * 0.12, -12, sink);
          mom.group.position.set(momAt[0], y, momAt[2]);
          mom.group.rotation.set(D2R(lerp(Math.sin(t * 0.5) * 2, 20, sink)), D2R(yaw), 0);
        } else breachAt(mom, t, plan.mother, momAt, yaw, -1);
        // 子ども: いまの(またはつぎの)ジャンプ
        const launch = plan.calf.find(l => t < l + BREACH.air + 3) ?? plan.calf[plan.calf.length - 1];
        breachAt(calf, t, launch, calfAt, yaw + 8 * Math.sin(launch), 1);
      },
      cues: [
        ...plan.motherBlows.map(at => ({ at, run: (fx, [mom]) => blow(fx, mom) })),
        ...plan.calf.flatMap(l => breachCues(1, l)),
        ...breachCues(0, plan.mother),
      ],
    };
  },

  // 群れで泳ぐ: 母親がペースを決め、子どもはぴったりくっつき、付きそいのオスはうしろから。
  // ほかのおとなも少しはなれてついてくる。みんなばらばらに浮かんで息をし、最後は1頭ずつ尾びれを上げて潜る
  pod({ start, yaw }) {
    const plan = podPlan();
    const near = (t, times, width) => Math.max(0, ...times.map(b => 1 - Math.min(1, Math.abs(t - b) / width)));
    const cues = [];
    plan.forEach((p, i) => {
      const calf = p.role === 'calf';
      for (const b of p.blows) cues.push({ at: b, run: (fx, ws) => blow(fx, ws[i], { calf }) });
      if (!calf) {
        cues.push({ at: p.dive + 4, run: (fx, ws) => fx.sighted?.(ws[i]) });
        cues.push({ at: p.dive + 6.5, run: (fx, ws) => fx.effects.splash(onWater(bodyPoint(ws[i], -0.5)), 'small', headingOf(ws[i])) });
        cues.push({ at: p.dive + 10, run: (fx, ws) => fx.footprint?.(bodyPoint(ws[i], -0.5), headingYaw(ws[i])) });
      }
    });
    return {
      whales: plan.map(p => ({ kind: 'humpback', scale: p.scale })),
      each(ws, t) {
        const f = forward(yaw), r = rightOf(f);
        const lead = [start[0] + f[0] * POD.speed * t, start[2] + f[2] * POD.speed * t];
        ws.forEach((w, i) => {
          const p = plan[i];
          const calf = p.role === 'calf';
          const env = ease((t - i * 0.8) / 6);
          const up = ease(near(t, p.blows, calf ? 3 : 5));
          const round = calf ? 0 : ease((t - (p.dive - 3)) / 3);
          const dive = ease((t - p.dive) / 7);
          let y = lerp(-7, surfaceY(w, calf ? 0.35 : 0.7) - (calf ? 1.6 : 2.2) * (1 - up) * (1 - round), env);
          y += 0.5 * round * (1 - dive) - dive * (calf ? 8 : 3) - ease((t - (p.dive + 7.5)) / 5) * 14;
          const pitch = calf ? -20 * dive : -14 * round * (1 - dive) + lerp(0, -80, dive);
          w.group.position.set(lead[0] + r[0] * p.offset[0] - f[0] * p.offset[1], y, lead[1] + r[2] * p.offset[0] - f[2] * p.offset[1]);
          w.group.rotation.set(D2R(pitch + Math.sin(t * 0.5 + i) * 2 * (1 - dive) - 5 * (1 - up) * (1 - dive)), D2R(yaw), 0);
        });
      },
      cues,
    };
  },


  // スパイホップ: 体を縦にしてゆっくり上がり、頭だけを出して、こちらを見ながらまわりを見回す
  spyhop({ start }) {
    return {
      whales: [{ kind: 'humpback', swim: 0.2 }],
      each([w], t, D) { spyhopAt(w, t, D, start, 4, 0, 0); },
      cues: [
        { at: 3.5, run: fx => fx.effects.foam(onWater([start[0], 0, start[2]]), 6000) },
      ],
    };
  },

  // 群れでスパイホップ: 3〜4頭がまとまって、少しずつずれて頭を出す。高さも見回す向きも1頭ずつちがう
  groupSpyhop({ start }) {
    const plan = groupSpyhopPlan();
    const at = p => [start[0] + p.offset[0], 0, start[2] + p.offset[1]];
    return {
      whales: plan.map(() => ({ kind: 'humpback', swim: 0.2 })),
      each(ws, t, D) {
        ws.forEach((w, i) => {
          const p = plan[i];
          // 遅れて出た子は、それだけ遅れて沈む(全体の長さは同じ)
          spyhopAt(w, t - p.delay, D - 4, at(p), p.headOut, p.lookPhase, 25 * Math.sin(p.lookPhase));
        });
      },
      cues: plan.map(p => ({ at: p.delay + 3.5, run: fx => fx.effects.foam(at(p), 6000, { radius: 3.5, count: 200 }) })),
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
          // 胸びれが水面を打つ「ベチャン」(毎回少しずつちがう音)
          fx.playSound('pec-slap', { gain: 0.9, rate: 0.9 + Math.random() * 0.2, position: onWater(tip) });
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
          // 尾びれが水面を打つ「バシーン」(鋭い音で、遠くまで届く)
          fx.playSound('tail-slap', { gain: 1, rate: 0.92 + Math.random() * 0.16, position: tail });
        },
      });
    }
    cues.push({ at: first + count * period + 3, run: (fx, [w]) => fx.footprint?.(bodyPoint(w, -0.4), yaw) });
    // 尾びれの裏が見えたら、図鑑に記録する
    cues.push({ at: first + 1.5, run: (fx, [w]) => fx.sighted?.(w) });
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

  // 捕食(突進して水ごとのみこむ): 泡の輪ができ、そのまん中から口を大きく開けて飛び出す。
  // のどをふくらませて水をのみこみ、口を閉じて沈む。水面に横になって水をこし出し、最後に潮吹きをして潜る
  feeding({ start, yaw }) {
    const F = FEEDING;
    const c = [start[0], start[2]];
    const f = forward(yaw);
    let pose = feedingPose(0);
    const mouth = faceFeatures('humpback').mouth;
    // あごのふちの点(口を開けた形で)のワールド座標
    const lip = (w, u, below, side) => {
      const m = mouth.reduce((a, b) => (Math.abs(b.u - u) < Math.abs(a.u - u) ? b : a));
      const theta = m.theta + (below ? 0.12 : -0.12);
      const p = jawPoint('humpback', u, side > 0 ? theta : 2 * Math.PI - theta,
        pose.gape * F.lowerJaw, pose.gape * F.upperJaw, pose.pouch);
      return w.group.localToWorld(new THREE.Vector3(...p).multiplyScalar(w.length)).toArray();
    };
    const cues = [];
    // 泡の輪: うずを巻きながら輪がとじていく
    const N = 28;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2 * 1.15 + yaw * 0.017;
      const r = F.ringRadius * (1.25 - 0.25 * (k / N));
      const at = F.ringStart + (k / N) * (F.ringEnd - F.ringStart);
      const p = [c[0] + Math.cos(a) * r, 0, c[1] + Math.sin(a) * r];
      cues.push({ at, run: fx => { fx.effects.foam(p, (F.surface + 8 - at) * 1000, { radius: 1.1, count: 45 }); fx.effects.bubbles(p, 6); } });
    }
    cues.push({ at: 0.5, run: fx => fx.playSound('bubbles', { gain: 0.6, maxMs: 10000, position: [c[0], 0, c[1]] }) });
    cues.push({ at: F.call, run: fx => fx.playSound('humpback-call', { gain: 0.7, maxMs: 6000, position: [c[0], -5, c[1]] }) });
    cues.push({
      at: F.surface,
      run: fx => {
        fx.effects.splash([c[0], 0, c[1]], 'small', f);
        fx.effects.leap([c[0], 0, c[1]], 40, 3.5);
        fx.effects.foam([c[0], 0, c[1]], 16000);
        fx.playSound('splash', { gain: 0.6, position: [c[0], 0, c[1]] });
      },
    });
    // 開いた口から、のみきれない水があふれ落ちる
    for (let t = F.surface + 0.3; t < F.closed; t += 0.25) {
      cues.push({ at: t, run: (fx, [w]) => {
        for (const side of [1, -1]) for (const u of [0.06, 0.13, 0.2]) fx.effects.cascade(lip(w, u, true, side), 3);
        fx.effects.cascade(lip(w, 0.04, false, Math.random() < 0.5 ? 1 : -1), 2);
      } });
    }
    cues.push({ at: F.fall + 1.5, run: fx => { fx.effects.splash([c[0], 0, c[1]], 'small', f); fx.effects.foam([c[0], 0, c[1]], 14000); } });
    // 水面に横になって、口のわきから水を押し出す
    for (let t = F.filterStart + 1; t < F.filterEnd - 4; t += 1.3) {
      cues.push({ at: t, run: (fx, [w]) => {
        const side = Math.random() < 0.5 ? 1 : -1;
        const p = lip(w, 0.12 + Math.random() * 0.12, false, side);
        if (p[1] > -0.3) fx.effects.cascade([p[0], Math.max(0.05, p[1]), p[2]], 3);
      } });
    }
    cues.push({ at: F.blow, run: (fx, [w]) => blow(fx, w) });
    cues.push({ at: F.blow + 8, run: (fx, [w]) => fx.footprint?.(bodyPoint(w, -0.5), headingYaw(w)) });

    return {
      whales: [{ kind: 'humpback' }],
      each([w], t) {
        pose = feedingPose(t);
        w.mixer.setJaw(pose.gape * F.lowerJaw, pose.gape * F.upperJaw, pose.pouch);
        // 突進するときは尾びれを強くあおぎ、横になってこし出すときはほとんど動かない
        w.mixer.setSwim(t < F.fall + 6 ? 1 : 0.3 + 0.7 * pose.dive);
        const pitch = pose.pitch - 20 * pose.dive;
        const upright = pose.tipY - (w.length / 2) * Math.sin(D2R(pose.pitch));
        let y = lerp(upright, surfaceY(w, 0.6), pose.float);
        y -= pose.dive * 10;
        // 横になってからは、ゆっくり前へ進む(秒速0.2mくらい)
        const along = Math.max(0, t - (F.fall + 8)) * 0.2 + pose.dive * 8;
        w.group.position.set(c[0] + f[0] * along, y, c[1] + f[2] * along);
        w.group.rotation.set(D2R(pitch), D2R(yaw), D2R(3 * Math.sin(t * 0.4) * pose.float));
      },
      cues,
    };
  },

  // バブルネット(群れの捕食): 大きな泡の輪がシュワシュワとでき、そのまん中から群れがいっしょに
  // 口を開けて飛び出す。小魚が跳ねる。そのあと水面で何回か潮を吹き、尾びれを上げて1頭ずつ潜っていく
  bubbleNet({ start, yaw }) {
    const F = FEEDING, B = BUBBLE_NET;
    const c = [start[0], start[2]];
    const group = bubbleNetGroup();
    const cues = [];
    const N = 40;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2 * 1.1 + yaw * 0.017;
      const r = B.ringRadius * (1.15 - 0.15 * (k / N));
      const at = F.ringStart + (k / N) * (F.ringEnd - F.ringStart);
      const p = [c[0] + Math.cos(a) * r, 0, c[1] + Math.sin(a) * r];
      cues.push({ at, run: fx => { fx.effects.foam(p, (F.surface + 10 - at) * 1000, { radius: 1.4, count: 50 }); fx.effects.bubbles(p, 8); } });
      // 輪ができたあとも、しばらく泡がはじけつづける
      cues.push({ at: at + 2.5, run: fx => fx.effects.bubbles(p, 5) });
    }
    cues.push({ at: 0.5, run: fx => fx.playSound('bubbles', { gain: 0.8, maxMs: 10000, position: [c[0], 0, c[1]] }) });
    cues.push({ at: F.call, run: fx => fx.playSound('humpback-call', { gain: 0.8, maxMs: 6000, position: [c[0], -6, c[1]] }) });
    cues.push({
      at: F.surface - 0.6,
      run: fx => {
        fx.effects.leap([c[0], 0, c[1]], 60, B.ringRadius * 0.7);
        fx.effects.splash([c[0], 0, c[1]], 'small', forward(yaw));
        fx.effects.foam([c[0], 0, c[1]], 18000);
      },
    });
    cues.push({ at: F.surface, run: fx => fx.playSound('splash', { gain: 0.9, position: [c[0], 0, c[1]] }) });
    group.forEach((g, i) => {
      const p = () => [c[0] + g.offset[0], 0, c[1] + g.offset[1]];
      cues.push({ at: F.surface + g.delay, run: fx => { fx.effects.splash(p(), 'small', forward(yaw)); fx.effects.leap(p(), 12, 2.5);
        fx.playSound('splash', { gain: 0.45, position: p() }); } });
      // 開いた口から、水があふれ落ちる
      for (let t = F.surface + 0.5; t < F.closed; t += 0.4) {
        cues.push({ at: t + g.delay, run: (fx, ws) => fx.effects.cascade(bodyPoint(ws[i], 0.42, -1.2), 3) });
      }
      for (const b of g.blows) cues.push({ at: b, run: (fx, ws) => blow(fx, ws[i]) });
      cues.push({ at: g.dive + 4, run: (fx, ws) => fx.sighted?.(ws[i]) });
      cues.push({ at: g.dive + 6.5, run: (fx, ws) => fx.effects.splash(onWater(bodyPoint(ws[i], -0.5)), 'small', headingOf(ws[i])) });
      cues.push({ at: g.dive + 10, run: (fx, ws) => fx.footprint?.(bodyPoint(ws[i], -0.5), headingYaw(ws[i])) });
    });
    // 群れはみんな同じほうを向いて浮かび、潜るときはカメラから遠ざかる向き(尾びれの裏が見える)
    const diveYaw = divingYaw(Math.random);
    return {
      whales: group.map(g => ({ kind: 'humpback', scale: g.scale })),
      each(ws, t) {
        ws.forEach((w, i) => {
          const g = group[i];
          const pose = feedingPose(t - g.delay);
          // 群れのときは、こし出しを短くする
          const pouch = t < F.filterStart ? pose.pouch : pose.pouch * (1 - ease((t - F.filterStart) / (B.filterEnd - F.filterStart)));
          w.mixer.setJaw(pose.gape * F.lowerJaw, pose.gape * F.upperJaw, pouch);
          const round = ease((t - (g.dive - 3)) / 3);
          const dive = ease((t - g.dive) / 7);
          w.mixer.setSwim(t < F.fall + 6 ? 1 : 0.3 + 0.7 * dive);
          // 立って飛び出す → 沈んで横になる → 水面に浮かぶ → 背中を丸めて尾びれを上げて潜る
          const upright = pose.tipY - (w.length / 2) * Math.sin(D2R(pose.pitch));
          let y = lerp(upright, surfaceY(w, 0.6), pose.float) + 0.5 * round * (1 - dive) - dive * 3 - ease((t - (g.dive + 7.5)) / 5) * 14;
          const turn = ease((t - (F.fall + 8)) / 10);
          const yawNow = lerp(yaw + i * 25, diveYaw, turn);
          const pitch = pose.pitch - 14 * round * (1 - dive) + lerp(0, -80, dive);
          const f = forward(yawNow);
          const along = Math.max(0, t - (F.fall + 8)) * 0.15 + dive * 6;
          w.group.position.set(c[0] + g.offset[0] * (1 + 0.3 * turn) + f[0] * along, y, c[1] + g.offset[1] * (1 + 0.3 * turn) + f[2] * along);
          w.group.rotation.set(D2R(pitch), D2R(yawNow), 0);
        });
      },
      cues,
    };
  },

  // 目が合う: 間近のカメラのすぐ前で、体を立てて頭を出し(スパイホップ)、片目でこちらをじっと見る。
  // ゆっくり上がってきて、少しずつ寄り、目が画面の半分以上になる近さ(約17cm)で20秒ほど止まる。
  // まばたきをして、目の玉も少し動く。最後はゆっくり離れて沈んでいく
  eyeContact() {
    const near = CAMERA_PRESETS.near;
    const cam = new THREE.Vector3(...near.position);
    const dir = new THREE.Vector3(...near.target).sub(cam).normalize();
    const eyeAt = d => cam.clone().addScaledVector(dir, d);
    const far = 1.4;   // 上がってくるときの、カメラから目までの距離(m)
    const pitch = 78;  // 体の立ち方(90で真上)
    const local = eyeFrame(1);
    let yaw = null;
    return {
      whales: [{ kind: 'humpback', swim: 0 }],
      each([w], t, D) {
        const eyeLocal = new THREE.Vector3(...local.center).multiplyScalar(w.length);
        if (yaw === null) {
          // 右目がカメラのほうを向く向きを探す
          const n = new THREE.Vector3(...local.normal);
          let best = -2;
          for (let a = 0; a < 360; a += 1) {
            w.group.rotation.set(D2R(pitch), D2R(a), 0);
            w.group.updateMatrixWorld();
            const score = n.clone().applyQuaternion(w.group.quaternion).dot(dir.clone().negate());
            if (score > best) { best = score; yaw = a; }
          }
          w.mixer.eyes.alive = true;
        }
        const rise = ease(t / 10) - ease((t - (D - 5)) / 5);
        const close = ease((t - 10) / 6) - ease((t - 36) / 5);
        const target = eyeAt(lerp(far, EYE.contactDistance, close));
        target.y = lerp(-3.5, target.y, rise) + 0.015 * Math.sin(t * 0.9) * close;
        // 見つめている間は目を大きく開き、離れるときはふだんの開きにもどす
        w.mixer.eyes.setBaseOpen(lerp(EYE.relaxedOpen, 1, ease((t - 15) / 3) - ease((t - 35) / 3)));
        const sway = 2 * Math.sin(t * 0.3) * (1 - close * 0.7);
        w.group.rotation.set(D2R(pitch), D2R(yaw + sway), 0);
        w.group.position.set(0, 0, 0);
        w.group.updateMatrixWorld();
        const eyeWorld = w.group.localToWorld(eyeLocal.clone());
        w.group.position.copy(target.sub(eyeWorld));
      },
      cues: [
        { at: 2, run: (fx, [w]) => fx.effects.foam(onWater(bodyPoint(w, 0)), 8000) },
        // 見つめながら、低く小さく鳴く
        { at: 22, run: (fx, [w]) => fx.playSound('humpback-call', { gain: 0.5, maxMs: 8000, position: bodyPoint(w, 0.2) }) },
        { at: 42, run: (fx, [w]) => fx.effects.foam(onWater(bodyPoint(w, 0)), 6000) },
      ],
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
    // 捕食は、斜め前を向けて飛び出す(開いた口の中と、ふくらんだのどの両方が見える)
    const yaw = name === 'fluke' || name === 'lobtail' ? divingYaw(Math.random)
      : name === 'feeding' || name === 'bubbleNet' ? (Math.random() < 0.5 ? 135 : -135) + (Math.random() * 20 - 10)
      // 群れで泳ぐのは、ななめ奥へ(体の横も、潜るときの尾びれの裏も見える)
      : name === 'pod' ? (Math.random() < 0.5 ? 40 : -40) + (Math.random() * 20 - 10)
      : crossingYaw();
    const back = (SWIM_SPEED[name] ?? 0) * (durationMs / 1000) / 2;
    const f = forward(yaw);
    const start = [position[0] - f[0] * back, 0, position[2] - f[2] * back];
    const motion = MOTIONS[name]({ start, yaw });
    const act = {
      whales: (() => {
        // おとなのザトウクジラには、この海に来るクジラのだれかを割りあてる(同じ出方の中では重ならない)
        const taken = [];
        return motion.whales.map(w => {
          let ind = null;
          if (w.kind === 'humpback' && (w.scale ?? 1) >= 0.8 && fx.visitor) {
            const id = fx.visitor(taken);
            taken.push(id);
            ind = individualById(id);
          }
          return makeWhale(w.kind, w.scale, w.swim, ind);
        });
      })(),
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

  // いま camera に写っている、名前のあるクジラの番号(写真に使う)。
  // 体の点のどれかが、水面より上か水面のすぐ下にあって、画面の中に入っていれば「写っている」
  const frustum = new THREE.Frustum(), m = new THREE.Matrix4();
  function visibleIndividuals(camera) {
    camera.updateMatrixWorld();
    m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(m);
    const ids = [];
    for (const act of acts) {
      for (const w of act.whales) {
        if (!w.individual || ids.includes(w.individual.id)) continue;
        const seen = [0.5, 0.3, 0, -0.25, -0.5].some(along => {
          const p = new THREE.Vector3(...bodyPoint(w, along));
          return p.y > -0.4 && frustum.containsPoint(p);
        });
        if (seen) ids.push(w.individual.id);
      }
    }
    return ids;
  }

  return { models, play, update, visibleIndividuals };
}
