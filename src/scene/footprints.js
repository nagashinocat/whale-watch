import * as THREE from 'three';
import { FOOTPRINT } from '../logic/behavior.js';

// クジラの足あと(フットプリント)。潜ったあとの海面に残る、なめらかな楕円形の跡。
// まわりのさざ波が消えて空を一様に映すので、少し明るく、つるっと見える。数分かけて消えていく。

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float d = length((vUv - 0.5) * 2.0);
    float a = (1.0 - smoothstep(0.55, 1.0, d)) * uAlpha;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const MAX = 6;

export function createFootprints() {
  const group = new THREE.Group();
  const color = new THREE.Color(0xa0b8d0);
  const prints = [];
  for (let i = 0; i < MAX; i++) {
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uAlpha: { value: 0 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -8,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(FOOTPRINT.widthMeters, FOOTPRINT.lengthMeters, 1);
    mesh.visible = false;
    group.add(mesh);
    prints.push({ mesh, age: Infinity });
  }
  let next = 0;

  return {
    group,
    // position: 足あとの中心 / yawDeg: クジラが進んでいた向き
    add(position, yawDeg = 0) {
      const p = prints[next];
      next = (next + 1) % MAX;
      p.mesh.position.set(position[0], 0.25, position[2]);
      p.mesh.rotation.y = THREE.MathUtils.degToRad(yawDeg);
      p.mesh.visible = true;
      p.age = 0;
    },
    // 足あとは空を映すので、空の色に合わせる
    setPalette(palette) {
      color.set(palette.horizon).lerp(new THREE.Color(palette.middle), 0.4);
    },
    update(dt) {
      const life = FOOTPRINT.lastsMs / 1000;
      for (const p of prints) {
        if (!p.mesh.visible) continue;
        p.age += dt;
        // 3秒でふわっと現れ、残りの時間でゆっくり消える
        const fadeIn = Math.min(1, p.age / 3);
        const fadeOut = 1 - Math.min(1, p.age / life);
        p.mesh.material.uniforms.uAlpha.value = 0.22 * fadeIn * fadeOut * fadeOut;
        // 足あとは少しずつ広がる
        const grow = 1 + Math.min(1, p.age / life) * 0.6;
        p.mesh.scale.set(FOOTPRINT.widthMeters * grow, FOOTPRINT.lengthMeters * grow, 1);
        if (p.age >= life) p.mesh.visible = false;
      }
    },
  };
}
