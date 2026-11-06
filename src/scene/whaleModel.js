import * as THREE from 'three';
import { buildWhaleGeometry, SWIM, WHALE_SPECS } from '../logic/whaleShape.js';
import { UNDERWATER } from '../logic/underwater.js';

// 海面より下を描かないための面(海面より5cm下まで描く)。下は「水の中の姿」として別に描く
const ABOVE_WATER = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.05)];

// 水の中の姿に使う、海の色と光の色(時刻で変わる。setUnderwaterLight で変える)
const underwaterUniforms = {
  uTint: { value: new THREE.Color(0x0a4f8a) },
  uLight: { value: new THREE.Color(1, 1, 1) },
  uTime: { value: 0 },
};
export function setUnderwaterLight(palette) {
  underwaterUniforms.uTint.value.set(palette.water);
  underwaterUniforms.uLight.value.set(palette.light);
}

const bendGLSL = `
  float swimS = clamp(position.z + 0.5, 0.0, 1.0);
  float swimY = uSwim * ${SWIM.amplitude.toFixed(4)} * pow(swimS, ${SWIM.power.toFixed(2)}) * sin(uPhase - ${SWIM.wave.toFixed(2)} * swimS);`;

// 水の中に見えるクジラ。はっきりした姿ではなく、ぼやけた影にする(shadowLook と同じ式)。
// ・ふち(こちらに横を向けている面)ほどうすくして、輪郭をぼかす。深いほど広くぼかす
// ・模様は消して、明るさの差だけを少し残す。背中は海より暗いかげ、白い所は水色にぼうっと光る
// ・海面の波がレンズになって、形がゆらゆらゆがむ
// ・水面をななめから見るほど、空が映りこんで中は見えにくい
function makeUnderwaterMaterial(swimUniforms) {
  const k = UNDERWATER.visibleDepth / 2.2;
  return new THREE.ShaderMaterial({
    uniforms: { ...swimUniforms, ...underwaterUniforms },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uPhase;
      uniform float uSwim;
      uniform float uTime;
      varying vec3 vColor;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        ${bendGLSL}
        vec3 p = position;
        p.y += swimY;
        vec4 w = modelMatrix * vec4(p, 1.0);
        // 波のゆらぎ。海面のすぐ下ではゆらさない(海面より上の体とずれないように)
        float sway = ${UNDERWATER.wobble.toFixed(2)} * smoothstep(0.0, 1.5, -w.y);
        w.x += sway * sin(w.z * 0.35 + uTime * 1.3);
        w.z += sway * sin(w.x * 0.30 + uTime * 1.1 + 1.7);
        vWorld = w.xyz;
        vColor = color;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uTint;
      uniform vec3 uLight;
      varying vec3 vColor;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        float depth = -vWorld.y;
        if (depth < 0.03) discard;
        float edge = min(0.95, 0.35 + 0.6 * (1.0 - exp(-depth / 4.0)));
        float maxAlpha = 0.55 * exp(-depth / ${k.toFixed(2)});
        float contrast = 0.45 * exp(-depth / 5.0);
        // 模様は消して明るさだけ。背中(暗い)は海より暗いかげ、白い所は水色に光る
        float lum = dot(vColor, vec3(0.3, 0.6, 0.1));
        vec3 c = uTint * (0.45 + contrast * (lum - 0.3) * 1.6);
        c += vec3(0.05, 0.25, 0.22) * uLight * smoothstep(0.35, 0.8, lum) * contrast * 1.6;
        c = max(c, vec3(0.0));
        vec3 view = normalize(cameraPosition - vWorld);
        float facing = abs(dot(normalize(vNormalW), view));
        float soft = smoothstep(0.0, edge, facing);
        float mirror = pow(1.0 - abs(view.y), 4.0);
        float a = maxAlpha * soft * (1.0 - 0.9 * mirror) * smoothstep(0.03, 0.4, depth);
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// 計算で作ったクジラの形を three.js の物体にする。泳ぐしなりは画面の部品(シェーダー)で動かす。

const geometries = {};

function geometryFor(kind) {
  if (geometries[kind]) return geometries[kind];
  const g = buildWhaleGeometry(kind);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
  // 色は sRGB で作ってあるので、three.js の計算用の色に直す
  const linear = new Float32Array(g.colors.length);
  const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  for (let i = 0; i < linear.length; i++) linear[i] = toLinear(g.colors[i]);
  geo.setAttribute('color', new THREE.BufferAttribute(linear, 3));
  geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
  geo.computeVertexNormals();
  geometries[kind] = geo;
  return geo;
}

// 形の計算には少し時間がかかるので、クジラが出てくる前にすませておく
export function prepareWhaleGeometry() {
  geometryFor('humpback');
  geometryFor('sperm');
}

// 1頭ぶんのクジラ。lengthMeters は体長(m)。頭は -z を向いている。
// underwater: 海の中で使うとき、海面より下を「水の中の姿」として描く(模型のページでは false)
export function createWhaleMesh(kind, lengthMeters = WHALE_SPECS[kind].lengthMeters, { underwater = true } = {}) {
  const uniforms = { uPhase: { value: Math.random() * Math.PI * 2 }, uSwim: { value: 1 } };
  // ぬれた肌は少しつやがある。重い描き方(二重のつや)はやめて、つるつる具合だけで出す
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.34,
    metalness: 0,
    side: THREE.DoubleSide,    // ひれは薄いので両面を描く
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uPhase = uniforms.uPhase;
    shader.uniforms.uSwim = uniforms.uSwim;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPhase;\nuniform float uSwim;')
      // 体がしなった向きに合わせて、陰のつけ方も曲げる(しなりの傾きは swimSlope と同じ式)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float bendS = clamp(position.z + 0.5, 0.0, 1.0);
        float bendA = uPhase - ${SWIM.wave.toFixed(2)} * bendS;
        float bendSlope = uSwim * ${SWIM.amplitude.toFixed(4)} * (${SWIM.power.toFixed(2)} * pow(max(bendS, 1e-4), ${(SWIM.power - 1).toFixed(2)}) * sin(bendA)
          - ${SWIM.wave.toFixed(2)} * pow(bendS, ${SWIM.power.toFixed(2)}) * cos(bendA));
        objectNormal = normalize(vec3(objectNormal.x, objectNormal.y, objectNormal.z - bendSlope * objectNormal.y));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float swimS = clamp(position.z + 0.5, 0.0, 1.0);
        transformed.y += uSwim * ${SWIM.amplitude.toFixed(4)} * pow(swimS, ${SWIM.power.toFixed(2)})
          * sin(uPhase - ${SWIM.wave.toFixed(2)} * swimS);`);
  };
  const mesh = new THREE.Mesh(geometryFor(kind), material);
  mesh.scale.setScalar(lengthMeters);
  let ghost = null;
  if (underwater) {
    material.clippingPlanes = ABOVE_WATER;
    // 本体の子にするので、大きさと動きは本体といっしょ
    ghost = new THREE.Mesh(geometryFor(kind), makeUnderwaterMaterial(uniforms));
    ghost.renderOrder = 1;
    // 海の映りこみには描かない(映りこみ用のカメラは、この層を見ない)
    ghost.layers.set(1);
    ghost.onBeforeRender = () => { underwaterUniforms.uTime.value = performance.now() / 1000; };
    mesh.add(ghost);
  }

  // 大きいクジラほどゆっくり尾をあおぐ(14mでおよそ5秒に1回)
  const strokesPerSecond = 0.2 * Math.sqrt(14 / lengthMeters);

  return {
    mesh,
    length: lengthMeters,
    // 0 で止まる(寝ているクジラ)、1 でふつうに泳ぐ
    setSwim(amount) {
      uniforms.uSwim.value = amount;
    },
    update(dt) {
      uniforms.uPhase.value += dt * Math.PI * 2 * strokesPerSecond;
    },
  };
}
