import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { CAMERA_PRESETS } from './cameras.js';
import { sunForTime } from '../logic/sky.js';
import { waterNormalPixels } from '../logic/waterNormals.js';
import { createGradientSky } from './sky.js';
import { skyPalette } from '../logic/skyPalette.js';

// 海面の凹凸の模様は外部の画像に頼らず、その場で作る
function makeWaterNormals(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(waterNormalPixels(size), size, size), 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const MOON_DIRECTION = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(65), THREE.MathUtils.degToRad(200));

// 海・空・カメラ・描画ループ。
export function createOcean(canvas) {
  const lowPower = window.innerWidth < 768 || window.devicePixelRatio > 2;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower });
  renderer.setPixelRatio(lowPower ? 1 : window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 20000);

  const water = new Water(new THREE.PlaneGeometry(10000, 10000), {
    textureWidth: lowPower ? 256 : 512,
    textureHeight: lowPower ? 256 : 512,
    waterNormals: makeWaterNormals(lowPower ? 128 : 256),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x0a4f8a,
    distortionScale: 3.7,
    fog: false,
  });
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  // 時刻に合わせて色が変わる空(昼の青空、夕焼け、夜)
  const sky = createGradientSky();
  scene.add(sky.mesh);

  // 夜に見える月
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 12),
    new THREE.MeshBasicMaterial({ color: 0xf4f1e6 }),
  );
  moon.position.copy(MOON_DIRECTION).multiplyScalar(5000);
  scene.add(moon);

  // クジラ用の光
  const ambient = new THREE.HemisphereLight(0xbfd8ff, 0x0b2030, 0.8);
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
  scene.add(ambient, sunLight);

  let preset = CAMERA_PRESETS.cliff;
  let elapsed = 0;
  let running = false;
  let last = 0;
  const updaters = [];

  function placeCamera() {
    camera.fov = preset.fov;
    camera.position.set(...preset.position);
    camera.lookAt(...preset.target);
    if (preset.sway) {
      const deg = THREE.MathUtils.degToRad(preset.sway);
      camera.rotateZ(Math.sin(elapsed * 0.6) * deg);
      camera.rotateX(Math.sin(elapsed * 0.43) * deg * 0.6);
      camera.position.y = preset.position[1] + Math.sin(elapsed * 0.5) * 0.3;
    }
    camera.updateProjectionMatrix();
  }

  function setCamera(name) {
    preset = CAMERA_PRESETS[name] ?? CAMERA_PRESETS.cliff;
    placeCamera();
  }

  function setTime(hours) {
    const s = sunForTime(hours);
    const sunDir = new THREE.Vector3().setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(90 - s.elevation),
      THREE.MathUtils.degToRad(s.azimuth),
    );
    const lightDir = s.isNight ? MOON_DIRECTION : sunDir;
    water.material.uniforms.sunDirection.value.copy(lightDir).normalize();
    // 空・海・光の色は時刻ごとの色見本から決める
    const palette = skyPalette(hours);
    sky.setColors(palette);
    water.material.uniforms.sunColor.value.set(palette.light);
    water.material.uniforms.waterColor.value.set(palette.water);
    sunLight.position.copy(lightDir).multiplyScalar(1000);
    sunLight.color.set(palette.light);
    sunLight.intensity = s.isNight ? 0.4 : 1.5;
    ambient.intensity = s.isNight ? 0.25 : 0.8;
    moon.visible = s.isNight;
    renderer.toneMappingExposure = s.exposure + 0.12 * s.daylight;
  }

  function render(dt) {
    elapsed += dt;
    water.material.uniforms.time.value += dt * 0.6;
    if (preset.sway) placeCamera();
    for (const fn of updaters) fn(dt);
    renderer.render(scene, camera);
  }

  function loop(t) {
    if (!running) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    render(dt);
    requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  setCamera('cliff');
  setTime(12);

  return {
    setCamera,
    setTime,
    render,
    start,
    stop,
    scene,
    camera,
    // 毎フレーム呼んでほしい処理(クジラ・エフェクト)を登録する
    addUpdater: fn => updaters.push(fn),
  };
}
