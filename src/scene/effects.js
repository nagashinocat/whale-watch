import * as THREE from 'three';
import { BLOW, BLOW_EXHALE, blowDirection, blowSpeed } from '../logic/behavior.js';
import { splashParticles, entrySpray, PARTICLE } from '../logic/splash.js';
import { bubbleBurst, popJet, foamRadius, foamAlpha } from '../logic/bubbles.js';

const MAX = 24000; // スマホで重くならないよう、全体の粒子数に上限をかける
// 粒がカメラからこの距離(m)より近いと薄くなり、いちばん近いところで見えなくなる
export const NEAR_FADE = Object.freeze([2, 7]);
// 粒の画面上の大きさの上限(画素)
export const MAX_POINT_PX = 140;
// 出てすぐの粒は、この秒数で濃くなる(大きな粒がいっせいにパッと出ると、光ったように見える)
const FADE_IN = 0.06;

// 粒の描き方は種類ごとにちがう(PARTICLE)。
//   水滴: 小さくくっきりした粒で、光るつやがある。速く飛ぶ粒は、動く向きに細長い筋になる
//   水の膜: すけた白で、ふちがちぎれてぎざぎざ / 霧: ぼんやりうすい
//   泡: 海面の白い泡。レースのような穴あきの模様で、時間がたつと穴が広がってとけるように消える
const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aKind;
  attribute float aAge;
  attribute vec3 aVel;
  uniform vec2 uView;
  varying float vAlpha;
  varying float vKind;
  varying float vAge;
  varying float vSeed;
  varying vec2 vDir;
  varying float vStretch;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = -mv.z;
    // カメラのすぐ近くを通る粒は、画面いっぱいの大きな白い丸になって一瞬だけ映る(チカチカの原因)。
    // 近い粒ほど薄くして、大きさにも上限をつける
    vAlpha = aAlpha * smoothstep(${NEAR_FADE[0].toFixed(1)}, ${NEAR_FADE[1].toFixed(1)}, dist);
    float px = aSize * (300.0 / max(dist, 0.1));
    // 画面の上での動きの向きと、筋ののび(0.05秒に動く長さ)
    vec4 a = projectionMatrix * mv;
    vec4 b = projectionMatrix * (modelViewMatrix * vec4(position + aVel * 0.05, 1.0));
    vec2 d = (b.xy / b.w - a.xy / a.w) * 0.5 * uView;
    float len = length(d);
    vDir = len > 1e-3 ? d / len : vec2(0.0, 1.0);
    vStretch = aKind < 0.5 ? clamp(len / max(px, 1.0), 0.0, 3.0) : 0.0;
    gl_PointSize = min(px * (1.0 + vStretch), ${MAX_POINT_PX.toFixed(1)});
    gl_Position = a;
    vKind = aKind; vAge = aAge;
    vSeed = fract(sin(float(gl_VertexID) * 12.9898) * 43758.5453);
  }`;

const fragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vKind;
  varying float vAge;
  varying float vSeed;
  varying vec2 vDir;
  varying float vStretch;
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    q.y = -q.y;
    float a;
    vec3 col = uColor;
    if (vKind < 0.5) {
      // 水滴: 動く向きにのびた、くっきりした粒。左上につや
      vec2 along = vDir, side = vec2(-vDir.y, vDir.x);
      float k = 1.0 + vStretch;
      vec2 e = vec2(dot(q, side) * k, dot(q, along));
      float d = length(e) * 2.0;
      a = 1.0 - smoothstep(0.55, 0.95, d);
      float glint = 1.0 - smoothstep(0.0, 0.35, length(e - vec2(-0.12, 0.12) / k));
      col = mix(col * vec3(0.82, 0.9, 0.98), col * 1.25, glint);
    } else if (vKind < 1.5) {
      // 水の膜: 飛ぶ向きにのびた細い水の筋(ちぎれかけの膜)が、すけて重なる
      vec2 along = vDir, side = vec2(-vDir.y, vDir.x);
      vec2 e = vec2(dot(q, side), dot(q, along));
      float d = length(e * vec2(1.0, 0.7)) * 2.0;
      float strands = n2(vec2(e.x * 18.0 + vSeed * 13.0, e.y * 3.0));
      float edge = n2(q * 6.0 + vSeed * 17.0);
      a = (1.0 - smoothstep(0.35 + 0.35 * edge, 1.0, d)) * smoothstep(0.35, 0.75, strands);
      col *= vec3(0.9, 0.95, 1.0) * (0.85 + 0.3 * strands);
    } else if (vKind < 2.5) {
      // 霧
      float d = length(q) * 2.0;
      a = exp(-d * d * 3.0) * 0.8;
    } else {
      // 泡: レースのような穴あきの模様。年をとるほど穴が広がって、とけて消える
      float d = length(q) * 2.0;
      float lace = n2(q * 9.0 + vSeed * 31.0) * 0.6 + n2(q * 23.0 + vSeed * 7.0) * 0.4;
      float hole = mix(0.25, 0.85, vAge);
      a = smoothstep(hole, hole + 0.12, lace) * (1.0 - smoothstep(0.6, 1.0, d));
    }
    a *= vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// 潮吹き・水しぶき・泡。すべて粒子を使い回して描く。
export function createEffects(scene) {
  const pos = new Float32Array(MAX * 3);
  const size = new Float32Array(MAX);
  const alpha = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);      // 残り時間(秒)。0以下なら空き
  const maxLife = new Float32Array(MAX);
  const baseSize = new Float32Array(MAX);
  const baseAlpha = new Float32Array(MAX);
  const gravity = new Float32Array(MAX);
  const wind = new Float32Array(MAX);
  const grow = new Float32Array(MAX);
  const floor = new Uint8Array(MAX);       // 1なら海面より下で消す
  const wait = new Float32Array(MAX);      // 出るまでの秒(水しぶきは順番に出る)
  const drag = new Float32Array(MAX);      // 空気や水で横の動きがおそくなる割合(1秒あたり)
  const kind = new Float32Array(MAX);      // 粒の種類(PARTICLE)
  const age = new Float32Array(MAX);       // 0 生まれたて 〜 1 消える前(泡のとけぐあい)

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aKind', new THREE.BufferAttribute(kind, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAge', new THREE.BufferAttribute(age, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aVel', new THREE.BufferAttribute(vel, 3).setUsage(THREE.DynamicDrawUsage));

  const material = new THREE.ShaderMaterial({
    // 水は太陽や月の光の色に染まる(setLight で変える)
    uniforms: { uColor: { value: new THREE.Color(1.5, 1.5, 1.5) }, uView: { value: new THREE.Vector2(800, 600) } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;
  let alive = 0;
  // 水の中を上がっている泡(水面に着くまで待つ)。{ at: 着くまでの秒, x, z, r }
  let rising = [];
  let clock = 0;

  // 空いている粒を使う。全部使っているときは、新しい粒を出さない
  // (まだ飛んでいる粒を使い回すと、その粒が急に消えて、チカチカして見える)
  function emit(p, v, opts) {
    if (alive >= MAX) return;
    let i = cursor;
    while (life[i] > 0) i = (i + 1) % MAX;
    cursor = (i + 1) % MAX;
    alive++;
    pos.set(p, i * 3);
    vel.set(v, i * 3);
    life[i] = maxLife[i] = opts.life;
    baseSize[i] = opts.size;
    baseAlpha[i] = opts.alpha ?? 0.9;
    gravity[i] = opts.gravity ?? 9.8;
    wind[i] = opts.wind ?? 0;
    grow[i] = opts.grow ?? 1;
    floor[i] = opts.floor ?? 1;
    wait[i] = opts.delay ?? 0;
    drag[i] = opts.drag ?? 0.6;
    kind[i] = opts.kind ?? PARTICLE.mist;
    age[i] = 0;
    // 水滴は小さく、水の膜はすけるように(大きな白いかたまりに見えないように)
    if (kind[i] === PARTICLE.drop) baseSize[i] *= 0.4;
    else if (kind[i] === PARTICLE.sheet) { baseSize[i] *= 0.75; baseAlpha[i] *= 0.5; }
    else if (kind[i] === PARTICLE.mist) baseAlpha[i] *= 0.7;
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  const api = {
    // 上に6〜9mほど噴き上がり、風に流れて3秒で消える霧
    // 潮吹き。ザトウクジラはまっすぐ上へ、もこもこと3〜5m。マッコウクジラは左前へ45度かたむく。
    // forward はクジラが向いている水平の向き
    // scale: 潮吹きの大きさ(子クジラは小さい)。高さは scale 倍になる
    spout(position, { kind = 'humpback', forward = [0, 0, -1], scale = 1 } = {}) {
      const [x, y, z] = position;
      const b = BLOW[kind];
      const dir = blowDirection(kind, forward);
      const speed = blowSpeed(kind) * Math.sqrt(scale);
      // ザトウクジラは鼻の穴が2つ並んでいるので、左右2か所から噴き出す(遠くからはひとつのもこもこに見える)
      const len = Math.hypot(forward[0], forward[2]) || 1;
      const right = [-forward[2] / len, 0, forward[0] / len];
      const nozzles = kind === 'humpback' ? [-1, 1] : [0];
      const apart = 0.2 * Math.sqrt(scale);
      const n = Math.round(300 * Math.min(1, scale + 0.2));
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * b.spread * Math.sqrt(scale);
        const side = nozzles[k % nozzles.length] * apart;
        // 息は一気に吐き出し(約1秒)、はじめがいちばん強い。あとから出る粒ほど低い
        const when = BLOW_EXHALE * Math.random() ** 2;
        const strength = 1 - 0.35 * (when / BLOW_EXHALE);
        // 速さを少しずつばらつかせて、上まで届く粒と途中で広がる粒をまぜる(もこもこした形になる)
        const s = speed * rand(0.75, 1.0) * strength;
        emit([x + right[0] * side + Math.cos(a) * 0.2, y + 0.3, z + right[2] * side + Math.sin(a) * 0.2],
          [dir[0] * s + Math.cos(a) * r + right[0] * side * 0.6, dir[1] * s, dir[2] * s + Math.sin(a) * r + right[2] * side * 0.6],
          { life: rand(2.4, 3.4), size: rand(1.0, 1.8), alpha: 0.5, gravity: b.gravity, wind: 1.2, grow: 2.8, delay: when, kind: PARTICLE.mist });
      }
    },

    // 水しぶき。small は尾びれ、large はジャンプの着水。
    // 王冠のような水の膜が持ち上がり、ちぎれて水滴になって落ち、細かいしぶきがただよう。
    // heading はクジラの体の向き(着水したクジラの体に沿って細長くなる)
    splash(position, kind = 'small', heading = [1, 0, 0]) {
      for (const q of splashParticles(kind, position, heading)) emit(q.p, q.v, q);
    },

    // 体の一部が水面を割って飛びこむときのしぶき(1こまぶん)。速さから計算する(entrySpray)。
    // 入ったところには、白い泡も少し残る
    spray(point, velocity, dt) {
      const list = entrySpray(point, velocity, dt);
      for (const q of list) emit(q.p, q.v, q);
      if (list.length > 6) this.foam(point, 5000, { radius: 1.2 + list.length * 0.04, count: Math.round(list.length * 0.8) });
    },

    // 画面の大きさ(画素)。水滴の筋の長さを計算するのに使う
    setViewSize(w, h) { material.uniforms.uView.value.set(w, h); },

    // 体から流れ落ちる水。水から上がってきた背中やひれの点から、細い滝のように落ちる。
    // velocity: 体のその場所の動き(m/秒)。はがれた水ははじめ体といっしょに動き、それから落ちる
    // (勢いよく飛び出すジャンプでは、水が体に引っぱられて上へ流れ、うしろに長く尾を引く)
    cascade(point, n = 3, velocity = [0, 0, 0]) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, r = rand(0.15, 0.7);
        const keep = rand(0.55, 0.95);
        emit([point[0] + rand(-0.3, 0.3), point[1] + rand(-0.15, 0.1), point[2] + rand(-0.3, 0.3)],
          [Math.cos(a) * r + velocity[0] * keep, rand(-0.6, 0.4) + velocity[1] * keep, Math.sin(a) * r + velocity[2] * keep],
          { life: rand(1.2, 2.0), size: rand(0.2, 0.45), alpha: 0.85, gravity: 9.8, grow: 1.1, kind: PARTICLE.drop });
      }
    },

    // 落ちたところから広がる波の輪。白い泡の輪が、波の速さで外へ広がりながら薄くなる。
    // length・width: 最初の輪の大きさ(m、体の向きに細長い) / speed: 波の速さ(m/秒)
    waveRing(position, { length = 10, width = 6, speed = 3, heading = [1, 0, 0], count = 360, life = 6 } = {}) {
      const hl = Math.hypot(heading[0], heading[2]) || 1;
      const fx = heading[0] / hl, fz = heading[2] / hl, sx = -fz, sz = fx;
      // 輪の粒が重なって真っ白な板に見えないよう、重なるぶんだけ1粒をうすくする(輪の太さは1.5mくらい)
      const around = Math.PI * (length + width) / 2;
      const a0 = Math.min(0.42, 2.5 / ((count * 1.6) / (around * 1.5)));
      for (let k = 0; k < count; k++) {
        const a = Math.random() * Math.PI * 2;
        const lx = Math.cos(a) * length / 2, lz = Math.sin(a) * width / 2;
        const ox = Math.cos(a) * width, oz = Math.sin(a) * length;   // 輪のふちに直角の向き
        const ol = Math.hypot(ox, oz) || 1;
        const dx = (fx * ox + sx * oz) / ol, dz = (fz * ox + sz * oz) / ol;
        const sp = speed * rand(0.9, 1.1);
        emit([position[0] + fx * lx + sx * lz, 0.2, position[2] + fz * lx + sz * lz], [dx * sp, 0, dz * sp],
          { life: life * rand(0.8, 1), size: rand(0.9, 1.6), alpha: a0, gravity: 0, floor: 0, grow: 1.6, drag: 0.08, delay: rand(0.2, 0.6), kind: PARTICLE.foam });
      }
    },

    // 泡の輪: 水の中で吹いたドーナツ形の泡が水面に浮かび、白い輪になって、ゆっくり広がる
    bubbleRing(center, { radius = 0.7, count = 150, speed = 0.5, life = 4.5 } = {}) {
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + rand(-0.02, 0.02);
        const r = radius * rand(0.92, 1.08);
        emit([center[0] + Math.cos(a) * r, 0.06, center[2] + Math.sin(a) * r], [Math.cos(a) * speed * rand(0.85, 1.15), rand(0, 0.12), Math.sin(a) * speed * rand(0.85, 1.15)],
          { life: life * rand(0.8, 1), size: rand(0.16, 0.32), alpha: 0.85, gravity: 0, floor: 0, grow: 1.35, drag: 0.22, delay: rand(0, 0.15), kind: PARTICLE.foam });
      }
      this.bubbleBurst(center, { depth: 3, count: 25, radius: radius * 0.6 });
    },

    // 泡が水面ではじける小さなしぶき(泡の網)
    bubbles(point, n = 6) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        emit([point[0] + rand(-0.8, 0.8), 0.05, point[2] + rand(-0.8, 0.8)],
          [Math.cos(a) * 0.3, rand(0.8, 2.0), Math.sin(a) * 0.3],
          { life: rand(0.5, 0.9), size: rand(0.12, 0.25), alpha: 0.8, gravity: 9.8, grow: 1.1, kind: PARTICLE.drop });
      }
    },

    // 追いつめられた小魚が、水面からあちこちへ跳ねる(小さくきらっと光る粒)
    leap(point, n = 20, radius = 4) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
        const out = rand(1.5, 3.5);
        emit([point[0] + Math.cos(a) * r, 0.1, point[2] + Math.sin(a) * r],
          [Math.cos(a) * out, rand(2.5, 4.5), Math.sin(a) * out],
          { life: rand(0.8, 1.1), size: rand(0.1, 0.18), alpha: 1, gravity: 9.8, grow: 1, delay: rand(0, 1.5), kind: PARTICLE.drop });
      }
    },

    // 太陽や月の光の色に合わせる(夕方は金色、夜は青白く暗く)
    setLight(hex) {
      material.uniforms.uColor.value.set(hex).multiplyScalar(1.5);
    },

    // 海面に白い泡を円状に広げ、durationMs かけて薄くする
    // radius: 泡の広がり(m)、count: 粒の数。泡の輪は、小さな泡のかたまりをたくさん並べて作る
    // ring: 泡がふちに寄るぐあい(大きなものが落ちたところは、まん中の水が外へ押しやられて輪になる)
    // 粒をたくさん重ねても真っ白にならないよう、重なるぶんだけ1粒をうすくする(foamAlpha)
    foam(position, durationMs = 8000, { radius = 6, count = 400, ring = radius > 3 ? 0.6 : 0.15 } = {}) {
      const [x, , z] = position;
      const a0 = foamAlpha(count, radius, 1.4);
      for (let k = 0; k < count; k++) {
        const a = Math.random() * Math.PI * 2, r = foamRadius(Math.random(), ring) * radius;
        emit([x + Math.cos(a) * r, 0.25, z + Math.sin(a) * r],
          [Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35],
          { life: (durationMs / 1000) * rand(0.7, 1), size: rand(1, 1.8), alpha: a0, gravity: 0, floor: 0, grow: 1.3, kind: PARTICLE.foam });
      }
    },

    // 水の中で吹いた泡。浮かび上がる速さを泡の大きさから計算し(bubbleBurst)、水面に着いた泡から順にはじける。
    // 大きい泡が先にボコッと、小さい泡があとからシュワシュワと着く。depth: 吹いた深さ(m)
    bubbleBurst(center, { depth = 8, count = 40, radius = 0.6 } = {}) {
      for (const b of bubbleBurst(center, { depth, count, radius })) rising.push({ ...b, at: b.at + clock });
      rising.sort((p, q) => p.at - q.at);
    },

    // 泡が水面ではじける: はじけた穴のまん中から細い水滴が飛び、小さな白い泡のあとが残る
    pop(b) {
      const { n, speed } = popJet(b.r);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, side = rand(0.05, 0.25) * speed;
        emit([b.x, 0.04, b.z], [Math.cos(a) * side, speed * rand(0.6, 1), Math.sin(a) * side],
          { life: rand(0.3, 0.7), size: rand(0.08, 0.14) + b.r * 2, alpha: 0.8, gravity: 9.8, grow: 1, kind: PARTICLE.drop });
      }
      emit([b.x, 0.08, b.z], [0, 0, 0], { life: rand(2.5, 4.5), size: 0.25 + b.r * 18, alpha: 0.55, gravity: 0, floor: 0, grow: 1.6, drag: 0.5, kind: PARTICLE.foam });
    },

    update(dt) {
      if (dt <= 0) return;
      clock += dt;
      let k = 0;
      while (k < rising.length && rising[k].at <= clock) api.pop(rising[k++]);
      if (k) rising = rising.slice(k);
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) { alpha[i] = 0; continue; }
        if (wait[i] > 0) { wait[i] -= dt; alpha[i] = 0; continue; }
        life[i] -= dt;
        if (life[i] <= 0) { alive--; alpha[i] = 0; continue; }
        const j = i * 3;
        vel[j + 1] -= gravity[i] * dt;
        vel[j] += wind[i] * dt;
        const slow = Math.max(0, 1 - drag[i] * dt);
        vel[j] *= slow; vel[j + 2] *= slow;
        pos[j] += vel[j] * dt;
        pos[j + 1] += vel[j + 1] * dt;
        pos[j + 2] += vel[j + 2] * dt;
        if (floor[i] && pos[j + 1] < 0 && vel[j + 1] < 0) { life[i] = 0; alive--; alpha[i] = 0; continue; }
        const t = Math.max(0, life[i] / maxLife[i]); // 1 → 0
        size[i] = baseSize[i] * (1 + (grow[i] - 1) * (1 - t));
        // 出てすぐは少しずつ濃く、終わりは薄く。水に落ちていく粒は、水面に近づくほど薄くなって消える
        const ageS = maxLife[i] - life[i];
        const sink = floor[i] && vel[j + 1] < 0 ? Math.min(1, Math.max(0, pos[j + 1] / 0.8)) : 1;
        alpha[i] = baseAlpha[i] * Math.min(1, t * 2.5) * Math.min(1, ageS / FADE_IN) * sink;
        age[i] = 1 - t;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;
      geometry.attributes.aAge.needsUpdate = true;
      geometry.attributes.aKind.needsUpdate = true;
      geometry.attributes.aVel.needsUpdate = true;
    },
  };
  return api;
}
