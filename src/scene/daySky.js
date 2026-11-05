import * as THREE from 'three';

// 晴れた昼の空。深い青から地平線に向かって明るくなる空に、白い雲がゆっくり流れる。
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

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float h = clamp(dir.y, 0.0, 1.0);

    // 青のグラデーション
    vec3 sky = mix(uHorizon, uMiddle, smoothstep(0.0, 0.25, h));
    sky = mix(sky, uZenith, smoothstep(0.25, 0.9, h));

    // 雲: 空を平面に見立てて模様を貼る。遠く(地平線近く)ほど細かく見える
    vec2 uv = dir.xz / max(dir.y, 0.06) * 0.9 + vec2(uTime * 0.004, uTime * 0.0015);
    float n = fbm(uv);
    float cloud = smoothstep(0.52, 0.72, n);
    // 雲の下側は少しだけ影になる
    float shade = smoothstep(0.45, 0.8, fbm(uv + vec2(0.06, 0.04)));
    vec3 cloudColor = mix(vec3(1.0), vec3(0.80, 0.85, 0.93), shade * 0.6);
    cloud *= smoothstep(0.02, 0.14, h);
    sky = mix(sky, cloudColor, cloud);

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
