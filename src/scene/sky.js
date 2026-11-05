import * as THREE from 'three';

// 空のグラデーション。真上・中ほど・地平線の3色を、時刻に合わせて変える。

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
  varying vec3 vWorld;

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 sky = mix(uHorizon, uMiddle, smoothstep(0.0, 0.25, h));
    sky = mix(sky, uZenith, smoothstep(0.25, 0.9, h));
    gl_FragColor = vec4(sky, 1.0);
    #include <colorspace_fragment>
  }`;

export function createGradientSky() {
  const uniforms = {
    uZenith: { value: new THREE.Color() },
    uMiddle: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
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
    // palette: skyPalette() の結果
    setColors({ zenith, middle, horizon }) {
      uniforms.uZenith.value.set(zenith);
      uniforms.uMiddle.value.set(middle);
      uniforms.uHorizon.value.set(horizon);
    },
  };
}
