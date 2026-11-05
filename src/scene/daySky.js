import * as THREE from 'three';

// 晴れた昼の空。深い青から地平線に向かって明るくなる、雲のない青空。
// 朝夕と夜は three.js の Sky に任せ、日中の度合い(daylight)に合わせて重ねる。

const ZENITH = 0x2557cc;   // 真上の深い青
const MIDDLE = 0x2e74db;
const HORIZON = 0x90b6ef;  // 地平線近くの明るい青

const vertexShader = `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const fragmentShader = `
  uniform vec3 uZenith;
  uniform vec3 uMiddle;
  uniform vec3 uHorizon;
  uniform float uDaylight;
  uniform float uTime;
  varying vec3 vWorld;

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float h = clamp(dir.y, 0.0, 1.0);

    // 青のグラデーション
    vec3 sky = mix(uHorizon, uMiddle, smoothstep(0.0, 0.25, h));
    sky = mix(sky, uZenith, smoothstep(0.25, 0.9, h));

    gl_FragColor = vec4(sky, uDaylight);
    #include <colorspace_fragment>
  }`;

export function createDaySky() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color(ZENITH) },
      uMiddle: { value: new THREE.Color(MIDDLE) },
      uHorizon: { value: new THREE.Color(HORIZON) },
      uDaylight: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), material);

  return {
    mesh,
    setDaylight(d) {
      material.uniforms.uDaylight.value = d;
      mesh.visible = d > 0.001;
    },
    update(dt) {
      material.uniforms.uTime.value += dt;
    },
  };
}
