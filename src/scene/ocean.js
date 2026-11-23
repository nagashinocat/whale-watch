import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { CAMERA_PRESETS, SPOT } from './cameras.js';
import { sunForTime } from '../logic/sky.js';
import { waterNormalPixels } from '../logic/waterNormals.js';
import { RIPPLE, rippleGrid } from '../logic/ripples.js';
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

// 波の輪(logic/ripples.js と同じ式)。落ちたところから広がる波で、海面の高さと向きを変える
function addRipples(material) {
  const list = Array.from({ length: RIPPLE.max }, () => new THREE.Vector4(0, 0, -1000, 0));   // x, z, 落ちた時刻, 高さ
  material.uniforms.uRipples = { value: list };
  material.uniforms.uRipTime = { value: 0 };
  const packets = RIPPLE.packets.map(([wl, w, width]) => {
    const K = (2 * Math.PI) / wl, phase = Math.sqrt(9.8 / K);
    return `{
          float env = exp(-pow((r - (${(phase / 2).toFixed(4)} * t + 2.0)) / ${width.toFixed(1)}, 2.0));
          wave += ${w.toFixed(3)} * env * cos(${K.toFixed(5)} * r - ${(K * phase).toFixed(5)} * t);
        }`;
  }).join('');
  const glsl = `
    uniform vec4 uRipples[${RIPPLE.max}];
    uniform float uRipTime;
    varying vec2 vRipGrad;
    float ripH(vec2 xz) {
      float h = 0.0;
      for (int i = 0; i < ${RIPPLE.max}; i++) {
        vec4 q = uRipples[i];
        float t = uRipTime - q.z;
        if (t <= 0.0 || t > ${RIPPLE.life.toFixed(1)} || q.w == 0.0) continue;
        float r = length(xz - q.xy);
        float fade = pow(1.0 - t / ${RIPPLE.life.toFixed(1)}, 2.0);
        float wave = 0.0;${packets}
        wave /= sqrt(1.0 + r / 6.0);
        wave *= 1.0 - exp(-t / 0.8);
        float center = exp(-pow(r / ${RIPPLE.crater.toFixed(1)}, 2.0)) * -cos(t * 2.0) * exp(-t * 0.5);
        h += q.w * fade * (wave + ${RIPPLE.craterDepth.toFixed(2)} * center);
      }
      return h;
    }`;
  material.vertexShader = material.vertexShader
    .replace('void main() {', `${glsl}
    void main() {
      vec4 ripW = modelMatrix * vec4( position, 1.0 );
      float rh = ripH(ripW.xz);
      vRipGrad = vec2(ripH(ripW.xz + vec2(0.25, 0.0)) - rh, ripH(ripW.xz + vec2(0.0, 0.25)) - rh) / 0.25;
      vec3 ripP = position + vec3(0.0, 0.0, rh);`)
    .replace('vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );', 'vec4 mvPosition =  modelViewMatrix * vec4( ripP, 1.0 );');
  material.fragmentShader = material.fragmentShader
    .replace('varying vec4 worldPosition;', 'varying vec4 worldPosition;\nvarying vec2 vRipGrad;')
    .replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );', `vec3 ripN = vec3( -vRipGrad.x, 0.0, -vRipGrad.y ) * 1.5 / ( 1.0 + length( vRipGrad ) * 2.0 );
      vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) + ripN );
      // 映りこみのゆれは少しだけ(大きくゆらすと、映す絵の外=水平線より下を拾って、黒い穴のように見える)
      vec3 mirrorNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) + ripN * 0.3 );`)
    .replace('vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;', 'vec2 distortion = mirrorNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;');
  material.needsUpdate = true;
  return {
    // 波の輪を足す(いちばん弱くなったものと入れかえる)。近い場所・時刻の輪は1つにまとめて、大きいほうの高さにする
    // (体が水に入るあいだ毎こま出るしぶきの波を足しあわせると、大きな穴のようにへこんでしまう)
    // amp がマイナスのときは、まん中がへこまずに、もり上がってから波が広がる(水の中の泡が水を持ち上げるとき)
    add(x, z, amp, now) {
      const size = Math.abs(amp);
      for (const q of list) {
        if (Math.hypot(q.x - x, q.y - z) < 3 && now - q.z < 0.4 && Math.sign(q.w) === Math.sign(amp)) {
          if (size > Math.abs(q.w)) q.w = amp;
          return;
        }
      }
      // あいている輪か、いちばん弱くなった輪を使う(大きなジャンプの波が、小さなしぶきの波に消されないように)
      const left = q => { const t = now - q.z; return t < 0 || t > RIPPLE.life ? 0 : Math.abs(q.w) * (1 - t / RIPPLE.life) ** 2; };
      let weak = list[0];
      for (const q of list) if (left(q) < left(weak)) weak = q;
      if (left(weak) > size) return;
      weak.set(x, z, now, amp);
    },
    time(t) { material.uniforms.uRipTime.value = t; },
  };
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

  // 海の網目: クジラの出るあたりは細かく(波の輪で海面が波打つように)、遠くはあらい
  const grid = rippleGrid([SPOT[0], SPOT[2]]);
  const waterGeo = new THREE.BufferGeometry();
  // 海は x-y の面で作って、あとで寝かせる(世界の z = -y)
  const local = new Float32Array(grid.positions.length);
  for (let i = 0; i < local.length; i += 3) { local[i] = grid.positions[i]; local[i + 1] = -grid.positions[i + 2]; local[i + 2] = 0; }
  waterGeo.setAttribute('position', new THREE.BufferAttribute(local, 3));
  waterGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(local.length).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  waterGeo.setIndex(grid.indices);
  const water = new Water(waterGeo, {
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
  water.material.side = THREE.DoubleSide;
  scene.add(water);
  const tuned = tuneWaterShader(water.material);
  const ripples = addRipples(water.material);

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

  // クジラを目で追う(頭の上を跳ぶクジラを見上げて、ふり返る)。向きは横(yaw)と上下(pitch)の角度で、なめらかに動かす
  // look.want: 見たい場所(なければ、いつもの向き)と強さ(0〜1)。look.seen: そのこまで呼ばれたか
  const look = { yaw: null, pitch: 0, want: null, weight: 0, seen: 0 };
  const anglesTo = (from, to) => {
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    return { yaw: Math.atan2(-d[0], -d[2]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])) };
  };
  function updateLook(dt) {
    const base = anglesTo(preset.position, preset.target);
    if (look.yaw === null) { look.yaw = base.yaw; look.pitch = base.pitch; }
    // しばらく呼ばれなければ、いつもの向きへもどる
    look.seen += dt;
    if (look.seen > 0.5) look.weight = Math.max(0, look.weight - dt);
    let yaw = base.yaw, pitch = base.pitch;
    if (look.want && look.weight > 0) {
      const w = anglesTo(preset.position, look.want);
      let dy = w.yaw - base.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));   // 近いほうへ回る
      yaw = base.yaw + dy * look.weight;
      pitch = base.pitch + (Math.min(1.5, w.pitch) - base.pitch) * look.weight;
    }
    // 速く跳ぶクジラにおくれないよう、すばやく追う
    const k = 1 - Math.exp(-dt * 7);
    let dy = yaw - look.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    look.yaw += dy * k;
    look.pitch += (pitch - look.pitch) * k;
  }
  const looking = () => {
    if (look.yaw === null) return false;
    const b = anglesTo(preset.position, preset.target);
    return look.weight > 0.001 || Math.abs(look.pitch - b.pitch) > 0.002 || Math.abs(Math.atan2(Math.sin(look.yaw - b.yaw), Math.cos(look.yaw - b.yaw))) > 0.002;
  };

  function placeCamera() {
    camera.fov = preset.fov;
    camera.position.set(...preset.position);
    if (look.yaw === null) camera.lookAt(...preset.target);
    else {
      const c = Math.cos(look.pitch);
      camera.lookAt(preset.position[0] - Math.sin(look.yaw) * c, preset.position[1] + Math.sin(look.pitch), preset.position[2] - Math.cos(look.yaw) * c);
    }
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
    look.yaw = null; look.weight = 0; look.want = null;
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
    for (const fn of paletteListeners) fn(palette, s);
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
    ripples.time(elapsed);
    water.material.uniforms.time.value += dt * 0.6;
    sky.update(dt);
    whitecaps.update(dt, camera.position);
    if (shakeAmount > 0.001) shakeAmount *= Math.exp(-dt * 3);
    for (const fn of updaters) fn(dt);
    // クジラを目で追うのは、間近のカメラだけ(崖の上や上空は、いつもの向きのまま)
    if (preset === CAMERA_PRESETS.near) updateLook(dt);
    if (preset.sway || shakeAmount > 0.001 || looking()) placeCamera();
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
    // 海面の波の輪(x, z: 場所、amp: 高さ m)
    addRipple: (x, z, amp) => ripples.add(x, z, amp, elapsed),
    // クジラを目で追う(point: 見る場所、weight: 0〜1)。毎こま呼ぶ。呼ばなくなると、いつもの向きへもどる
    look: (point, weight = 1) => { if (reduceMotion) return; look.want = point; look.weight = Math.max(0, Math.min(1, weight)); look.seen = 0; },
    // 画面を揺らす(0〜1)。動きを減らす設定の端末では揺らさない
    shake: amount => { if (!reduceMotion) shakeAmount = Math.max(shakeAmount, amount); },
    // 海面に貼りつけるもの(映り込みには描かない)を足す
    addSurfaceDecal: obj => { surfaceDecals.push(obj); scene.add(obj); },
    // 海の映り込みには描かないもの(しぶきや泡の粒。映り込みの絵の中では、暗いかたまりになってしまう)
    hideInMirror: obj => { surfaceDecals.push(obj); },
    // 時刻が変わったときに呼んでほしい処理(空の色を使うもの)を登録する
    onPalette: fn => paletteListeners.push(fn),
  };
}
