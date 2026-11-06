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
  for (let i = 0; i < linear.length; i++) linear[i] = THREE.SRGBToLinear(g.colors[i]);
  geo.setAttribute('color', new THREE.BufferAttribute(linear, 3));
  geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
  geo.computeVertexNormals();
  geometries[kind] = geo;
  return geo;
}

// 1頭ぶんのクジラ。lengthMeters は体長(m)。頭は -z を向いている
export function createWhaleMesh(kind, lengthMeters = WHALE_SPECS[kind].lengthMeters) {
  const uniforms = { uPhase: { value: Math.random() * Math.PI * 2 }, uSwim: { value: 1 } };
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.5,            // ぬれた肌のつや
    clearcoatRoughness: 0.35,
    side: THREE.DoubleSide,    // ひれは薄いので両面を描く
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uPhase = uniforms.uPhase;
    shader.uniforms.uSwim = uniforms.uSwim;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPhase;\nuniform float uSwim;')
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
