import * as THREE from 'three';
import { BLOW, blowDirection, blowSpeed } from '../logic/behavior.js';
import { splashParticles } from '../logic/splash.js';

const MAX = 6000; // スマホで重くならないよう、全体の粒子数に上限をかける

const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z);
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

  function emit(p, v, opts) {
    const i = cursor;
    cursor = (cursor + 1) % MAX; // 空きがなければ古い粒子から使い回す
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
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  return {
    // 上に6〜9mほど噴き上がり、風に流れて3秒で消える霧
    // 潮吹き。ザトウクジラはまっすぐ上へ、もこもこと3〜5m。マッコウクジラは左前へ45度かたむく。
    // forward はクジラが向いている水平の向き
    spout(position, { kind = 'humpback', forward = [0, 0, -1] } = {}) {
      const [x, y, z] = position;
      const b = BLOW[kind];
      const dir = blowDirection(kind, forward);
      const speed = blowSpeed(kind);
      for (let k = 0; k < 300; k++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * b.spread;
        // 速さを少しずつばらつかせて、上まで届く粒と途中で広がる粒をまぜる(もこもこした形になる)
        const s = speed * rand(0.75, 1.0);
        emit([x + Math.cos(a) * 0.3, y + 0.3, z + Math.sin(a) * 0.3],
          [dir[0] * s + Math.cos(a) * r, dir[1] * s, dir[2] * s + Math.sin(a) * r],
          { life: rand(2.4, 3.4), size: rand(1.0, 1.8), alpha: 0.5, gravity: b.gravity, wind: 1.2, grow: 2.8 });
      }
    },

    // 水しぶき。small は尾びれ、large はジャンプの着水。
    // 王冠のような水の膜が持ち上がり、ちぎれて水滴になって落ち、細かいしぶきがただよう。
    // heading はクジラの体の向き(着水したクジラの体に沿って細長くなる)
    splash(position, kind = 'small', heading = [1, 0, 0]) {
      for (const q of splashParticles(kind, position, heading)) emit(q.p, q.v, q);
    },

    // 体から流れ落ちる水。水から上がってきた背中やひれの点から、細い滝のように落ちる
    cascade(point, n = 3) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, r = rand(0.15, 0.7);
        emit([point[0] + rand(-0.3, 0.3), point[1] + rand(-0.15, 0.1), point[2] + rand(-0.3, 0.3)],
          [Math.cos(a) * r, rand(-0.6, 0.4), Math.sin(a) * r],
          { life: rand(1.2, 2.0), size: rand(0.3, 0.6), alpha: 0.75, gravity: 9.8, grow: 1.4 });
      }
    },

    // 太陽や月の光の色に合わせる(夕方は金色、夜は青白く暗く)
    setLight(hex) {
      material.uniforms.uColor.value.set(hex).multiplyScalar(1.5);
    },

    // 海面に白い泡を円状に広げ、durationMs かけて薄くする
    foam(position, durationMs = 8000) {
      const [x, , z] = position;
      for (let k = 0; k < 400; k++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 6;
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
        const j = i * 3;
        vel[j + 1] -= gravity[i] * dt;
        vel[j] += wind[i] * dt;
        const drag = 1 - 0.6 * dt;
        vel[j] *= drag; vel[j + 2] *= drag;
        pos[j] += vel[j] * dt;
        pos[j + 1] += vel[j + 1] * dt;
        pos[j + 2] += vel[j + 2] * dt;
        if (floor[i] && pos[j + 1] < 0 && vel[j + 1] < 0) life[i] = 0;
        const t = Math.max(0, life[i] / maxLife[i]); // 1 → 0
        size[i] = baseSize[i] * (1 + (grow[i] - 1) * (1 - t));
        alpha[i] = life[i] > 0 ? baseAlpha[i] * Math.min(1, t * 2.5) : 0;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;
    },
  };
}
