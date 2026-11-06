import * as THREE from 'three';
import { buildWhaleGeometry, SWIM, strokesPerSecond, WHALE_SPECS, jawHinge, POUCH_SWELL, BODY_GRID, ringU, aroundTheta, bodyPoint, flukeOutline } from '../logic/whaleShape.js';
import { traitBodyColor, traitFinColor, flukeBite } from '../logic/traits.js';
import { buildFeatures } from '../logic/features3d.js';
import { eyePatch, applyLid, eyeballPlacement, blinkOpen, EYE } from '../logic/eyeShape.js';
import { flukeWhiteness } from '../logic/flukeId.js';

// 目の玉に映る空と海の色(時刻で変わる。setEyeLight で変える)
const eyeUniforms = {
  uZenith: { value: new THREE.Color(0x2557cc) },
  uHorizon: { value: new THREE.Color(0x90b6ef) },
  uSea: { value: new THREE.Color(0x0a4f8a) },
  uDay: { value: 1 },
};
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
  };
  const [hingeY, hingeZ] = kind === 'humpback' ? jawHinge(kind) : [0, 0];
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
        varying vec4 vJaw;
        // あごの軸(口の端)のまわりに回す。前(-z)が下がる向き
        vec3 jawTurn(vec3 p, float a) {
          float c = cos(a), s = sin(a);
          float y = p.y - ${f(hingeY)}, z = p.z - ${f(hingeZ)};
          return vec3(p.x, ${f(hingeY)} + y * c + z * s, ${f(hingeZ)} - y * s + z * c);
        }`)
      // 体がしなった向きに合わせて、陰のつけ方も曲げる(しなりの傾きは swimSlope と同じ式)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float bendS = clamp(position.z + 0.5, 0.0, 1.0);
        float bendA = uPhase - ${SWIM.wave.toFixed(2)} * bendS;
        float bendSlope = uSwim * ${SWIM.amplitude.toFixed(4)} * (${SWIM.power.toFixed(2)} * pow(max(bendS, 1e-4), ${(SWIM.power - 1).toFixed(2)}) * sin(bendA)
          - ${SWIM.wave.toFixed(2)} * pow(bendS, ${SWIM.power.toFixed(2)}) * cos(bendA));
        objectNormal = normalize(vec3(objectNormal.x, objectNormal.y, objectNormal.z - bendSlope * objectNormal.y));
        float jawA = uLowerJaw * aJaw.x - uUpperJaw * aJaw.y;
        objectNormal = vec3(objectNormal.x, objectNormal.y * cos(jawA) + objectNormal.z * sin(jawA), -objectNormal.y * sin(jawA) + objectNormal.z * cos(jawA));
        vJaw = aJaw;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // のみこんだ水で、のどがふくらむ(下へ大きく、横へも少し)
        if (uPouch > 0.0 && aJaw.z > 0.0) {
          vec2 r = vec2(transformed.x, transformed.y + 0.02);
          vec3 d = normalize(vec3(r.x / max(length(r), 1e-4) * 0.7, r.y / max(length(r), 1e-4) - 0.4, 0.0));
          transformed += d * ${f(POUCH_SWELL)} * uPouch * aJaw.z;
        }
        transformed = jawTurn(transformed, jawA);
        float swimS = clamp(position.z + 0.5, 0.0, 1.0);
        transformed.y += uSwim * ${SWIM.amplitude.toFixed(4)} * pow(swimS, ${SWIM.power.toFixed(2)})
          * sin(uPhase - ${SWIM.wave.toFixed(2)} * swimS);`);
  };
  const baseCompile = material.onBeforeCompile;
  material.onBeforeCompile = shader => {
    baseCompile(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uLowerJaw;
        uniform float uPouch;
        varying vec4 vJaw;`)
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
  };
  material.customProgramCacheKey = () => `whale-${kind}`;
  const mesh = new THREE.Mesh(geometryForIndividual(kind, individual), material);
  mesh.scale.setScalar(lengthMeters);
  // ザトウクジラは、目のまわりを細かく作った部品をはめこむ(体の網目のその部分は抜いてある)
  const eyes = kind === 'humpback' ? createEyes(mesh, material, individual) : null;
  // フジツボと、盛り上がった傷あと(体と同じ描き方なので、しなりやあごの動きもいっしょ)
  const features = featuresFor(kind, individual);
  if (features) mesh.add(new THREE.Mesh(features, material));

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
    update(dt) {
      uniforms.uPhase.value += dt * Math.PI * 2 * strokes;
      eyes?.update(dt);
    },
  };
}
