import * as THREE from 'three';
import { BLOW, BLOW_EXHALE, blowDirection, blowSpeed } from '../logic/behavior.js';
import { splashParticles } from '../logic/splash.js';

const MAX = 20000; // スマホで重くならないよう、全体の粒子数に上限をかける
// 粒がカメラからこの距離(m)より近いと薄くなり、いちばん近いところで見えなくなる
export const NEAR_FADE = Object.freeze([2, 7]);
// 粒の画面上の大きさの上限(画素)
export const MAX_POINT_PX = 140;
// 出てすぐの粒は、この秒数で濃くなる(大きな粒がいっせいにパッと出ると、光ったように見える)
const FADE_IN = 0.06;

const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = -mv.z;
    // カメラのすぐ近くを通る粒は、画面いっぱいの大きな白い丸になって一瞬だけ映る(チカチカの原因)。
    // 近い粒ほど薄くして、大きさにも上限をつける
    vAlpha = aAlpha * smoothstep(${NEAR_FADE[0].toFixed(1)}, ${NEAR_FADE[1].toFixed(1)}, dist);
    gl_PointSize = min(aSize * (300.0 / max(dist, 0.1)), ${MAX_POINT_PX.toFixed(1)});
    gl_Position = projectionMatrix * mv;
  }`;

const fragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));

  const material = new THREE.ShaderMaterial({
    // 水は太陽や月の光の色に染まる(setLight で変える)
    uniforms: { uColor: { value: new THREE.Color(1.5, 1.5, 1.5) } },
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
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  return {
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
          { life: rand(2.4, 3.4), size: rand(1.0, 1.8), alpha: 0.5, gravity: b.gravity, wind: 1.2, grow: 2.8, delay: when });
      }
    },

    // 水しぶき。small は尾びれ、large はジャンプの着水。
    // 王冠のような水の膜が持ち上がり、ちぎれて水滴になって落ち、細かいしぶきがただよう。
    // heading はクジラの体の向き(着水したクジラの体に沿って細長くなる)
    splash(position, kind = 'small', heading = [1, 0, 0]) {
      for (const q of splashParticles(kind, position, heading)) emit(q.p, q.v, q);
    },

    // 体から流れ落ちる水。水から上がってきた背中やひれの点から、細い滝のように落ちる。
    // velocity: 体のその場所の動き(m/秒)。はがれた水ははじめ体といっしょに動き、それから落ちる
    // (勢いよく飛び出すジャンプでは、水が体に引っぱられて上へ流れ、うしろに長く尾を引く)
    cascade(point, n = 3, velocity = [0, 0, 0]) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, r = rand(0.15, 0.7);
        const keep = rand(0.55, 0.95);
        emit([point[0] + rand(-0.3, 0.3), point[1] + rand(-0.15, 0.1), point[2] + rand(-0.3, 0.3)],
          [Math.cos(a) * r + velocity[0] * keep, rand(-0.6, 0.4) + velocity[1] * keep, Math.sin(a) * r + velocity[2] * keep],
          { life: rand(1.2, 2.0), size: rand(0.3, 0.6), alpha: 0.75, gravity: 9.8, grow: 1.4 });
      }
    },

    // 落ちたところから広がる波の輪。白い泡の輪が、波の速さで外へ広がりながら薄くなる。
    // length・width: 最初の輪の大きさ(m、体の向きに細長い) / speed: 波の速さ(m/秒)
    waveRing(position, { length = 10, width = 6, speed = 3, heading = [1, 0, 0], count = 360, life = 6 } = {}) {
      const hl = Math.hypot(heading[0], heading[2]) || 1;
      const fx = heading[0] / hl, fz = heading[2] / hl, sx = -fz, sz = fx;
      for (let k = 0; k < count; k++) {
        const a = Math.random() * Math.PI * 2;
        const lx = Math.cos(a) * length / 2, lz = Math.sin(a) * width / 2;
        const ox = Math.cos(a) * width, oz = Math.sin(a) * length;   // 輪のふちに直角の向き
        const ol = Math.hypot(ox, oz) || 1;
        const dx = (fx * ox + sx * oz) / ol, dz = (fz * ox + sz * oz) / ol;
        const sp = speed * rand(0.9, 1.1);
        emit([position[0] + fx * lx + sx * lz, 0.2, position[2] + fz * lx + sz * lz], [dx * sp, 0, dz * sp],
          { life: life * rand(0.8, 1), size: rand(0.9, 1.6), alpha: 0.32, gravity: 0, floor: 0, grow: 1.6, drag: 0.08, delay: rand(0.2, 0.6) });
      }
    },

    // 泡が水面ではじける小さなしぶき(泡の網)
    bubbles(point, n = 6) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        emit([point[0] + rand(-0.8, 0.8), 0.05, point[2] + rand(-0.8, 0.8)],
          [Math.cos(a) * 0.3, rand(0.8, 2.0), Math.sin(a) * 0.3],
          { life: rand(0.5, 0.9), size: rand(0.12, 0.25), alpha: 0.8, gravity: 9.8, grow: 1.1 });
      }
    },

    // 追いつめられた小魚が、水面からあちこちへ跳ねる(小さくきらっと光る粒)
    leap(point, n = 20, radius = 4) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
        const out = rand(1.5, 3.5);
        emit([point[0] + Math.cos(a) * r, 0.1, point[2] + Math.sin(a) * r],
          [Math.cos(a) * out, rand(2.5, 4.5), Math.sin(a) * out],
          { life: rand(0.8, 1.1), size: rand(0.1, 0.18), alpha: 1, gravity: 9.8, grow: 1, delay: rand(0, 1.5) });
      }
    },

    // 太陽や月の光の色に合わせる(夕方は金色、夜は青白く暗く)
    setLight(hex) {
      material.uniforms.uColor.value.set(hex).multiplyScalar(1.5);
    },

    // 海面に白い泡を円状に広げ、durationMs かけて薄くする
    // radius: 泡の広がり(m)、count: 粒の数。泡の輪は、小さな泡のかたまりをたくさん並べて作る
    foam(position, durationMs = 8000, { radius = 6, count = 400 } = {}) {
      const [x, , z] = position;
      for (let k = 0; k < count; k++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
        emit([x + Math.cos(a) * r, 0.25, z + Math.sin(a) * r],
          [Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35],
          { life: (durationMs / 1000) * rand(0.7, 1), size: rand(1, 1.8), alpha: 0.5, gravity: 0, floor: 0, grow: 1.3 });
      }
    },

    update(dt) {
      if (dt <= 0) return;
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
        const age = maxLife[i] - life[i];
        const sink = floor[i] && vel[j + 1] < 0 ? Math.min(1, Math.max(0, pos[j + 1] / 0.8)) : 1;
        alpha[i] = baseAlpha[i] * Math.min(1, t * 2.5) * Math.min(1, age / FADE_IN) * sink;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;
    },
  };
}
