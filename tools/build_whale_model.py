# ザトウクジラの3Dモデル(Meshy で作ったもの)を、アプリで使う形にして assets/models/ に書き出す。
# 元のモデルが変わったときだけ動かす:
#   python3 tools/build_whale_model.py <テクスチャ付きの glb> <ファンタジー版のフォルダ> <宇宙版のフォルダ> <彗星の2つの版のフォルダ>
#   (pygltflib と Pillow と numpy が要る: pip install pygltflib pillow numpy)
#
# やること
#   ・頭を -z に向け、体長を 1 にして、まん中を原点に置く(いまの泳ぐしなりは、z = -0.5 〜 0.5 の体に合わせてある)
#   ・元のモデルは尾が下に曲がった姿で作られているので、背骨をまっすぐにのばす(しなりは泳ぐときに付ける)
#   ・元のモデルは本物より少し細いので、太さ(横と縦)を THICKEN 倍にする
#   ・テクスチャ(2048四方の PNG)を小さな JPEG にして、ファイルを軽くする
#   ・とくべつな子: ファンタジー版は模様の画像、宇宙版は頂点ごとの色(.bin)。どちらも形は同じなので、形はひとつだけ持つ
import io, json, pathlib, struct, sys
import numpy as np
from PIL import Image
from pygltflib import GLTF2

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/models'
THICKEN = 1.2            # 太さの倍率
FLUKE_ROOT = 0.915       # 尾びれが始まるところ
TAIL_ROOT = 0.84         # 尾のかたまり(尾の柄と尾びれ)が始まるところ(頭 0 〜 尾 1)
BASE_SIZE = 1024         # 体の色のテクスチャの大きさ
NORMAL_SIZE = 1024       # でこぼこ(法線)のテクスチャ
ROUGH_SIZE = 512         # つや
SPECIAL_SIZE = 1024      # とくべつな子の模様
SPECIALS = ['galaxy', 'comet', 'fireworks']
COMET_FILES = {'fantasy': 'humpback_comet_fantasy_deluxe.glb', 'cosmic': 'humpback_comet_halley.glb'}


def accessor(g, blob, idx):
    a = g.accessors[idx]
    bv = g.bufferViews[a.bufferView]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a.type]
    dt = {5126: np.float32, 5121: np.uint8, 5123: np.uint16, 5125: np.uint32}[a.componentType]
    arr = np.frombuffer(blob, dtype=dt, count=a.count * n, offset=(bv.byteOffset or 0) + (a.byteOffset or 0))
    out = arr.reshape(-1, n).copy()
    if a.normalized and dt == np.uint8:
        out = out.astype(np.float32) / 255
    return out


def image(g, blob, tex_index):
    im = g.images[g.textures[tex_index].source]
    bv = g.bufferViews[im.bufferView]
    return Image.open(io.BytesIO(blob[(bv.byteOffset or 0):(bv.byteOffset or 0) + bv.byteLength]))


def jpeg(img, size, quality=85):
    buf = io.BytesIO()
    img.convert('RGB').resize((size, size), Image.LANCZOS).save(buf, 'JPEG', quality=quality, optimize=True)
    return buf.getvalue()


class Shape:
    """元のモデルの体から、向き・大きさ・曲がりののばし方を決めて、同じ動かし方をほかの部品(彗星の尾など)にも使う"""

    def __init__(self, body):
        pos = body.astype(np.float64).copy()
        pos[:, [0, 2]] *= -1                       # 頭を -z へ(y のまわりに半回転)
        self.length = pos[:, 2].max() - pos[:, 2].min()
        self.z0 = (pos[:, 2].max() + pos[:, 2].min()) / 2
        pos[:, 2] -= self.z0
        pos /= self.length
        # 背骨(体のまん中の高さ)を u ごとに求めて、なめらかにする
        u = pos[:, 2] + 0.5
        self.bins = np.linspace(0, 1, 101)
        centers = np.full(len(self.bins), np.nan)
        for k, b in enumerate(self.bins):
            m = (np.abs(u - b) < 0.012) & (np.abs(pos[:, 0]) < 0.03)
            if m.sum() >= 4:
                centers[k] = (pos[m, 1].max() + pos[m, 1].min()) / 2
        ok = ~np.isnan(centers)
        centers = np.interp(self.bins, self.bins[ok], centers[ok])
        kernel = np.exp(-np.linspace(-2, 2, 15) ** 2)   # 頭のこぶや背びれに引っぱられないよう、なめらかにする
        kernel /= kernel.sum()
        smooth = np.convolve(np.pad(centers, 7, mode='edge'), kernel, mode='valid')
        # 頭のまわり(u < 0.35)は動かさず、そこからうしろの曲がりだけをのばす
        smooth -= np.interp(0.35, self.bins, smooth)
        smooth[self.bins < 0.35] = 0
        # 尾のつけ根よりうしろは、ここでは平行に動かすだけ(向きは、かたまりのまま起こす)
        smooth[self.bins > TAIL_ROOT] = np.interp(TAIL_ROOT, self.bins, smooth)
        self.smooth = smooth
        nrm0 = np.zeros_like(pos)
        pos, _ = self._straighten(pos, nrm0)
        # (1) 尾の柄: つけ根から尾びれのつけ根までの線が、水平になるように
        self.root_z, self.notch_z = TAIL_ROOT - 0.5, FLUKE_ROOT - 0.5
        self.root_y = mid_y(pos, self.root_z)
        self.a1 = -np.arctan2(mid_y(pos, self.notch_z) - self.root_y, self.notch_z - self.root_z)
        pos, _ = rotate_part(pos, nrm0, self.root_z, self.root_y, self.a1, TAIL_ROOT - 0.03, TAIL_ROOT + 0.02)
        # (2) 尾びれ: 左右の先のほうの点の並びが水平になるように
        u = pos[:, 2] + 0.5
        fl = (u > FLUKE_ROOT + 0.01) & (np.abs(pos[:, 0]) > 0.05)
        self.a2 = -np.arctan(np.polyfit(pos[fl, 2], pos[fl, 1], 1)[0])
        self.notch_y = mid_y(pos, self.notch_z)
        pos, _ = rotate_part(pos, nrm0, self.notch_z, self.notch_y, self.a2, FLUKE_ROOT - 0.01, FLUKE_ROOT + 0.015)
        pos[:, :2] *= THICKEN
        core = (np.abs(pos[:, 2] + 0.15) < 0.01) & (np.abs(pos[:, 0]) < 0.03)
        self.y0 = (pos[core, 1].max() + pos[core, 1].min()) / 2
        print(f'尾の柄を {np.degrees(self.a1):.1f}度、尾びれを {np.degrees(self.a2):.1f}度 起こした')

    def _straighten(self, pos, nrm):
        u = pos[:, 2] + 0.5
        dy = np.interp(u, self.bins, self.smooth)
        ang = np.arctan(np.interp(u, self.bins, np.gradient(self.smooth, self.bins)))
        pos, nrm = pos.copy(), nrm.copy()
        pos[:, 1] -= dy
        c, s = np.cos(ang), np.sin(ang)
        ny, nz = nrm[:, 1].copy(), nrm[:, 2].copy()
        nrm[:, 1] = c * ny + s * nz
        nrm[:, 2] = -s * ny + c * nz
        return pos, nrm

    def apply(self, pos, nrm=None):
        pos = pos.astype(np.float64).copy()
        nrm = np.zeros_like(pos) if nrm is None else nrm.astype(np.float64).copy()
        pos[:, [0, 2]] *= -1
        nrm[:, [0, 2]] *= -1
        pos[:, 2] -= self.z0
        pos /= self.length
        pos, nrm = self._straighten(pos, nrm)
        pos, nrm = rotate_part(pos, nrm, self.root_z, self.root_y, self.a1, TAIL_ROOT - 0.03, TAIL_ROOT + 0.02)
        pos, nrm = rotate_part(pos, nrm, self.notch_z, self.notch_y, self.a2, FLUKE_ROOT - 0.01, FLUKE_ROOT + 0.015)
        pos[:, :2] *= THICKEN               # 太くする(法線は逆の倍率で直す)
        nrm[:, :2] /= THICKEN
        pos[:, 1] -= self.y0                 # 体のまん中(u = 0.35)の高さを 0 に
        ln = np.linalg.norm(nrm, axis=1, keepdims=True)
        nrm = np.divide(nrm, ln, out=np.zeros_like(nrm), where=ln > 0)
        return pos, nrm


def rotate_part(pos, nrm, pivot_z, pivot_y, ang, u_from, u_to):
    """u_from から u_to にかけてなめらかに効きはじめる回転で、それよりうしろを pivot のまわりに起こす"""
    u = pos[:, 2] + 0.5
    w = np.clip((u - u_from) / (u_to - u_from), 0, 1)
    w = w * w * (3 - 2 * w)
    a = ang * w
    c, s = np.cos(a), np.sin(a)
    dz, dy = pos[:, 2] - pivot_z, pos[:, 1] - pivot_y
    pos = pos.copy()
    pos[:, 2] = pivot_z + c * dz - s * dy
    pos[:, 1] = pivot_y + s * dz + c * dy
    nz, ny = nrm[:, 2].copy(), nrm[:, 1].copy()
    nrm = nrm.copy()
    nrm[:, 2] = c * nz - s * ny
    nrm[:, 1] = s * nz + c * ny
    return pos, nrm


def mid_y(pos, z, half=0.008, xmax=0.02):
    m = (np.abs(pos[:, 2] - z) < half) & (np.abs(pos[:, 0]) < xmax)
    return (pos[m, 1].max() + pos[m, 1].min()) / 2


def build(tex_glb, fantasy_dir, cosmic_dir, comet_dir=None):
    g = GLTF2().load(tex_glb)
    blob = g.binary_blob()
    prim = g.meshes[0].primitives[0]
    pos = accessor(g, blob, prim.attributes.POSITION).astype(np.float64)
    nrm = accessor(g, blob, prim.attributes.NORMAL).astype(np.float64)
    uv = accessor(g, blob, prim.attributes.TEXCOORD_0).astype(np.float32)
    idx = accessor(g, blob, prim.indices).reshape(-1)

    shape = Shape(pos)
    pos, nrm = shape.apply(pos, nrm)

    mat = g.materials[0]
    pbr = mat.pbrMetallicRoughness
    textures = {
        'base': jpeg(image(g, blob, pbr.baseColorTexture.index), BASE_SIZE),
        'normal': jpeg(image(g, blob, mat.normalTexture.index), NORMAL_SIZE, 92),
        'rough': jpeg(image(g, blob, pbr.metallicRoughnessTexture.index), ROUGH_SIZE),
    }
    write_glb(OUT / 'humpback.glb', pos.astype(np.float32), nrm.astype(np.float32), uv, idx, textures)

    # とくべつな子
    fantasy_dir, cosmic_dir = pathlib.Path(fantasy_dir), pathlib.Path(cosmic_dir)
    # ホウキボシ・リュウセイ: 体はふつうの子と同じで、彗星(頭・尾・光の粒)の部品を体の上に重ねる
    if comet_dir:
        comet_dir = pathlib.Path(comet_dir)
        for style, fname in COMET_FILES.items():
            write_decor(OUT / f'special-comet-{style}.glb', comet_dir / fname, shape)
    for name in SPECIALS:
        if comet_dir and name == 'comet':
            continue
        fg = GLTF2().load(fantasy_dir / f'humpback_{name}_fantasy.glb')
        fb = fg.binary_blob()
        img = image(fg, fb, fg.materials[0].pbrMetallicRoughness.baseColorTexture.index)
        (OUT / f'special-{name}-fantasy.jpg').write_bytes(jpeg(img, SPECIAL_SIZE, 88))
        cg = GLTF2().load(cosmic_dir / f'humpback_{name}.glb')
        cb = cg.binary_blob()
        col = accessor(cg, cb, cg.meshes[0].primitives[0].attributes.COLOR_0)[:, :3]
        if col.dtype != np.uint8:
            col = np.clip(np.round(col * 255), 0, 255).astype(np.uint8)
        assert len(col) == len(pos), '宇宙版の頂点の数が、もとのモデルとちがう'
        (OUT / f'special-{name}-cosmic.bin').write_bytes(col.tobytes())
    print('書き出し:', ', '.join(sorted(p.name for p in OUT.iterdir())))


def write_decor(path, src, shape):
    """体の上に重ねる部品(体以外のメッシュ)を、体と同じ動かし方でそろえて、色つきの1つの網目にまとめる"""
    g = GLTF2().load(src)
    blob = g.binary_blob()
    P, C, I = [], [], []
    for m in g.meshes[1:]:
        for prim in m.primitives:
            pos = accessor(g, blob, prim.attributes.POSITION)
            mat = g.materials[prim.material]
            rgba = list(mat.pbrMetallicRoughness.baseColorFactor or [1, 1, 1, 1])
            if mat.alphaMode != 'BLEND':
                rgba[3] = 1
            base = sum(len(p) for p in P)
            P.append(pos)
            C.append(np.tile(np.array(rgba, dtype=np.float32), (len(pos), 1)))
            I.append(accessor(g, blob, prim.indices).reshape(-1).astype(np.int64) + base)
    pos, _ = shape.apply(np.concatenate(P))
    col = np.concatenate(C)
    idx = np.concatenate(I)
    write_glb(path, pos.astype(np.float32), None, None, idx, {}, colors=(np.clip(np.round(col * 255), 0, 255)).astype(np.uint8))


def write_glb(path, pos, nrm, uv, idx, textures, colors=None):
    """形と3枚のテクスチャを1つの glb にまとめる(Blender などを使わずに書く)"""
    chunks, views, accessors = [], [], []

    def add_view(data, target=None):
        off = sum(len(c) for c in chunks)
        pad = (-len(data)) % 4
        chunks.append(data + b'\0' * pad)
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        return len(views) - 1

    def add_acc(arr, ctype, atype, target, minmax=False):
        v = add_view(arr.tobytes(), target)
        a = {'bufferView': v, 'componentType': ctype, 'count': len(arr), 'type': atype}
        if minmax:
            a['min'] = arr.min(axis=0).tolist()
            a['max'] = arr.max(axis=0).tolist()
        accessors.append(a)
        return len(accessors) - 1

    attrs = {'POSITION': add_acc(pos, 5126, 'VEC3', 34962, True)}
    if nrm is not None:
        attrs['NORMAL'] = add_acc(nrm, 5126, 'VEC3', 34962)
    if uv is not None:
        attrs['TEXCOORD_0'] = add_acc(uv, 5126, 'VEC2', 34962)
    if colors is not None:
        attrs['COLOR_0'] = add_acc(colors, 5121, 'VEC4', 34962)
        accessors[-1]['normalized'] = True
    ii = add_acc(idx.astype(np.uint16 if idx.max() < 65536 else np.uint32), 5123 if idx.max() < 65536 else 5125, 'SCALAR', 34963)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'tools/build_whale_model.py'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': path.stem}],
        'meshes': [{'primitives': [{'attributes': attrs, 'indices': ii, 'material': 0}]}],
        'materials': [{'name': path.stem, 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 1}}],
        'accessors': accessors, 'bufferViews': views,
        'buffers': [{'byteLength': sum(len(c) for c in chunks)}],
    }
    if textures:
        gltf['images'] = [{'bufferView': add_view(textures[k]), 'mimeType': 'image/jpeg', 'name': k} for k in ['base', 'normal', 'rough']]
        gltf['buffers'][0]['byteLength'] = sum(len(c) for c in chunks)
        gltf['textures'] = [{'source': 0, 'sampler': 0}, {'source': 1, 'sampler': 0}, {'source': 2, 'sampler': 0}]
        gltf['samplers'] = [{'magFilter': 9729, 'minFilter': 9987}]
        gltf['materials'][0]['pbrMetallicRoughness'].update({'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 2}})
        gltf['materials'][0]['normalTexture'] = {'index': 1}
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    bin_ = b''.join(chunks)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON') + js)
        f.write(struct.pack('<I4s', len(bin_), b'BIN\0') + bin_)


if __name__ == '__main__':
    if len(sys.argv) not in (4, 5):
        sys.exit('使い方: python3 tools/build_whale_model.py <glb> <ファンタジー版のフォルダ> <宇宙版のフォルダ> [彗星の2つの版のフォルダ]')
    OUT.mkdir(parents=True, exist_ok=True)
    build(*sys.argv[1:])
