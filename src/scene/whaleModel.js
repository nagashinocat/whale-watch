import * as THREE from 'three';
import { buildWhaleGeometry, SWIM, strokesPerSecond, WHALE_SPECS, jawHinge, JAW_MOVE, POUCH_SWELL, POUCH_SIDEWAYS, ENGULF, BODY_GRID, ringU, aroundTheta, bodyPoint, flukeOutline } from '../logic/whaleShape.js';
import { traitBodyColor, traitFinColor, flukeBite, FLUKE_BITE } from '../logic/traits.js';
import { specialMotif } from '../logic/specialCoats.js';
import { buildFeatures } from '../logic/features3d.js';
import { eyePatch, applyLid, eyeballPlacement, blinkOpen, EYE } from '../logic/eyeShape.js';
import { flukeWhiteness } from '../logic/flukeId.js';
import { MODEL, modelLayout, individualColors, specialAssets, eyeSpots, modelPouch, smoothOverMesh, shapeForIndividual, flukeEdge, toLinear as modelLinear } from '../logic/whaleModelLayout.js';

// 目の玉に映る空と海の色(時刻で変わる。setEyeLight で変える)
const eyeUniforms = {
  uZenith: { value: new THREE.Color(0x2557cc) },
  uHorizon: { value: new THREE.Color(0x90b6ef) },
  uSea: { value: new THREE.Color(0x0a4f8a) },
  uDay: { value: 1 },
};
// とくべつな子の模様が光る強さ(夜 1、昼 0)と、またたきの時計。すべてのクジラで同じ値を使う
const GLOW = { uGlow: { value: 0 }, uGlowTime: { value: 0 } };
// 夜の画面はとても暗く写す(明るさの倍率が小さい)ので、そのぶん強く光らせる
const GLOW_POWER = 7;
export function setWhaleGlow(level) {
  GLOW.uGlow.value = Math.max(0, Math.min(1, level)) * GLOW_POWER;
}

export function setEyeLight(palette) {
  eyeUniforms.uZenith.value.set(palette.zenith);
  eyeUniforms.uHorizon.value.set(palette.horizon);
  eyeUniforms.uSea.value.set(palette.water);
  // 明るいときは、ひとみが細くなる(U字)
  const z = new THREE.Color(palette.zenith);
  eyeUniforms.uDay.value = THREE.MathUtils.smoothstep(0.2 * z.r + 0.7 * z.g + 0.1 * z.b, 0.01, 0.12);
}

// 目の玉。茶色の虹彩、そのまわりの白っぽい輪、明るいとU字になるひとみ。
// 表面はぬれてつやがあり、空と海が映りこむ
let eyeballMaterial = null;
function eyeMaterial() {
  if (eyeballMaterial) return eyeballMaterial;
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 });
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, eyeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEyePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEyePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vEyePos;
        uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSea; uniform float uDay;`)
      .replace('#include <map_fragment>', `
        vec3 ep = normalize(vEyePos);
        float er = length(ep.xy);
        vec3 eyeCol = vec3(0.62, 0.66, 0.68);                         // 白っぽい輪
        float irisR = 0.62;
        float iris = (1.0 - smoothstep(irisR - 0.03, irisR + 0.01, er)) * step(0.0, ep.z);
        float ang = atan(ep.y, ep.x);
        float fib = 0.72 + 0.28 * sin(ang * 70.0 + 2.0 * sin(ang * 13.0)) * (0.6 + 0.4 * sin(er * 40.0));
        vec3 irisCol = mix(vec3(0.11, 0.045, 0.022), vec3(0.26, 0.12, 0.055), smoothstep(0.15, 0.55, er)) * fib;
        irisCol *= 1.0 - 0.55 * smoothstep(irisR - 0.12, irisR, er);  // 虹彩のふちは暗い
        eyeCol = mix(eyeCol, irisCol, iris);
        // ひとみ: 横長の楕円。明るいときは上から幕が下りて、U字に残る
        float pupil = 1.0 - smoothstep(0.92, 1.05, length(vec2(ep.x / 0.36, (ep.y + 0.03) / 0.24)));
        float lidOver = 1.0 - smoothstep(0.92, 1.05, length(vec2(ep.x / 0.27, (ep.y - 0.11) / 0.22)));
        pupil *= (1.0 - lidOver * uDay) * step(0.0, ep.z);
        eyeCol = mix(eyeCol, vec3(0.004), pupil);
        diffuseColor.rgb = eyeCol;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // ぬれた目に映る空(上)と海(下)
          vec3 V = normalize(vViewPosition);
          vec3 Rw = (vec4(reflect(-V, normal), 0.0) * viewMatrix).xyz;
          vec3 env = Rw.y > 0.0 ? mix(uHorizon, uZenith, smoothstep(0.0, 0.7, Rw.y)) : uSea * 0.6;
          env *= 1.0 + 0.6 * (1.0 - smoothstep(0.0, 0.06, abs(Rw.y)));   // 水平線のあたりは明るい
          float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(normal, V), 0.0, 1.0), 5.0);
          totalEmissiveRadiance += env * (0.1 + 0.9 * fres) * 0.5;
        }`);
  };
  eyeballMaterial = m;
  return m;
}

// 色は sRGB で作ってあるので、体と同じように three.js の計算用の色に直す(左右それぞれ一度だけ)
const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function linearColors(patch, ind = null) {
  if (!ind || !ind.traits) {
    if (!patch.linear) patch.linear = Float32Array.from(patch.colors, toLinear);
    return patch.linear;
  }
  patch.byIndividual ??= new Map();
  if (!patch.byIndividual.has(ind.id)) {
    const c = Float32Array.from(patch.colors);
    for (let k = 0; k < c.length / 3; k++) {
      const rgb = [c[k * 3], c[k * 3 + 1], c[k * 3 + 2]];
      // まぶたの奥の暗い影はそのまま
      if (rgb[0] + rgb[1] + rgb[2] < 0.1 && ind.traits.coat !== 'white') continue;
      const out = traitBodyColor(ind, patch.uv[k * 2], patch.uv[k * 2 + 1], rgb);
      const shade = rgb[0] + rgb[1] + rgb[2] < 0.1 ? 0.35 : 1;   // 白い子も、まぶたの奥は少し暗く
      c.set(out.map(v => v * shade), k * 3);
    }
    patch.byIndividual.set(ind.id, Float32Array.from(c, toLinear));
  }
  return patch.byIndividual.get(ind.id);
}

// 目のまわりの肌(左右)。形の計算に時間がかかるので、一度だけ作って使い回す
let eyePatches = null;
function patchesFor() {
  if (!eyePatches) eyePatches = [1, -1].map(side => ({ side, patch: eyePatch(side), place: eyeballPlacement(side) }));
  return eyePatches;
}

// 1頭ぶんの目(左右)。まぶたは頭の肌と同じ material で描く(泳ぐしなりもいっしょ)
function createEyes(parent, skinMaterial, individual = null) {
  const eyes = patchesFor().map(({ patch, place }) => {
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(applyLid(new Float32Array(patch.base.length), patch, EYE.relaxedOpen), 3);
    geo.setAttribute('position', pos);
    geo.setAttribute('color', new THREE.BufferAttribute(linearColors(patch, individual), 3));
    geo.setAttribute('aJaw', new THREE.BufferAttribute(patch.jaw, 4));
    geo.setIndex(new THREE.BufferAttribute(patch.indices, 1));
    geo.computeVertexNormals();
    const skin = new THREE.Mesh(geo, skinMaterial);
    parent.add(skin);
    // 目の玉: x が体の前後、y が背中の向き、z が外向き
    const pivot = new THREE.Group();
    pivot.position.fromArray(place.eyeCenter);
    const [bx, by, bz] = place.basis.map(v => new THREE.Vector3(...v));
    pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(bx, by, bz));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(place.radius, 64, 48), eyeMaterial());
    pivot.add(ball);
    parent.add(pivot);
    return { patch, geo, pos, ball, open: EYE.relaxedOpen };
  });

  let blinking = false, blinkT = 0, nextBlink = 4 + Math.random() * 6;
  let baseOpen = EYE.relaxedOpen;
  let look = { x: 0, y: 0, tx: 0, ty: 0, next: 1 };

  function setOpen(open) {
    for (const e of eyes) {
      if (Math.abs(e.open - open) < 0.003) continue;
      e.open = open;
      applyLid(e.pos.array, e.patch, open);
      e.pos.needsUpdate = true;
      e.geo.computeVertexNormals();
    }
  }

  return {
    // まばたきと目の動きをするか(近くで見せる出方のときだけ。計算を軽くするため)
    alive: false,
    setBaseOpen(v) { baseOpen = v; },
    update(dt) {
      if (!this.alive) return;
      nextBlink -= dt;
      if (!blinking && nextBlink <= 0) { blinking = true; blinkT = 0; }
      if (blinking) {
        blinkT += dt;
        if (blinkT > 1.2) { blinking = false; nextBlink = 5 + Math.random() * 7; }
      }
      setOpen(blinking ? blinkOpen(blinkT, baseOpen) : baseOpen);
      // 目の玉は、ときどき少しだけ向きを変える
      look.next -= dt;
      if (look.next <= 0) {
        look.tx = (Math.random() - 0.5) * 0.12; look.ty = (Math.random() - 0.5) * 0.08;
        look.next = 1.5 + Math.random() * 2.5;
      }
      const k = 1 - Math.exp(-dt * 8);
      look.x += (look.tx - look.x) * k; look.y += (look.ty - look.y) * k;
      for (const e of eyes) e.ball.rotation.set(-look.y, look.x, 0);
    },
  };
}

// 計算で作ったクジラの形を three.js の物体にする。泳ぐしなりは画面の部品(シェーダー)で動かす。

const geometries = {};

function geometryFor(kind) {
  if (geometries[kind]) return geometries[kind];
  const g = buildWhaleGeometry(kind);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
  // 色は sRGB で作ってあるので、three.js の計算用の色に直す
  const linear = new Float32Array(g.colors.length);
  const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  for (let i = 0; i < linear.length; i++) linear[i] = toLinear(g.colors[i]);
  geo.setAttribute('color', new THREE.BufferAttribute(linear, 3));
  geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
  geo.setAttribute('aJaw', new THREE.BufferAttribute(g.jaw, 4));
  geo.computeVertexNormals();
  geo.userData = { fluke: g.fluke, fins: g.fins, bodyCount: g.bodyCount, srgb: g.colors, raw: g };
  geometries[kind] = geo;
  return geo;
}

// 1頭ずつちがう形と色(尾びれの裏の模様、体の色、胸びれの色、背びれの形、尾びれの欠け)。
// 形は同じものを使い回し、ちがうところだけ作りなおす。一度作ったら覚えておく
const individualGeometries = new Map();
const HB_WHITE = [0xe6 / 255, 0xe8 / 255, 0xea / 255], HB_BACK = [0x16 / 255, 0x18 / 255, 0x1b / 255];
const ALBINO = [0.93, 0.92, 0.9];
function geometryForIndividual(kind, ind) {
  const base = geometryFor(kind);
  if (!ind || kind !== 'humpback') return base;
  if (individualGeometries.has(ind.id)) return individualGeometries.get(ind.id);
  const t = ind.traits ?? {};
  const { fluke, fins, bodyCount, srgb } = base.userData;
  const reshape = (t.dorsal && t.dorsal !== 'normal') || t.fluke === 'bite';
  const geo = new THREE.BufferGeometry();
  geo.setIndex(base.index);
  for (const [name, attr] of Object.entries(base.attributes)) {
    if (name === 'color' || (reshape && (name === 'position' || name === 'normal'))) continue;
    geo.setAttribute(name, attr);
  }
  // 色(sRGB で決めてから、計算用の色に直す)
  const c = Float32Array.from(srgb);
  const put = (k, rgb) => { c[k * 3] = rgb[0]; c[k * 3 + 1] = rgb[1]; c[k * 3 + 2] = rgb[2]; };
  const get = k => [c[k * 3], c[k * 3 + 1], c[k * 3 + 2]];
  const A = BODY_GRID.around;
  for (let k = 0; k < bodyCount; k++) put(k, traitBodyColor(ind, ringU(Math.floor(k / A)), aroundTheta(k % A), get(k)));
  if (t.coat === 'white') put(bodyCount, ALBINO), put(bodyCount + 1, ALBINO);
  for (const f of fins) for (let k = 0; k < f.s.length; k++) put(f.start + k, traitFinColor(ind, f.s[k], !!f.top[k], get(f.start + k)));
  for (let k = 0; k < fluke.s.length; k++) {
    if (fluke.under[k]) {
      const w = flukeWhiteness(ind, fluke.s[k], fluke.c[k]);
      put(fluke.start + k, HB_BACK.map((v, m) => v + (HB_WHITE[m] - v) * w));
    } else if (t.coat === 'white') put(fluke.start + k, ALBINO);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c.map(toLinear), 3));
  // とくべつな子: 模様の光(計算用の色 × 強さ)と、またたきのずれ
  if (ind.special) {
    const glow = new Float32Array((c.length / 3) * 4);
    for (let k = 0; k < bodyCount; k++) {
      const m = specialMotif(t.coat, ringU(Math.floor(k / A)), aroundTheta(k % A));
      if (m.glow <= 0) continue;
      glow.set([...m.color.map(v => toLinear(v) * m.glow), m.twinkle], k * 4);
    }
    geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 4));
  }
  // 形: 背びれの形と、尾びれのうしろのふちの欠け
  if (reshape) {
    const p = Float32Array.from(base.attributes.position.array);
    if (t.dorsal && t.dorsal !== 'normal') {
      for (let k = 0; k < bodyCount; k++) {
        const u = ringU(Math.floor(k / A));
        if (u < 0.56 || u > 0.72) continue;
        p.set(bodyPoint(kind, u, aroundTheta(k % A), t.dorsal), k * 3);
      }
    }
    if (t.fluke === 'bite') {
      for (let k = 0; k < fluke.s.length; k++) {
        const s = fluke.s[k], bite = flukeBite(ind, s);
        if (bite <= 0.0005) continue;
        const o = flukeOutline(kind, Math.min(1, Math.abs(s)));
        const lead = o.leading, trail = Math.max(lead, o.trailing);
        const trail2 = Math.max(lead + 0.003, trail - bite);
        p[(fluke.start + k) * 3 + 2] = lead + fluke.c[k] * (trail2 - lead);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.computeVertexNormals();
  }
  individualGeometries.set(ind.id, geo);
  return geo;
}

// 形のある特徴(フジツボ、盛り上がった傷あと)の網目。1頭ずつ作って覚えておく
const featureGeometries = new Map();
function featuresFor(kind, ind) {
  if (kind !== 'humpback' || !ind) return null;
  if (featureGeometries.has(ind.id)) return featureGeometries.get(ind.id);
  const f = buildFeatures(geometryFor(kind).userData.raw, ind);
  let geo = null;
  if (f.indices.length) {
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(f.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(f.colors.map(toLinear), 3));
    geo.setAttribute('aJaw', new THREE.BufferAttribute(f.jaw, 4));
    geo.setIndex(new THREE.BufferAttribute(f.indices, 1));
    geo.computeVertexNormals();
  }
  featureGeometries.set(ind.id, geo);
  return geo;
}

// ---- 3Dモデルのザトウクジラ(assets/models/humpback.glb) ----
// 読みこめたら、ザトウクジラはこのモデルで出す(読みこめないときは、これまでの計算で作ったクジラ)。
// 泳ぐしなり・あごの動き・夜に光る模様は、これまでと同じ描き方(シェーダー)にのせる。
let model = null;
let modelLoading = null;
export function loadWhaleModel() {
  if (!modelLoading) modelLoading = (async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(MODEL.url);
    let src = null, mouth = null;
    gltf.scene.traverse(o => { if (o.isMesh) { if (o.name === 'mouth') mouth = o; else src = o; } });
    const geo = src.geometry;
    const layout = modelLayout(geo.attributes.position.array, geo.attributes.normal.array);
    const eyes = eyeSpots(geo.attributes.position.array, geo.attributes.normal.array);
    // あごの重み(口の線で切ったときに決めてある)に、のどのふくらみを足す
    const jaw = Float32Array.from(geo.attributes._jaw.array);
    // ふくらみの重みは、網目でとなりとなじませる(段々や、胸びれのつけ根の裂け目が出ないように)
    const P = geo.attributes.position.array, IX = geo.index.array;
    const rawPouch = modelPouch(layout);
    const pouch = smoothOverMesh(rawPouch, P, IX, 3);
    // なじませると山が少し低くなるので、もとのいちばん大きいふくらみにそろえる
    const peak = rawPouch.reduce((m, v) => Math.max(m, v), 0) / Math.max(1e-6, pouch.reduce((m, v) => Math.max(m, v), 0));
    for (let i = 0; i < pouch.length; i++) pouch[i] = Math.min(1, pouch[i] * peak);
    // 畝の筋を描く角度も、となりとなじませる(筋がぎざぎざに折れないように)
    const sn = smoothOverMesh(layout.theta.map(Math.sin), P, IX, 2), cs = smoothOverMesh(layout.theta.map(Math.cos), P, IX, 2);
    const theta = new Float32Array(sn.length);
    for (let i = 0; i < theta.length; i++) theta[i] = (Math.atan2(sn[i], cs[i]) + Math.PI * 2) % (Math.PI * 2);
    for (let i = 0; i < pouch.length; i++) jaw[i * 4 + 2] = pouch[i];
    // 口の中: あごの重みを aJaw に
    const mouthGeo = mouth.geometry;
    mouthGeo.setAttribute('aJaw', mouthGeo.attributes._jaw);
    mouthGeo.setAttribute('aM', mouthGeo.attributes._m);
    mouthGeo.computeVertexNormals();
    const m = src.material;
    model = {
      geo, layout, eyes, mouthGeo,
      maps: { map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap },
      jaw: new THREE.BufferAttribute(jaw, 4),
      lid: geo.attributes._lid,
      theta: new THREE.BufferAttribute(theta, 1),
      eyeSkin: geo.attributes._eyeskin.array,
      specials: {},
    };
    return model;
  })().catch(err => { console.warn('クジラのモデルを読みこめませんでした。計算で作ったクジラを使います', err); return null; });
  return modelLoading;
}
export const whaleModelReady = () => !!model;

// とくべつな子の素材(模様の画像・頂点の色・体の上に重ねる部品)。はじめて出るときに読みこむ
function specialLook(coat, style) {
  const key = `${coat}-${style}`;
  if (model.specials[key]) return model.specials[key];
  const a = specialAssets(coat, style);
  const look = { texture: null, colors: null, decor: null, kind: a.texture ? 'texture' : a.colors ? 'colors' : 'decor', waiting: [] };
  const ready = () => { for (const fn of look.waiting.splice(0)) fn(); };
  if (a.texture) {
    look.texture = new THREE.TextureLoader().load(a.texture);
    look.texture.colorSpace = THREE.SRGBColorSpace;
    look.texture.flipY = false;   // glTF のテクスチャと同じ向き
  } else if (a.colors) {
    fetch(a.colors).then(r => r.arrayBuffer()).then(buf => {
      const rgb = new Uint8Array(buf);
      const lin = new Float32Array(rgb.length);
      for (let i = 0; i < rgb.length; i++) lin[i] = modelLinear(rgb[i] / 255);
      look.colors = lin;
      ready();
    }).catch(() => {});
  } else {
    import('three/addons/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(a.decor))
      .then(g => { g.scene.traverse(o => { if (o.isMesh) look.decor = o.geometry; }); ready(); })
      .catch(() => {});
  }
  model.specials[key] = look;
  return look;
}

// 体の上に重ねる部品(彗星の頭・尾・光の粒)。体と同じしなりで動き、夜は明るく光る
function decorMesh(look, uniforms) {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  material.onBeforeCompile = shader => {
    shader.uniforms.uPhase = uniforms.uPhase;
    shader.uniforms.uSwim = uniforms.uSwim;
    shader.uniforms.uGlow = GLOW.uGlow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uPhase;
        uniform float uSwim;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float swimS = clamp(position.z + 0.5, 0.0, 1.0);
        transformed.y += uSwim * ${SWIM.amplitude.toFixed(4)} * pow(swimS, ${SWIM.power.toFixed(2)})
          * sin(uPhase - ${SWIM.wave.toFixed(2)} * swimS);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uGlow;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 0.8 + 0.25 * uGlow;`);
  };
  material.customProgramCacheKey = () => 'whale-decor';
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.frustumCulled = false;
  const attach = () => { mesh.geometry = look.decor; };
  if (look.decor) attach(); else look.waiting.push(attach);
  return mesh;
}

// 口の中の模様(計算で描く)。aM = [場所の種類, 前後(口先 0 〜 口の端 1), 横または上下(0〜1)]
//   1 天井: まん中にピンクの盛り上がり(上あごの骨のすじ)、左右はひげ板のつけ根で黒い
//   2 ひげ板: つけ根は黒く、先へいくほど茶色い毛(ふさ)になって、ばらばらにほつれる
//   3 舌と口の底: ピンクに、まだらと、しわ
//   4 のどの奥: 暗い赤
function mouthDetail(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 aM;\nvarying vec3 vM;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvM = aM;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vM;
      float mh(float x) { return fract(sin(x * 127.1) * 43758.5453); }
      float mn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        float a = mh(i.x + i.y * 57.0), b = mh(i.x + 1.0 + i.y * 57.0), c = mh(i.x + (i.y + 1.0) * 57.0), d = mh(i.x + 1.0 + (i.y + 1.0) * 57.0);
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float region = floor(vM.x + 0.5), s = vM.y, t = vM.z;
        vec3 col = diffuseColor.rgb;
        if (region == 1.0) {
          float keel = 1.0 - smoothstep(0.08, 0.32, abs(t - 0.5));
          col = mix(vec3(0.02, 0.016, 0.014), vec3(0.50, 0.17, 0.17), keel);
          col *= 0.8 + 0.4 * mn(vec2(s * 40.0, t * 12.0));
        } else if (region == 2.0) {
          // 板1枚ずつの筋と、毛のほつれ
          float plate = 0.6 + 0.4 * smoothstep(0.2, 0.8, mn(vec2(s * 420.0, t * 2.0)));
          float hair = mn(vec2(s * 900.0 + t * 40.0, t * 18.0));
          float fringe = smoothstep(0.25, 0.95, t);
          vec3 root = vec3(0.012, 0.010, 0.009), tuft = vec3(0.20, 0.12, 0.065);
          col = mix(root, tuft * (0.55 + 0.75 * hair), fringe) * plate;
          if (t > 0.85 && hair < (t - 0.85) * 5.0) discard;   // 先は毛がほつれて、すきまがある
        } else if (region == 3.0) {
          float m = mn(vec2(s * 30.0, t * 20.0)), w = mn(vec2(s * 120.0, t * 6.0));
          float center = 1.0 - smoothstep(0.1, 0.48, abs(t - 0.5));
          // 舌のまん中のくぼみと、前後にのびるしわ。ふちの歯ぐきは暗い
          float groove = 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.06, abs(t - 0.5)));
          float folds = 0.94 + 0.06 * sin(t * 38.0 + sin(s * 9.0) * 2.5 + m * 3.0);
          col = mix(vec3(0.14, 0.06, 0.06), vec3(0.55, 0.22, 0.21), center) * (0.8 + 0.3 * m) * (0.9 + 0.15 * w) * groove * folds;
        } else if (region == 4.0) {
          col = vec3(0.05, 0.012, 0.012) * (0.7 + 0.5 * mn(vec2(s * 10.0, t * 10.0)));
        }
        diffuseColor.rgb = col;
      }`);
}

// モデルの目(左右)。モデルの目のくぼみに、これまでと同じ目の玉(空と海が映る、明るいとひとみがU字)をはめ、
// 上まぶたを、目の玉にかぶさる殻にして、前へ回して閉じる(まばたき)
function createModelEyes(parent, individual, uniforms) {
  const r = MODEL.eye.radius;
  const eyes = model.eyes.map(({ point, normal }) => {
    const out = new THREE.Vector3(...normal);
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(out, -out.y).normalize();
    const side = new THREE.Vector3().crossVectors(up, out);
    const pivot = new THREE.Group();
    pivot.position.fromArray(point).addScaledVector(out, -r * 1.05);   // 目の玉は、目の開きから少しだけのぞく
    pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, out));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), eyeMaterial());
    pivot.add(ball);
    parent.add(pivot);
    return { ball };
  });
  let blinking = false, blinkT = 0, nextBlink = 4 + Math.random() * 6;
  let baseOpen = EYE.relaxedOpen;
  const look = { x: 0, y: 0, tx: 0, ty: 0, next: 1 };
  // まぶたは体の肌そのもの。閉じぐあいをシェーダーに渡す(0 で開き、1 で閉じる)
  const setOpen = open => { uniforms.uLid.value = 1 - open; };
  setOpen(baseOpen);
  return {
    alive: false,
    setBaseOpen(v) { baseOpen = v; if (!this.alive) setOpen(v); },
    update(dt) {
      if (!this.alive) return;
      nextBlink -= dt;
      if (!blinking && nextBlink <= 0) { blinking = true; blinkT = 0; }
      if (blinking) {
        blinkT += dt;
        if (blinkT > 1.2) { blinking = false; nextBlink = 5 + Math.random() * 7; }
      }
      setOpen(blinking ? blinkOpen(blinkT, baseOpen) : baseOpen);
      look.next -= dt;
      if (look.next <= 0) {
        look.tx = (Math.random() - 0.5) * 0.12; look.ty = (Math.random() - 0.5) * 0.08;
        look.next = 1.5 + Math.random() * 2.5;
      }
      const k = 1 - Math.exp(-dt * 8);
      look.x += (look.tx - look.x) * k; look.y += (look.ty - look.y) * k;
      for (const e of eyes) e.ball.rotation.set(-look.y, look.x, 0);
    },
  };
}

// 1頭ぶんの網目(形は使い回し、色だけその子のもの)
const modelGeometries = new Map();
function modelGeometryFor(ind) {
  const key = ind ? `${ind.id}` : 'plain';
  if (modelGeometries.has(key)) return modelGeometries.get(key);
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) g.setAttribute(name, model.geo.attributes[name]);
  g.setIndex(model.geo.index);
  // 背びれ・尾びれの形の個性があれば、その子だけ形を変える(向き=法線はそのまま使う。変わる量が小さいので)
  const shaped = ind ? shapeForIndividual(model.geo.attributes.position.array, model.layout, ind) : null;
  if (shaped) g.setAttribute('position', new THREE.BufferAttribute(shaped, 3));
  g.setAttribute('aJaw', model.jaw);
  g.setAttribute('aLid', model.lid);
  g.setAttribute('aTheta', model.theta);   // 体のまわりの角度(のどの畝の筋を描くため)
  // 尾びれのうしろのふちの欠け: ふちまでの長さを持たせて、欠けの中をけずる(useModelLook)
  if (ind?.traits?.fluke === 'bite') g.setAttribute('aFluke', new THREE.BufferAttribute(flukeEdge(model.geo.attributes.position.array, model.layout), 2));
  const n = model.geo.attributes.position.count;
  let color, mix, base;
  if (ind && !ind.special) ({ color, mix, base } = individualColors(ind, model.layout));
  else { color = new Float32Array(n * 3).fill(1); mix = new Float32Array(n); base = new Float32Array(n).fill(1); }
  // まぶたの網目: 色は頂点ごとに写しとったもの(真っ白な子は、その子の色のまま)
  const skin = model.eyeSkin;
  if (ind?.traits?.coat !== 'white') {
    for (let i = 0; i < n; i++) {
      if (skin[i * 4 + 3] <= 0) continue;
      color[i * 3] = skin[i * 4]; color[i * 3 + 1] = skin[i * 4 + 1]; color[i * 3 + 2] = skin[i * 4 + 2];
      mix[i] = 1; base[i] = skin[i * 4 + 3];
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setAttribute('aMix', new THREE.BufferAttribute(mix, 1));
  g.setAttribute('aBase', new THREE.BufferAttribute(base, 1));
  g.boundingSphere = model.geo.boundingSphere;
  modelGeometries.set(key, g);
  return g;
}

// 宇宙版のとくべつな子: 頂点の色が届いたら、その子の網目に入れる
function cosmicGeometry(ind, look) {
  const key = `${ind.id}-cosmic`;
  if (modelGeometries.has(key)) return modelGeometries.get(key);
  const g = modelGeometryFor(null).clone();
  const n = g.attributes.position.count;
  g.setAttribute('aMix', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  g.setAttribute('aBase', new THREE.BufferAttribute(new Float32Array(n).fill(0.03), 1));
  const apply = () => g.setAttribute('color', new THREE.BufferAttribute(look.colors, 3));
  if (look.colors) apply(); else look.waiting.push(apply);
  modelGeometries.set(key, g);
  return g;
}

// これまでのクジラの描き方(material)に、モデルのテクスチャと、その子の色と、夜の光をのせる
function useModelLook(material, ind, uniforms) {
  const special = !!ind?.special;
  const look = special ? specialLook(ind.traits.coat, ind.traits.style ?? 'fantasy') : null;
  // fantasy: 模様の画像 / cosmic: 頂点の色 / real: ふつうのテクスチャ(彗星の子は、体はふつう)
  const style = !look ? 'real' : look.kind === 'texture' ? 'fantasy' : look.kind === 'colors' ? 'cosmic' : 'real';
  material.map = style === 'fantasy' ? look.texture : model.maps.map;
  material.normalMap = model.maps.normalMap;
  material.roughnessMap = model.maps.roughnessMap;
  material.roughness = 0.85;
  const bite = ind?.traits?.fluke === 'bite';
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = shader => {
    prev(shader);
    shader.uniforms.uGlow = GLOW.uGlow;
    shader.uniforms.uGlowTime = GLOW.uGlowTime;
    shader.uniforms.uLid = uniforms.uLid;
    if (bite) shader.uniforms.uBite = { value: new THREE.Vector2(ind.traits.bitePlace, FLUKE_BITE.depth) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aMix;
        attribute float aBase;
        attribute vec3 aLid;
        uniform float uLid;
        varying float vMix;
        varying float vBase;${bite ? '\n        attribute vec2 aFluke;\n        varying vec2 vFluke;' : ''}`)
      // まぶた: 閉じぐあい uLid(0 で開き、1 で閉じる)だけ、まぶたの肌を動かす
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += uLid * aLid;
        vMix = aMix; vBase = aBase;
        vLocal = position; vTheta = aTheta;${bite ? '\n        vFluke = aFluke;' : ''}`)
      .replace('varying float vMix;', 'varying float vMix;\n        attribute float aTheta;\n        varying float vTheta;\n        varying vec3 vLocal;\n        varying float vStretch;')
      // ふくらんだのどは、畝の細かいでこぼこがのびて平らになる: 面の向きを、ふくらむ向きへ寄せる
      .replace('vJaw = aJaw;', `vJaw = aJaw;
        if (uPouch > 0.0 && aJaw.z > 0.0) {
          vec2 pr = vec2(position.x, position.y + 0.02);
          vec3 pd = normalize(vec3(pr.x / max(length(pr), 1e-4) * ${POUCH_SIDEWAYS.toFixed(4)}, -1.0, 0.0));
          float sm = clamp(uPouch * aJaw.z * 2.5, 0.0, 0.85);
          objectNormal = normalize(mix(objectNormal, pd, sm));
          vStretch = sm;
        } else vStretch = 0.0;`);
    // 口の中は本物の網目で作ってあるので、体の色を口の中の色に塗りかえない。体の内側(裏の面)だけ、のどの奥の暗い色にする
    shader.fragmentShader = shader.fragmentShader
      .replace('float inside = gl_FrontFacing ? inMouth : jawPart;', 'float inside = gl_FrontFacing ? 0.0 : 1.0; opened = 1.0;')
      .replace('vec3 mouthCol = mix(baleen, tongue, smoothstep(0.35, 0.75, vJaw.w));', 'vec3 mouthCol = vec3(0.03, 0.012, 0.012);')
      // のどがふくらむと、白い畝のあいだのみぞが開いて、ピンクの筋が見える
      .replace('diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.5, 0.48), 0.45 * uPouch * vJaw.z * vJaw.w);', `{
          // 筋は、おなか側のまん中あたりだけ(胸びれのつけ根の近くは、角度が急に変わるので描かない)
          float belly = 1.0 - smoothstep(0.9, 1.3, abs(vTheta - 3.14159265));
          float stretch = clamp(uPouch * vJaw.z * 1.6, 0.0, 1.0) * belly * smoothstep(0.08, 0.2, vJaw.z);
          // 畝は頭から尾の向きにのびる筋。ゆるやかに波打ち、ところどころで分かれる
          float ang = vTheta - 3.14159265;
          float k = ang * ${(MODEL.grooves / Math.PI).toFixed(3)} + 0.12 * sin(vLocal.z * 35.0 + ang * 2.0);
          float g = abs(fract(k) - 0.5) * 2.0;          // 0 が畝のまん中、1 がみぞ
          // のびた畝の肌は、テクスチャのでこぼこが引きのばされるので、白い畝の色にかえる
          vec3 ridge = vec3(0.66, 0.68, 0.70) * (0.82 + 0.18 * (1.0 - g));
          diffuseColor.rgb = mix(diffuseColor.rgb, ridge, smoothstep(0.05, 0.4, stretch) * 0.85);
          float open = smoothstep(1.0 - 0.7 * stretch, 1.02 - 0.55 * stretch, g) * step(0.01, stretch);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.50, 0.15, 0.15), open * 0.92);
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vMix;
        varying vec3 vLocal;
        varying float vTheta;
        varying float vStretch;
        varying float vBase;
        uniform float uGlow;
        uniform float uGlowTime;${bite ? '\n        varying vec2 vFluke;\n        uniform vec2 uBite;' : ''}`)
      // 色がふつうの子と同じところはテクスチャのまま。ちがうところは、テクスチャの明るさのむら(しわや陰)だけを使って、その子の色にする
      .replace('#include <map_fragment>', `${bite ? `
        // 尾びれのうしろのふちの欠け(深さ uBite.y、場所 uBite.x)。欠けの中は描かない
        float biteD = uBite.y * exp(-pow((vFluke.x - uBite.x) / ${FLUKE_BITE.width.toFixed(3)}, 2.0));
        if (biteD > 0.0005 && vFluke.y < biteD) discard;` : ''}
        vec4 texel = texture2D(map, vMapUv);
        float texLum = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 ownCol = vec3(clamp(texLum / vBase, 0.35, 1.8)) * vColor.rgb;
        diffuseColor.rgb *= mix(texel.rgb, ownCol, vMix);`)
      .replace('#include <color_fragment>', '')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, vStretch));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${style === 'fantasy' ? `
        // ファンタジー版: 模様の明るいところだけが、夜に光る
        totalEmissiveRadiance += texel.rgb * smoothstep(0.06, 0.3, texLum) * uGlow * 1.2;` : ''}${style === 'cosmic' ? `
        // 宇宙版: 色の明るいところだけが、夜に光って、ゆっくりまたたく
        float glowLum = dot(vColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        totalEmissiveRadiance += vColor.rgb * smoothstep(0.04, 0.3, glowLum) * uGlow * 1.2 * (0.8 + 0.2 * sin(uGlowTime * 1.7 + vMapUv.x * 40.0));` : ''}`);
  };
  material.customProgramCacheKey = () => `whale-model-${style}${bite ? '-bite' : ''}`;
  material.needsUpdate = true;
  return { style, look };
}

// 形の計算には少し時間がかかるので、クジラが出てくる前にすませておく
export function prepareWhaleGeometry() {
  geometryFor('humpback');
  geometryFor('sperm');
  patchesFor();
}

// 1頭ぶんのクジラ。lengthMeters は体長(m)。頭は -z を向いている
// individual: 尾びれの裏の模様で見分けられる1頭(flukeId.js)。なければ、ふつうの模様
export function createWhaleMesh(kind, lengthMeters = WHALE_SPECS[kind].lengthMeters, { individual = null } = {}) {
  const uniforms = {
    uPhase: { value: Math.random() * Math.PI * 2 }, uSwim: { value: 1 },
    // 口の開き(下あご・上あごの角度、ラジアン)と、のどのふくらみ(0〜1)
    uLowerJaw: { value: 0 }, uUpperJaw: { value: 0 }, uPouch: { value: 0 },
    uLid: { value: 1 - EYE.relaxedOpen },   // まぶたの閉じぐあい(3Dモデルのとき)
  };
  const useModel = kind === 'humpback' && !!model;
  const [hingeY, hingeZ] = useModel ? MODEL.hinge : kind === 'humpback' ? jawHinge(kind) : [0, 0];
  // とくべつな子は、夜に模様が光る
  const glows = !useModel && kind === 'humpback' && !!individual?.special;
  const f = v => v.toFixed(5);
  // ぬれた肌は少しつやがある。重い描き方(二重のつや)はやめて、つるつる具合だけで出す
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.34,
    metalness: 0,
    side: THREE.DoubleSide,    // ひれは薄いので両面を描く
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uPhase = uniforms.uPhase;
    shader.uniforms.uSwim = uniforms.uSwim;
    shader.uniforms.uLowerJaw = uniforms.uLowerJaw;
    shader.uniforms.uUpperJaw = uniforms.uUpperJaw;
    shader.uniforms.uPouch = uniforms.uPouch;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uPhase;
        uniform float uSwim;
        uniform float uLowerJaw;
        uniform float uUpperJaw;
        uniform float uPouch;
        attribute vec4 aJaw;
        varying vec4 vJaw;${glows ? `
        attribute vec4 aGlow;
        varying vec4 vGlow;` : ''}
        // あごの動き(jawMove と同じ式)。上あごは関節(口の端)のまわりに少し持ち上がり、
        // 下あごは、関節より前の点が、くちびるの線が回るのと同じだけ下がる(口先の近くだけは、そのまま回す)
        vec2 jawTurn2(vec2 d, float a) { float c = cos(a), s = sin(a); return vec2(d.x * c + d.y * s, -d.x * s + d.y * c); }
        float jawRigid(float dz) { return 1.0 - smoothstep(${f(-JAW_MOVE.rigidTo)}, ${f(-JAW_MOVE.rigidFrom)}, dz); }
        vec2 jawMove(vec2 d, float lo) {
          if (lo <= 0.0) return d;
          float c = cos(lo), s = sin(lo);
          float q = d.y / ${f(JAW_MOVE.back)};
          float f = d.y <= 0.0 ? d.y : d.y * exp(-q * q);
          vec2 sh = vec2(d.x + f * s, d.y + f * (c - 1.0));
          return mix(sh, jawTurn2(d, lo), jawRigid(d.y));
        }
        // 面の向き(陰のつけ方)も同じように動かす
        vec2 jawMoveNormal(vec2 n, vec2 d, float lo) {
          if (lo <= 0.0) return n;
          float c = cos(lo), s = sin(lo);
          float q = d.y / ${f(JAW_MOVE.back)};
          float h = d.y <= 0.0 ? 1.0 : exp(-q * q) * (1.0 - 2.0 * q * q);
          vec2 sh = vec2(n.x, (n.y - h * s * n.x) / (1.0 + h * (c - 1.0)));
          return normalize(mix(normalize(sh), jawTurn2(n, lo), jawRigid(d.y)));
        }
        vec3 jawApply(vec3 p) {
          vec2 d = jawTurn2(vec2(p.y - ${f(hingeY)}, p.z - ${f(hingeZ)}), -uUpperJaw * aJaw.y);
          d = jawMove(d, uLowerJaw * aJaw.w);
          return vec3(p.x, ${f(hingeY)} + d.x, ${f(hingeZ)} + d.y);
        }`)
      // 体がしなった向きに合わせて、陰のつけ方も曲げる(しなりの傾きは swimSlope と同じ式)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float bendS = clamp(position.z + 0.5, 0.0, 1.0);
        float bendA = uPhase - ${SWIM.wave.toFixed(2)} * bendS;
        float bendSlope = uSwim * ${SWIM.amplitude.toFixed(4)} * (${SWIM.power.toFixed(2)} * pow(max(bendS, 1e-4), ${(SWIM.power - 1).toFixed(2)}) * sin(bendA)
          - ${SWIM.wave.toFixed(2)} * pow(bendS, ${SWIM.power.toFixed(2)}) * cos(bendA));
        objectNormal = normalize(vec3(objectNormal.x, objectNormal.y, objectNormal.z - bendSlope * objectNormal.y));
        {
          float upA = -uUpperJaw * aJaw.y;
          vec2 jd = jawTurn2(vec2(position.y - ${f(hingeY)}, position.z - ${f(hingeZ)}), upA);
          vec2 jn = jawMoveNormal(jawTurn2(objectNormal.yz, upA), jd, uLowerJaw * aJaw.w);
          objectNormal = vec3(objectNormal.x, jn);
        }
        vJaw = aJaw;${glows ? `
        vGlow = aGlow;` : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // のみこんだ水で、のどがふくらむ(下へ大きく、横へも少し。pouchDirection と同じ式)
        if (uPouch > 0.0 && aJaw.z > 0.0) {
          vec2 r = vec2(transformed.x, transformed.y + 0.02);
          vec3 d = normalize(vec3(r.x / max(length(r), 1e-4) * ${f(POUCH_SIDEWAYS)}, -1.0, 0.0));
          transformed += d * ${f(POUCH_SWELL * (useModel ? MODEL.pouchSwell : 1))} * uPouch * aJaw.z;
        }
        // ひげ板: 口を開けると本当の長さまでのびる(閉じているあいだは下あごの中にしまってある)
        if (aJaw.z < 0.0) transformed.y += aJaw.z * smoothstep(0.05, 0.5, uLowerJaw);
        // 左右の下あごが外へ回って、口が横に広がる
        transformed.x *= 1.0 + ${f(ENGULF.splay)} * uLowerJaw * aJaw.x;
        transformed = jawApply(transformed);
        float swimS = clamp(position.z + 0.5, 0.0, 1.0);
        transformed.y += uSwim * ${SWIM.amplitude.toFixed(4)} * pow(swimS, ${SWIM.power.toFixed(2)})
          * sin(uPhase - ${SWIM.wave.toFixed(2)} * swimS);`);
  };
  const vertexPatch = material.onBeforeCompile;   // 泳ぐしなりとあごの動き(口の中の網目にも使う)
  const baseCompile = material.onBeforeCompile;
  material.onBeforeCompile = shader => {
    baseCompile(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uLowerJaw;
        uniform float uPouch;
        varying vec4 vJaw;${glows ? `
        uniform float uGlow;
        uniform float uGlowTime;
        varying vec4 vGlow;` : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float opened = smoothstep(0.02, 0.25, uLowerJaw);
          // 口の中(あごのあいだにのびた面と、頭の内側): 上はひげ板の暗い色、下は舌のうすいピンク
          // (あごの重みがないところ、たとえば口の端よりうしろの線は、口の中にしない)
          float jawPart = clamp((vJaw.x + vJaw.y) * 3.0, 0.0, 1.0);
          float inMouth = (1.0 - abs(2.0 * vJaw.w - 1.0)) * jawPart;
          float inside = gl_FrontFacing ? inMouth : jawPart;
          vec3 baleen = vec3(0.035, 0.034, 0.033);
          vec3 tongue = vec3(0.42, 0.24, 0.23);
          vec3 mouthCol = mix(baleen, tongue, smoothstep(0.35, 0.75, vJaw.w));
          diffuseColor.rgb = mix(diffuseColor.rgb, mouthCol, clamp(inside, 0.0, 1.0) * opened);
          // のびた畝のあいだの肌は、うすいピンクがかった白に見える
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.5, 0.48), 0.45 * uPouch * vJaw.z * vJaw.w);
        }`);
    if (glows) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // 夜は模様だけが光る。星や花火は、ゆっくりまたたく
        totalEmissiveRadiance += vGlow.rgb * uGlow * (0.72 + 0.28 * sin(uGlowTime * 2.1 + vGlow.a * 6.2832));`);
    }
    if (glows) { shader.uniforms.uGlow = GLOW.uGlow; shader.uniforms.uGlowTime = GLOW.uGlowTime; }
  };
  material.customProgramCacheKey = () => `whale-${kind}${glows ? '-glow' : ''}`;
  let mesh, eyes = null;
  if (useModel) {
    // 3Dモデル: 目・口・フジツボは、テクスチャと形にふくまれている(目の動きと口の開きは、あとで作る)
    const { style, look } = useModelLook(material, individual, uniforms);
    const geo = style === 'cosmic' ? cosmicGeometry(individual, look)
      : modelGeometryFor(individual?.special ? null : individual);
    mesh = new THREE.Mesh(geo, material);
    mesh.scale.setScalar(lengthMeters);
    if (look?.kind === 'decor') mesh.add(decorMesh(look, uniforms));
    eyes = createModelEyes(mesh, individual, uniforms);
    // 口の中(天井・ひげ板・舌・のどの奥)。体と同じしなりとあごの動きで動く
    const inner = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
    inner.onBeforeCompile = shader => { vertexPatch(shader); mouthDetail(shader); };
    inner.customProgramCacheKey = () => 'whale-model-mouth';
    mesh.add(new THREE.Mesh(model.mouthGeo, inner));
  } else {
    mesh = new THREE.Mesh(geometryForIndividual(kind, individual), material);
    mesh.scale.setScalar(lengthMeters);
    // ザトウクジラは、目のまわりを細かく作った部品をはめこむ(体の網目のその部分は抜いてある)
    eyes = kind === 'humpback' ? createEyes(mesh, material, individual) : null;
    // フジツボと、盛り上がった傷あと(体と同じ描き方なので、しなりやあごの動きもいっしょ)
    const features = featuresFor(kind, individual);
    if (features) mesh.add(new THREE.Mesh(features, material));
  }

  // 大きいクジラほどゆっくり尾をあおぐ(14mでおよそ4.5秒に1回)
  const strokes = strokesPerSecond(lengthMeters);

  return {
    mesh,
    length: lengthMeters,
    // 0 で止まる(寝ているクジラ)、1 でふつうに泳ぐ
    setSwim(amount) {
      uniforms.uSwim.value = amount;
    },
    // 口とのど(捕食)。lower・upper はあごの角度(ラジアン)、pouch はのどのふくらみ(0〜1)
    setJaw(lower, upper, pouch) {
      uniforms.uLowerJaw.value = lower;
      uniforms.uUpperJaw.value = upper;
      uniforms.uPouch.value = pouch;
    },
    // 目(ザトウクジラだけ)。alive にすると、まばたきと目の動きをする
    eyes,
    // 3Dモデルの右目の場所(体長1)。「目が合う」でカメラの前に目を持ってくるのに使う
    eyeSpot: useModel ? { center: model.eyes[0].point, normal: model.eyes[0].normal } : null,
    update(dt) {
      uniforms.uPhase.value += dt * Math.PI * 2 * strokes;
      if (glows || (useModel && individual?.special)) GLOW.uGlowTime.value = performance.now() / 1000;
      eyes?.update(dt);
    },
  };
}
