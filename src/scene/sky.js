import * as THREE from 'three';

// 空。真上・中ほど・地平線の3色のグラデーションに、太陽の光、月、星、天の川を重ねる。
// 海は空を映すので、ここで描いたものはそのまま海面にも映り込む。

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
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunUp;      // 太陽が見える度合い(沈むと0)
  uniform float uGlow;       // 太陽のまわりの空の明るさ(沈んだ直後も残る)
  uniform vec3 uMoonDir;
  uniform float uMoon;       // 月の見え方 0〜1
  uniform float uStars;      // 星の見え方 0〜1
  uniform float uTime;
  varying vec3 vWorld;

  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), u.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), u.x), u.y),
      mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), u.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), u.x), u.y),
      u.z);
  }

  // 星を1層ぶん描く。方向を細かい升目に分け、升目ごとに星を置くかどうかを決める
  float starLayer(vec3 d, float scale, float threshold, float radius) {
    vec3 p = d * scale;
    vec3 cell = floor(p);
    float h = hash3(cell);
    if (h < threshold) return 0.0;
    vec3 spot = vec3(hash3(cell + 1.3), hash3(cell + 2.7), hash3(cell + 5.1)) * 0.6 + 0.2;
    float dist = length(fract(p) - spot);
    float twinkle = 0.7 + 0.3 * sin(uTime * (1.3 + h * 2.7) + h * 50.0);
    return (1.0 - smoothstep(0.0, radius, dist)) * (0.35 + 0.65 * (h - threshold) / (1.0 - threshold)) * twinkle;
  }

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float h = clamp(dir.y, 0.0, 1.0);

    // 基本のグラデーション
    vec3 sky = mix(uHorizon, uMiddle, smoothstep(0.0, 0.25, h));
    sky = mix(sky, uZenith, smoothstep(0.25, 0.9, h));

    // 太陽のある方角の地平線ほど明るく色づく(夕焼けは太陽側がいちばん濃い)
    float toward = max(dot(normalize(dir.xz + 1e-5), normalize(uSunDir.xz + 1e-5)), 0.0);
    float lowSky = pow(1.0 - h, 4.0);
    sky += uSunColor * pow(toward, 6.0) * lowSky * 0.35 * uGlow;

    // 太陽のまわりのにじんだ光と、太陽そのもの
    float s = max(dot(dir, uSunDir), 0.0);
    sky += uSunColor * (pow(s, 12.0) * 0.25 + pow(s, 120.0) * 0.6) * uGlow;
    float sunDisc = smoothstep(0.99985, 0.99992, s) * uSunUp;
    sky = mix(sky, mix(uSunColor, vec3(1.0, 0.98, 0.92), 0.6) * 1.6, sunDisc);

    // 星と天の川(地平線近くは空気で見えにくくなる)
    if (uStars > 0.01) {
      float clear = smoothstep(0.02, 0.3, h) * uStars;
      vec3 band = normalize(vec3(0.762, -0.620, -0.186));
      float milky = exp(-pow(dot(dir, band) / 0.17, 2.0));
      float cloud = noise3(dir * 7.0) * 0.6 + noise3(dir * 15.0) * 0.4;
      sky += vec3(0.62, 0.68, 0.9) * milky * smoothstep(0.35, 0.8, cloud) * 0.09 * clear;
      float stars = starLayer(dir, 140.0, 0.982, 0.28)
                  + starLayer(dir, 300.0, 0.975 - milky * 0.04, 0.24) * 0.55;
      sky += vec3(0.92, 0.95, 1.0) * stars * clear;
    }

    // 月(少し大きめに描く)。まわりにやわらかな月明かり
    if (uMoon > 0.01) {
      float m = dot(dir, uMoonDir);
      float ang = sqrt(max(0.0, 2.0 * (1.0 - m)));
      float radius = 0.013;
      sky += vec3(0.55, 0.62, 0.8) * (exp(-ang / 0.05) * 0.18 + exp(-ang / 0.3) * 0.05) * uMoon;
      float disc = 1.0 - smoothstep(radius * 0.92, radius, ang);
      vec3 local = (dir - uMoonDir * m) / radius;
      float maria = noise3(local * 2.2 + 3.0) * 0.6 + noise3(local * 5.0) * 0.4;
      vec3 moonColor = vec3(0.97, 0.95, 0.88) * (1.0 - smoothstep(0.45, 0.75, maria) * 0.22);
      sky = mix(sky, moonColor, disc * uMoon);
    }

    gl_FragColor = vec4(sky, 1.0);
    #include <colorspace_fragment>
  }`;

export function createGradientSky() {
  const uniforms = {
    uZenith: { value: new THREE.Color() },
    uMiddle: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uSunUp: { value: 1 },
    uGlow: { value: 1 },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoon: { value: 0 },
    uStars: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), material);

  return {
    mesh,
    // palette: skyPalette() の結果 / sun: sunForTime() の結果
    setState({ palette, sun, sunDir, moonDir }) {
      uniforms.uZenith.value.set(palette.zenith);
      uniforms.uMiddle.value.set(palette.middle);
      uniforms.uHorizon.value.set(palette.horizon);
      uniforms.uSunColor.value.set(palette.light);
      uniforms.uSunDir.value.copy(sunDir).normalize();
      uniforms.uMoonDir.value.copy(moonDir).normalize();
      uniforms.uSunUp.value = THREE.MathUtils.smoothstep(sun.elevation, -1.2, 0.5);
      // 太陽が沈んだあとも、しばらくは空が色づいている
      uniforms.uGlow.value = THREE.MathUtils.smoothstep(sun.elevation, -9, 1) * (1 - 0.6 * sun.daylight);
      uniforms.uMoon.value = sun.moonlight;
      uniforms.uStars.value = sun.starlight;
    },
    update(dt) {
      uniforms.uTime.value += dt;
    },
  };
}
