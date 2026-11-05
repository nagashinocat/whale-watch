import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CAMERA_PRESETS } from './cameras.js';
import { sunForTime } from '../logic/sky.js';
import { waterNormalPixels } from '../logic/waterNormals.js';
import { createDaySky } from './daySky.js';

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

const DAY_WATER_COLOR = 0x0a4f8a;      // 晴れた昼の青い海
const LOW_SUN_WATER_COLOR = 0x0d2a3a;  // 朝夕の海
const NIGHT_WATER_COLOR = 0x000a14;
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
    waterColor: DAY_WATER_COLOR,
    distortionScale: 3.7,
    fog: false,
  });
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  const sky = new Sky();
  sky.scale.setScalar(10000);
  const skyU = sky.material.uniforms;
  skyU.turbidity.value = 10;
  skyU.rayleigh.value = 2;
  skyU.mieCoefficient.value = 0.005;
  skyU.mieDirectionalG.value = 0.8;
  scene.add(sky);

  // 晴れた昼の青空と雲(Sky の内側に重ねる)
  const daySky = createDaySky();
  scene.add(daySky.mesh);

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
    skyU.sunPosition.value.copy(sunDir);
    const lightDir = s.isNight ? MOON_DIRECTION : sunDir;
    water.material.uniforms.sunDirection.value.copy(lightDir).normalize();
    water.material.uniforms.sunColor.value.set(s.isNight ? 0x8899bb : 0xffffff);
    daySky.setDaylight(s.daylight);
    // 昼に近いほど空気が澄んだ青空と青い海、朝夕は少しかすんだ色にする
    const lerp = (a, b) => a + (b - a) * s.daylight;
    skyU.turbidity.value = lerp(8, 1.8);
    skyU.rayleigh.value = lerp(3, 1.2);
    skyU.mieCoefficient.value = lerp(0.005, 0.002);
    const waterColor = water.material.uniforms.waterColor.value;
    if (s.isNight) waterColor.set(NIGHT_WATER_COLOR);
    else waterColor.lerpColors(new THREE.Color(LOW_SUN_WATER_COLOR), new THREE.Color(DAY_WATER_COLOR), s.daylight);
    sunLight.position.copy(lightDir).multiplyScalar(1000);
    sunLight.color.set(s.isNight ? 0x8899bb : 0xffffff);
    sunLight.intensity = s.isNight ? 0.4 : 1.5;
    ambient.intensity = s.isNight ? 0.25 : 0.8;
    moon.visible = s.isNight;
    renderer.toneMappingExposure = s.exposure + 0.12 * s.daylight;
  }

  function render(dt) {
    elapsed += dt;
    water.material.uniforms.time.value += dt * 0.6;
    daySky.update(dt);
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
