import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { CAMERA_PRESETS } from './cameras.js';
import { sunForTime } from '../logic/sky.js';
import { waterNormalPixels } from '../logic/waterNormals.js';
import { createGradientSky } from './sky.js';
import { createWhitecaps } from './whitecaps.js';
import { createQualityControl } from '../logic/quality.js';
import { skyPalette } from '../logic/skyPalette.js';
import { whaleLights, LIGHTING } from '../logic/lighting.js';

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

// 月はカメラの正面やや左、高さ20度。正面にあると海に月の光の道(ムーンロード)が手前までのびる
const MOON_DIRECTION = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(186));

// 海面のきらめきの強さ(1 で元の強さ)。まぶしすぎるときはここを下げる
const GLARE = 0.55;

// 海面のきらめきを時間帯ごとに変えられるよう、three.js の海のシェーダーを少しだけ書き換える。
// 書き換える場所が見つからなければ何もしない(元の見た目のまま動く)。
function tuneWaterShader(material) {
  let shader = material.fragmentShader;
  const before = shader;
  shader = shader.replace(
    /sunLight\(\s*surfaceNormal,\s*eyeDirection,\s*100\.0,\s*2\.0,/,
    'sunLight( surfaceNormal, eyeDirection, uShiny, uSpec,',
  );
  // きらめきを空の映り込みの明るさに関係なく光らせる(夜の月の光の道が暗くならないように)
  shader = shader.replace(/reflectionSample \* specularLight/, 'reflectionSample * specularLight + specularLight * uGlint');
  // 波の模様は同じ画像を4回重ねて作られている。同じ向きのままだと並びがそろって
  // 格子模様に見えるので、2枚目と4枚目を別々の角度に回す
  shader = shader.replace(/vec2 uv1 = uv \/ 107\.0/, 'vec2 uv1 = mat2(0.799, 0.602, -0.602, 0.799) * uv / 107.0');
  shader = shader.replace(/vec2 uv3 = uv \/ vec2\( 1091\.0, 1027\.0 \)/, 'vec2 uv3 = mat2(0.423, -0.906, 0.906, 0.423) * uv / vec2( 1091.0, 1027.0 )');
  // 空の映り込みを少し弱める(真上から見たときの鏡のような反射を抑える)
  shader = shader.replace(/float rf0 = 0\.3;/, 'float rf0 = 0.18;');
  if (shader === before) return false;
  material.fragmentShader = 'uniform float uShiny;\nuniform float uSpec;\nuniform float uGlint;\n' + shader;
  material.uniforms.uShiny = { value: 100 };
  material.uniforms.uSpec = { value: 2 };
  material.uniforms.uGlint = { value: 0 };
  material.needsUpdate = true;
  return true;
}

// 海・空・カメラ・描画ループ。
export function createOcean(canvas) {
  const lowPower = window.innerWidth < 768 || window.devicePixelRatio > 2;

  // ふちのぎざぎざをなめらかにする設定は、いつも使う。
  // 画面のきめ細かさは、はじめは少しひかえめにして、なめらかに動いていれば上げていく
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const deviceRatio = window.devicePixelRatio || 1;
  let pixelRatio = Math.min(deviceRatio, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 30000);

  const water = new Water(new THREE.PlaneGeometry(40000, 40000), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: makeWaterNormals(lowPower ? 128 : 256),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x0a4f8a,
    distortionScale: 3.7,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  scene.add(water);
  const tuned = tuneWaterShader(water.material);

  // 白波。海に映り込むと二重に見えるので、海の映り込みを描くあいだは隠す
  const whitecaps = createWhitecaps(lowPower);
  scene.add(whitecaps.mesh);
  // 海面に貼りつけるもの(白波・足あと)は、海の映り込みには描かない
  const surfaceDecals = [whitecaps.mesh];
  const mirrorRender = water.onBeforeRender;
  water.onBeforeRender = function (...args) {
    const shown = surfaceDecals.map(o => o.visible);
    for (const o of surfaceDecals) o.visible = false;
    mirrorRender.apply(this, args);
    surfaceDecals.forEach((o, i) => { o.visible = shown[i]; });
  };

  // 遠くの海ほど空気でかすんで、地平線の空の色にとけこむ
  scene.fog = new THREE.Fog(0xffffff, 1500, 18000);

  // 時刻に合わせて色が変わる空(昼の青空、夕焼け、夜)
  const sky = createGradientSky();
  scene.add(sky.mesh);

  // クジラ用の光。逆光のときは、照らす光をカメラのうしろ側へ移す(順光。lighting.js)。
  // 本物の太陽の向きからは、ふちを照らす弱い光(rimLight)
  const ambient = new THREE.HemisphereLight(0xbfd8ff, 0x0b2030, 0.8);
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0);
  scene.add(ambient, sunLight, rimLight);
  let lightFrom = new THREE.Vector3(0, 1, 0), lightPower = 1.5;
  function placeWhaleLights() {
    camera.updateMatrixWorld();
    const f = camera.getWorldDirection(new THREE.Vector3());
    const { key, rim } = whaleLights(lightFrom.toArray(), f.toArray());
    sunLight.position.fromArray(key).multiplyScalar(1000);
    rimLight.position.fromArray(rim).multiplyScalar(1000);
    sunLight.intensity = lightPower * (LIGHTING.key / 1.5);
    // 光を移したときだけ、本物の太陽の向きからふちを照らす
    const moved = key[0] * rim[0] + key[1] * rim[1] + key[2] * rim[2] < 0.99;
    rimLight.intensity = moved ? lightPower * (LIGHTING.rim / 1.5) : 0;
  }

  let preset = CAMERA_PRESETS.cliff;
  let elapsed = 0;
  let running = false;
  let last = 0;
  const updaters = [];
  const paletteListeners = [];

  // 近くで大きな水しぶきが上がったときの揺れ(0〜1)。だんだんおさまる
  let shakeAmount = 0;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function placeCamera() {
    camera.fov = preset.fov;
    camera.position.set(...preset.position);
    camera.lookAt(...preset.target);
    if (shakeAmount > 0.001) {
      const a = shakeAmount;
      camera.position.y += Math.sin(elapsed * 31) * 0.12 * a;
      camera.position.x += Math.sin(elapsed * 23 + 1) * 0.08 * a;
      camera.rotateZ(Math.sin(elapsed * 27 + 2) * 0.006 * a);
      camera.rotateX(Math.sin(elapsed * 19) * 0.005 * a);
    }
    if (preset.sway) {
      // 船や水面に浮かんでいるように、傾きながら上下に揺れる
      const deg = THREE.MathUtils.degToRad(preset.sway);
      camera.rotateZ((Math.sin(elapsed * 0.6) + 0.3 * Math.sin(elapsed * 1.3)) * deg);
      camera.rotateX(Math.sin(elapsed * 0.43) * deg * 0.6);
      camera.position.y = preset.position[1]
        + (Math.sin(elapsed * 0.9) + 0.35 * Math.sin(elapsed * 1.7)) * preset.bob;
    }
    camera.updateProjectionMatrix();
  }

  function setCamera(name) {
    preset = CAMERA_PRESETS[name] ?? CAMERA_PRESETS.cliff;
    whitecaps.setStrength(preset.whitecaps ?? 0.5);
    placeCamera();
    placeWhaleLights();
  }

  // 方位と高さ(度)から、画面の中の向き
  const direction = (elevation, azimuth) => new THREE.Vector3().setFromSphericalCoords(
    1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));

  // 空を合わせる。hours は空の色の時刻。本物の空では、太陽の方位(sunAzimuth)と月(moon)も渡す
  function setSky({ hours, sunAzimuth, moon }) {
    const s = sunForTime(hours);
    const sunDir = direction(s.elevation, sunAzimuth ?? s.azimuth);
    const moonEl = moon ? moon.elevation : 20;
    const moonDir = moon ? direction(moon.elevation, moon.azimuth) : MOON_DIRECTION.clone();
    const illumination = moon ? moon.illumination : 1;
    // 夜の海の光の道は、月が出ているときだけ。明るさは月の満ち欠けに合わせる
    const moonUp = THREE.MathUtils.smoothstep(moonEl, -1, 3);
    const lightDir = s.isNight ? moonDir : sunDir;
    water.material.uniforms.sunDirection.value.copy(lightDir).normalize();
    // 空・海・光の色は時刻ごとの色見本から決める
    const palette = skyPalette(hours);
    sky.setState({ palette, sun: s, sunDir, moonDir, moonUp, illumination });
    scene.fog.color.set(palette.horizon);
    whitecaps.setLight(palette.light);
    for (const fn of paletteListeners) fn(palette);
    water.material.uniforms.sunColor.value.set(palette.light);
    water.material.uniforms.waterColor.value.set(palette.water);
    if (tuned) {
      const u = water.material.uniforms;
      const lerp = (a, b, t) => a + (b - a) * t;
      if (s.isNight) {
        // 月の光の道: 細くまっすぐ、くっきり
        u.uShiny.value = 260;
        u.uSpec.value = 2.6 * s.moonlight * moonUp * illumination * GLARE;
        u.uGlint.value = 0.8 * GLARE;
      } else {
        // 太陽が低いほど光の道が太く、金色に強く光る
        const up = THREE.MathUtils.smoothstep(s.elevation, -1, 1.5);
        u.uShiny.value = lerp(80, 200, s.daylight);
        u.uSpec.value = lerp(3.2, 1.6, s.daylight) * up * GLARE;
        u.uGlint.value = lerp(0.5, 0.15, s.daylight) * GLARE;
      }
    }
    lightFrom = lightDir.clone().normalize();
    sunLight.color.set(palette.light);
    rimLight.color.set(palette.light);
    lightPower = s.isNight ? 0.4 * (0.3 + 0.7 * moonUp * illumination) : 1.5;
    placeWhaleLights();
    ambient.intensity = s.isNight ? 0.25 : 0.8;
    renderer.toneMappingExposure = s.exposure + 0.12 * s.daylight;
  }

  function setTime(hours) {
    setSky({ hours });
  }

  function render(dt) {
    elapsed += dt;
    water.material.uniforms.time.value += dt * 0.6;
    sky.update(dt);
    whitecaps.update(dt, camera.position);
    if (shakeAmount > 0.001) shakeAmount *= Math.exp(-dt * 3);
    if (preset.sway || shakeAmount > 0.001) placeCamera();
    for (const fn of updaters) fn(dt);
    // 画面を真っ暗にしているあいだは、動きだけ進めて描かない(電池を節約する)
    if (!eco) renderer.render(scene, camera);
  }

  // 写真: いまの画面をもう一度描いて、すぐに写しとる(描いたあとすぐでないと、画面が消えてしまう)。
  // 横の大きさを maxWidth までにちぢめて、JPEG にする
  function snapshot({ maxWidth = 1280, quality = 0.86 } = {}) {
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const k = Math.min(1, maxWidth / src.width);
    const out = document.createElement('canvas');
    out.width = Math.round(src.width * k);
    out.height = Math.round(src.height * k);
    out.getContext('2d').drawImage(src, 0, 0, out.width, out.height);
    return new Promise(resolve => out.toBlob(b => resolve(b), 'image/jpeg', quality));
  }

  // なめらかに動いているかを見て、画面のきめ細かさを決めなおす(切りかえはなるべく少なく。quality.js)
  const quality = createQualityControl(deviceRatio, pixelRatio);
  function adjustQuality(dt) {
    const next = quality.sample(dt);
    if (next === null) return;
    pixelRatio = next;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function loop(t) {
    if (!running) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    const realDt = last ? (t - last) / 1000 : 0;
    last = t;
    // 大きさを変えると画面がいったん消えるので、変えるのは描く前にする(描いたあとに変えると、そのコマが真っ暗になる)
    if (realDt > 0 && !eco) adjustQuality(realDt);
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

  let eco = false;
  function setEco(on) {
    eco = on;
    if (!on && running) renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // 大きさを変えると画面が消えるので、すぐに描きなおす
    if (running) renderer.render(scene, camera);
  });

  setCamera('cliff');
  setTime(12);

  return {
    setCamera,
    setTime,
    setSky,
    render,
    snapshot,
    start,
    stop,
    setEco,
    scene,
    camera,
    // 毎フレーム呼んでほしい処理(クジラ・エフェクト)を登録する
    addUpdater: fn => updaters.push(fn),
    // 画面を揺らす(0〜1)。動きを減らす設定の端末では揺らさない
    shake: amount => { if (!reduceMotion) shakeAmount = Math.max(shakeAmount, amount); },
    // 海面に貼りつけるもの(映り込みには描かない)を足す
    addSurfaceDecal: obj => { surfaceDecals.push(obj); scene.add(obj); },
    // 時刻が変わったときに呼んでほしい処理(空の色を使うもの)を登録する
    onPalette: fn => paletteListeners.push(fn),
  };
}
