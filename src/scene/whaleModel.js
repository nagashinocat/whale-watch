import * as THREE from 'three';
import { buildWhaleGeometry, SWIM, WHALE_SPECS } from '../logic/whaleShape.js';

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
