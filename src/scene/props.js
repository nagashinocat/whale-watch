import * as THREE from 'three';

// カメラ位置ごとの手前の景色。浜辺の砂と波打ち際、船の甲板と手すり。

const SHORE_Z = 30;                       // 波打ち際の位置(浜辺カメラは z = 60)
const sandHeight = z => (z - SHORE_Z) * 0.0133;

// 波打ち際の白い泡の模様(手前ほど濃く、奥へ向かってまだらに消える)
function makeFoamTexture() {
  const w = 512, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = 1 - y / h;
      const n = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.sin(x * 0.037) * 3 + y * 0.2) * Math.sin(x * 0.053 - y * 0.31);
      const a = Math.max(0, Math.min(1, edge * 1.4 - (1 - n) * 0.8));
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

function makeBeach() {
  const group = new THREE.Group();

  // 砂浜: 波打ち際から手前へゆるやかに上がる。水際は濡れて暗い色
  const geo = new THREE.PlaneGeometry(700, 160, 140, 40);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 60);
  const pos = geo.attributes.position;
  const colors = [];
  const dry = new THREE.Color(0xdcc69c), wet = new THREE.Color(0x9c8664);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, sandHeight(z) + Math.sin(x * 0.21) * Math.sin(z * 0.37) * 0.04);
    const c = dry.clone().lerp(wet, 1 - Math.min(1, Math.max(0, (z - SHORE_Z) / 8)));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const sand = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  group.add(sand);

  // 寄せては返す白い波
  const foamMat = new THREE.MeshBasicMaterial({ map: makeFoamTexture(), transparent: true, depthWrite: false, opacity: 0.85 });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(700, 6), foamMat);
  foam.rotation.x = -Math.PI / 2;
  group.add(foam);

  let t = 0;
  return {
    group,
    update(dt) {
      t += dt;
      // 7秒周期で波が寄せて、引いていく
      const phase = (Math.sin((t / 7) * Math.PI * 2) + 1) / 2;
      const z = SHORE_Z + 1 + phase * 5;
      foam.position.set(0, sandHeight(z) + 0.03, z);
      foamMat.opacity = 0.35 + 0.5 * phase;
      foamMat.map.offset.x += dt * 0.004;
    },
  };
}

// 船の甲板と手すり。カメラにくっつけるので、船ごと揺れる
function makeBoat() {
  const group = new THREE.Group();
  const eye = 1.6; // 甲板からの目の高さ

  const outline = new THREE.Shape();
  outline.moveTo(-2.4, 4);
  outline.lineTo(2.4, 4);
  outline.lineTo(2.4, -3);
  outline.quadraticCurveTo(2.2, -7.5, 0, -10);
  outline.quadraticCurveTo(-2.2, -7.5, -2.4, -3);
  outline.lineTo(-2.4, 4);

  // 甲板(木)
  const deckGeo = new THREE.ShapeGeometry(outline, 16);
  deckGeo.rotateX(Math.PI / 2);
  const deck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ color: 0x9a6b43, roughness: 0.9, side: THREE.DoubleSide }));
  deck.position.y = -eye;
  group.add(deck);

  // 船べり(白く塗った低い壁)
  const pts = outline.getSpacedPoints(80);
  const wallGeo = new THREE.BufferGeometry();
  const verts = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (a.y > 3.9 && b.y > 3.9) continue; // 後ろ側は壁なし
    const y0 = -eye, y1 = -eye + 0.55;
    verts.push(a.x, y0, a.y, b.x, y0, b.y, b.x, y1, b.y, a.x, y0, a.y, b.x, y1, b.y, a.x, y1, a.y);
  }
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  wallGeo.computeVertexNormals();
  group.add(new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 0.6, side: THREE.DoubleSide })));

  // 手すり(銀色の支柱と横棒)
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 0.8, roughness: 0.3 });
  const railPts = outline.getSpacedPoints(40).filter(p => p.y < 3.9);
  const railHeight = -eye + 1.0;
  railPts.forEach((p, i) => {
    if (i % 3 === 0) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), metal);
      post.position.set(p.x * 0.97, railHeight - 0.225, p.y * 0.97);
      group.add(post);
    }
  });
  const curve = new THREE.CatmullRomCurve3(railPts.map(p => new THREE.Vector3(p.x * 0.97, railHeight, p.y * 0.97)));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.03, 6, false), metal));

  return { group, update() {} };
}

export function createProps(scene, camera) {
  const beach = makeBeach();
  scene.add(beach.group);
  const boat = makeBoat();
  camera.add(boat.group);
  scene.add(camera); // カメラにくっつけた船を描くために必要

  const byCamera = { beach, boat };
  let current = null;

  return {
    setCamera(name) {
      for (const [key, prop] of Object.entries(byCamera)) prop.group.visible = key === name;
      current = byCamera[name] ?? null;
    },
    update(dt) {
      current?.update(dt);
    },
  };
}
