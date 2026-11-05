import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { PATTERNS } from '../logic/patterns.js';

export const MODEL_FILES = Object.freeze({
  humpback: 'assets/models/humpback.glb',
  sperm: 'assets/models/sperm_whale.glb',
});

// モデルごとの向きと大きさの調整。ダウンロードしたモデルに合わせてここを変える。
// rotationY: 頭が -Z(沖の方向)を向くように回す角度(度)。length: 体長(m)。
export const MODEL_FIX = {
  humpback: { rotationY: 0, length: 14 },
  sperm: { rotationY: 0, length: 15 },
};

async function loadModel(loader, url) {
  try {
    return await loader.loadAsync(url);
  } catch {
    return null;
  }
}

// クジラを1頭作る。外側の Group を動かせば位置と向きが変わる。
function makeWhale(gltf, kind, scale = 1) {
  const fix = MODEL_FIX[kind];
  const model = cloneSkinned(gltf.scene);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z) || 1;
  model.scale.setScalar((fix.length / longest) * scale);
  model.rotation.y = THREE.MathUtils.degToRad(fix.rotationY);

  const group = new THREE.Group();
  group.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const clips = gltf.animations ?? [];
  const swim = clips.find(c => /swim/i.test(c.name)) ?? clips[0];
  if (swim) mixer.clipAction(swim).play();

  return { group, mixer };
}

export async function createWhales(scene, loader) {
  const [humpback, sperm] = await Promise.all([
    loadModel(loader, MODEL_FILES.humpback),
    loadModel(loader, MODEL_FILES.sperm),
  ]);
  const models = { humpback, sperm };
  const active = new Set();

  function spawn(kind, scale) {
    const whale = makeWhale(models[kind], kind, scale);
    scene.add(whale.group);
    active.add(whale);
    return whale;
  }

  function remove(whale) {
    scene.remove(whale.group);
    active.delete(whale);
  }

  // 出方を再生する。終わったら解決する。
  function play(name, position) {
    const { durationMs, needs } = PATTERNS[name];
    if (!needs) return new Promise(r => setTimeout(r, durationMs));
    const whale = spawn(needs);
    whale.group.position.set(...position);
    return new Promise(r => setTimeout(() => { remove(whale); r(); }, durationMs));
  }

  function update(dt) {
    for (const w of active) w.mixer.update(dt);
  }

  return { models, play, update };
}
