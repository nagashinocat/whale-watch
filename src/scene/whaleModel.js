import * as THREE from 'three';
import { buildWhaleGeometry, SWIM, WHALE_SPECS } from '../logic/whaleShape.js';
import { eyePatch, applyLid, eyeballPlacement, blinkOpen, EYE } from '../logic/eyeShape.js';

// 目の玉に映る空と海の色(時刻で変わる。setEyeLight で変える)
const eyeUniforms = {
  uZenith: { value: new THREE.Color(0x2557cc) },
  uHorizon: { value: new THREE.Color(0x90b6ef) },
  uSea: { value: new THREE.Color(0x0a4f8a) },
  uDay: { value: 1 },
};
export function setEyeLight(palette) {
  eyeUniforms.uZenith.value.set(palette.zenith);
  eyeUniforms.uHorizon.value.set(palette.horizon);
  eyeUniforms.uSea.value.set(palette.water);
  // 明るいときは、ひとみが細くなる(U字)
  const z = new THREE.Color(palette.zenith);
  eyeUniforms.uDay.value = THREE.MathUtils.smoothstep(0.2 * z.r + 0.7 * z.g + 0.1 * z.b, 0.01, 0.12);
}

// 目の玉。茶色の虹彩、そのまわりの白っぽい輪、明るいとU字になるひとみ。
// 表面はぬれてつやがあり、空と海が映りこむ
let eyeballMaterial = null;
function eyeMaterial() {
  if (eyeballMaterial) return eyeballMaterial;
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 });
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, eyeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEyePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEyePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vEyePos;
        uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSea; uniform float uDay;`)
      .replace('#include <map_fragment>', `
        vec3 ep = normalize(vEyePos);
        float er = length(ep.xy);
        vec3 eyeCol = vec3(0.62, 0.66, 0.68);                         // 白っぽい輪
        float irisR = 0.62;
        float iris = (1.0 - smoothstep(irisR - 0.03, irisR + 0.01, er)) * step(0.0, ep.z);
        float ang = atan(ep.y, ep.x);
        float fib = 0.72 + 0.28 * sin(ang * 70.0 + 2.0 * sin(ang * 13.0)) * (0.6 + 0.4 * sin(er * 40.0));
        vec3 irisCol = mix(vec3(0.11, 0.045, 0.022), vec3(0.26, 0.12, 0.055), smoothstep(0.15, 0.55, er)) * fib;
        irisCol *= 1.0 - 0.55 * smoothstep(irisR - 0.12, irisR, er);  // 虹彩のふちは暗い
        eyeCol = mix(eyeCol, irisCol, iris);
        // ひとみ: 横長の楕円。明るいときは上から幕が下りて、U字に残る
        float pupil = 1.0 - smoothstep(0.92, 1.05, length(vec2(ep.x / 0.36, (ep.y + 0.03) / 0.24)));
        float lidOver = 1.0 - smoothstep(0.92, 1.05, length(vec2(ep.x / 0.27, (ep.y - 0.11) / 0.22)));
        pupil *= (1.0 - lidOver * uDay) * step(0.0, ep.z);
        eyeCol = mix(eyeCol, vec3(0.004), pupil);
        diffuseColor.rgb = eyeCol;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // ぬれた目に映る空(上)と海(下)
          vec3 V = normalize(vViewPosition);
          vec3 Rw = (vec4(reflect(-V, normal), 0.0) * viewMatrix).xyz;
          vec3 env = Rw.y > 0.0 ? mix(uHorizon, uZenith, smoothstep(0.0, 0.7, Rw.y)) : uSea * 0.6;
          env *= 1.0 + 0.6 * (1.0 - smoothstep(0.0, 0.06, abs(Rw.y)));   // 水平線のあたりは明るい
          float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(normal, V), 0.0, 1.0), 5.0);
          totalEmissiveRadiance += env * (0.1 + 0.9 * fres) * 0.5;
        }`);
  };
  eyeballMaterial = m;
  return m;
}

// 目のまわりの肌(左右)。形の計算に時間がかかるので、一度だけ作って使い回す
let eyePatches = null;
function patchesFor() {
  if (!eyePatches) eyePatches = [1, -1].map(side => ({ side, patch: eyePatch(side), place: eyeballPlacement(side) }));
  return eyePatches;
}

// 1頭ぶんの目(左右)。まぶたは頭の肌と同じ material で描く(泳ぐしなりもいっしょ)
function createEyes(parent, skinMaterial) {
  const eyes = patchesFor().map(({ patch, place }) => {
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(applyLid(new Float32Array(patch.base.length), patch, EYE.relaxedOpen), 3);
    geo.setAttribute('position', pos);
    geo.setAttribute('color', new THREE.BufferAttribute(patch.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(patch.indices, 1));
    geo.computeVertexNormals();
    const skin = new THREE.Mesh(geo, skinMaterial);
    parent.add(skin);
    // 目の玉: x が体の前後、y が背中の向き、z が外向き
    const pivot = new THREE.Group();
    pivot.position.fromArray(place.eyeCenter);
    pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...place.along), new THREE.Vector3(...place.up), new THREE.Vector3(...place.normal)));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(place.radius, 64, 48), eyeMaterial());
    pivot.add(ball);
    parent.add(pivot);
    return { patch, geo, pos, ball, open: EYE.relaxedOpen };
  });

  let blinking = false, blinkT = 0, nextBlink = 4 + Math.random() * 6;
  let baseOpen = EYE.relaxedOpen;
  let look = { x: 0, y: 0, tx: 0, ty: 0, next: 1 };

  function setOpen(open) {
    for (const e of eyes) {
      if (Math.abs(e.open - open) < 0.003) continue;
      e.open = open;
      applyLid(e.pos.array, e.patch, open);
      e.pos.needsUpdate = true;
      e.geo.computeVertexNormals();
    }
  }

  return {
    // まばたきと目の動きをするか(近くで見せる出方のときだけ。計算を軽くするため)
    alive: false,
    setBaseOpen(v) { baseOpen = v; },
    update(dt) {
      if (!this.alive) return;
      nextBlink -= dt;
      if (!blinking && nextBlink <= 0) { blinking = true; blinkT = 0; }
      if (blinking) {
        blinkT += dt;
        if (blinkT > 1.2) { blinking = false; nextBlink = 5 + Math.random() * 7; }
      }
      setOpen(blinking ? blinkOpen(blinkT, baseOpen) : baseOpen);
      // 目の玉は、ときどき少しだけ向きを変える
      look.next -= dt;
      if (look.next <= 0) {
        look.tx = (Math.random() - 0.5) * 0.12; look.ty = (Math.random() - 0.5) * 0.08;
        look.next = 1.5 + Math.random() * 2.5;
      }
      const k = 1 - Math.exp(-dt * 8);
      look.x += (look.tx - look.x) * k; look.y += (look.ty - look.y) * k;
      for (const e of eyes) e.ball.rotation.set(-look.y, look.x, 0);
    },
  };
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
  patchesFor();
}

// 1頭ぶんのクジラ。lengthMeters は体長(m)。頭は -z を向いている
export function createWhaleMesh(kind, lengthMeters = WHALE_SPECS[kind].lengthMeters) {
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
  // ザトウクジラは、目のまわりを細かく作った部品をはめこむ(体の網目のその部分は抜いてある)
  const eyes = kind === 'humpback' ? createEyes(mesh, material) : null;

  // 大きいクジラほどゆっくり尾をあおぐ(14mでおよそ5秒に1回)
  const strokesPerSecond = 0.2 * Math.sqrt(14 / lengthMeters);

  return {
    mesh,
    length: lengthMeters,
    // 0 で止まる(寝ているクジラ)、1 でふつうに泳ぐ
    setSwim(amount) {
      uniforms.uSwim.value = amount;
    },
    // 目(ザトウクジラだけ)。alive にすると、まばたきと目の動きをする
    eyes,
    update(dt) {
      uniforms.uPhase.value += dt * Math.PI * 2 * strokesPerSecond;
      eyes?.update(dt);
    },
  };
}
