import * as THREE from 'three';
import { foamPixels } from '../logic/foam.js';

// 海面に散らばる白波。上から見たときに、海が平らな板に見えないようにする。
// 白波の模様を2つの大きさで重ね、ゆっくり流しながら、立っては消えるように明滅させる。

function makeFoamTexture(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d').putImageData(new ImageData(foamPixels(size), size, size), 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const vertexShader = `
  varying vec2 vXZ;
  varying float vDist;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vXZ = w.xz;
    vec4 mv = viewMatrix * w;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const fragmentShader = `
  uniform sampler2D uFoam;
  uniform float uTime;
  uniform float uStrength;
  uniform vec3 uColor;
  varying vec2 vXZ;
  varying float vDist;
  void main() {
    // 風は +x 方向。白波は風に流され、大きな模様と小さな模様で速さが違う
    float a = texture2D(uFoam, vXZ / 160.0 + vec2(uTime * 0.0016, 0.0)).r;
    float b = texture2D(uFoam, vXZ / 61.0 + vec2(uTime * 0.0042 + 0.37, 0.53)).r;
    // 白波は立っては消える。場所ごとにずらして明滅させる
    float pulse = 0.5 + 0.5 * sin(uTime * 0.35 + a * 9.0 + b * 5.0);
    float foam = smoothstep(0.25, 0.75, a * (0.4 + 0.9 * b) * pulse);
    // 遠くの白波は細かすぎてちらつくので、だんだん消す
    foam *= 1.0 - smoothstep(350.0, 2600.0, vDist);
    gl_FragColor = vec4(uColor, foam * uStrength);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createWhitecaps(lowPower) {
  const uniforms = {
    uFoam: { value: makeFoamTexture(lowPower ? 128 : 256) },
    uTime: { value: 0 },
    uStrength: { value: 0.6 },
    uColor: { value: new THREE.Color(1.6, 1.6, 1.6) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    // 海面とほぼ同じ高さに置くので、ちらつかないように手前に描く
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -8,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.2;

  return {
    mesh,
    // 上から見るほど白波がよく見える
    setStrength(v) {
      uniforms.uStrength.value = v;
    },
    // 白波は太陽や月の光の色に染まる(夕方は金色、夜は青白く)
    setLight(hex) {
      uniforms.uColor.value.set(hex).multiplyScalar(1.6);
    },
    update(dt, cameraPosition) {
      uniforms.uTime.value += dt;
      // 板をカメラの真下についてこさせる(模様は海に固定されたまま)
      mesh.position.x = cameraPosition.x;
      mesh.position.z = cameraPosition.z - 2000;
    },
  };
}
