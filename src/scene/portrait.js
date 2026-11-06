import * as THREE from 'three';
import { createWhaleMesh } from './whaleModel.js';
import { lengthOf } from '../logic/zukan.js';

// 図鑑の全身の姿。その子の3Dの体(個性入り)を、別の小さな画面で横から描いて、絵にする。
// どの子も同じ距離から描くので、大きい子は大きく、小さめの子は小さく見える。
// 一度描いたら覚えておく。描けないとき(WebGL が使えないなど)は null
const cache = new Map();
let stage = null;

function makeStage(width, height) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  // 海の中の展示室のような光: 上からの明るい光と、下からのほの暗い照り返し
  scene.add(new THREE.HemisphereLight(0xdfeaf2, 0x1a2a38, 1.2));
  const key = new THREE.DirectionalLight(0xfff6ea, 2.4);
  key.position.set(-8, 14, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fc2dd, 0.9);
  rim.position.set(6, -3, -10);
  scene.add(rim);
  // 左向き(頭が左)に、少し上から見る。16mの子がちょうど入る距離
  const camera = new THREE.PerspectiveCamera(22, width / height, 0.5, 200);
  camera.position.set(-17.5, 5.2, 0.6);
  camera.lookAt(0, -0.3, 0.6);
  renderer.setSize(width, height, false);
  return { canvas, renderer, scene, camera, width, height };
}

export function portraitOf(ind, { width = 640, height = 260 } = {}) {
  if (!ind) return null;
  if (cache.has(ind.id)) return cache.get(ind.id);
  let url = null;
  try {
    if (!stage) stage = makeStage(width, height);
    const whale = createWhaleMesh('humpback', lengthOf(ind), { individual: ind });
    whale.setSwim(0);
    // 胸びれと背中がよく見えるように、ほんの少し体をかたむける
    whale.mesh.rotation.set(0.05, 0, -0.12);
    stage.scene.add(whale.mesh);
    stage.renderer.render(stage.scene, stage.camera);
    url = stage.canvas.toDataURL('image/png');
    stage.scene.remove(whale.mesh);
  } catch {
    url = null;
  }
  cache.set(ind.id, url);
  return url;
}
