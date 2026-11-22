# ザトウクジラの3Dモデル(Meshy で作ったもの)を、アプリで使う形にして assets/models/ に書き出す。
# 元のモデルが変わったときだけ動かす:
#   python3 tools/build_whale_model.py <テクスチャ付きの glb> <ファンタジー版のフォルダ> <宇宙版のフォルダ>
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


def straighten(pos, nrm):
    """背骨(体のまん中の高さ)を u ごとに求めて、まっすぐにする。法線も同じだけ回す"""
    u = pos[:, 2] + 0.5
    bins = np.linspace(0, 1, 101)
    centers = np.full(len(bins), np.nan)
    for k, b in enumerate(bins):
        m = (np.abs(u - b) < 0.012) & (np.abs(pos[:, 0]) < 0.03)
        if m.sum() >= 4:
            ys = pos[m, 1]
            centers[k] = (ys.max() + ys.min()) / 2
    ok = ~np.isnan(centers)
    centers = np.interp(bins, bins[ok], centers[ok])
    # でこぼこ(頭のこぶや背びれ)に引っぱられないよう、なめらかにする
    kernel = np.exp(-np.linspace(-2, 2, 15) ** 2)
    kernel /= kernel.sum()
    smooth = np.convolve(np.pad(centers, 7, mode='edge'), kernel, mode='valid')
    # 頭のまわり(u < 0.35)は動かさず、そこからうしろの曲がりだけをのばす
    smooth -= np.interp(0.35, bins, smooth)
    smooth[bins < 0.35] = 0
    # 尾のつけ根(u = TAIL_ROOT)よりうしろは、ここでは平行に動かすだけ(向きは flatten_fluke で、かたまりのまま起こす)
    smooth[bins > TAIL_ROOT] = np.interp(TAIL_ROOT, bins, smooth)
    dy = np.interp(u, bins, smooth)
    slope = np.gradient(smooth, bins)
    ang = np.arctan(np.interp(u, bins, slope))
    pos = pos.copy()
    pos[:, 1] -= dy
    # 曲がりをのばした分だけ、法線を y-z の面で回す
    c, s = np.cos(ang), np.sin(ang)
    ny, nz = nrm[:, 1].copy(), nrm[:, 2].copy()
    nrm = nrm.copy()
    nrm[:, 1] = c * ny + s * nz
    nrm[:, 2] = -s * ny + c * nz
    return flatten_fluke(pos, nrm)


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


def flatten_fluke(pos, nrm):
    """元のモデルは尾が下に曲がった姿なので、(1)尾の柄をまっすぐ体の線にそろえ、(2)尾びれの面をたいらに起こす"""
    root_z = TAIL_ROOT - 0.5
    notch_z = FLUKE_ROOT - 0.5
    # (1) 尾の柄: つけ根から尾びれのつけ根までの線が、水平になるように
    root_y, notch_y = mid_y(pos, root_z), mid_y(pos, notch_z)
    a1 = -np.arctan2(notch_y - root_y, notch_z - root_z)
    pos, nrm = rotate_part(pos, nrm, root_z, root_y, a1, TAIL_ROOT - 0.03, TAIL_ROOT + 0.02)
    # (2) 尾びれ: 左右の先のほうの点の並びが水平になるように
    u = pos[:, 2] + 0.5
    fl = (u > FLUKE_ROOT + 0.01) & (np.abs(pos[:, 0]) > 0.05)
    a2 = -np.arctan(np.polyfit(pos[fl, 2], pos[fl, 1], 1)[0])
    pos, nrm = rotate_part(pos, nrm, notch_z, mid_y(pos, notch_z), a2, FLUKE_ROOT - 0.01, FLUKE_ROOT + 0.015)
    print(f'尾の柄を {np.degrees(a1):.1f}度、尾びれを {np.degrees(a2):.1f}度 起こした')
    return pos, nrm


def build(tex_glb, fantasy_dir, cosmic_dir):
    g = GLTF2().load(tex_glb)
    blob = g.binary_blob()
    prim = g.meshes[0].primitives[0]
    pos = accessor(g, blob, prim.attributes.POSITION).astype(np.float64)
    nrm = accessor(g, blob, prim.attributes.NORMAL).astype(np.float64)
    uv = accessor(g, blob, prim.attributes.TEXCOORD_0).astype(np.float32)
    idx = accessor(g, blob, prim.indices).reshape(-1)

    # 頭を -z へ(y のまわりに半回転)
    pos[:, [0, 2]] *= -1
    nrm[:, [0, 2]] *= -1
    # 体長 1、まん中を原点に
    length = pos[:, 2].max() - pos[:, 2].min()
    pos[:, 2] -= (pos[:, 2].max() + pos[:, 2].min()) / 2
    pos /= length
    pos, nrm = straighten(pos, nrm)
    # 太くする(法線は逆の倍率で直す)
    pos[:, 0] *= THICKEN
    pos[:, 1] *= THICKEN
    nrm[:, 0] /= THICKEN
    nrm[:, 1] /= THICKEN
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
    # 体のまん中(u = 0.35)の高さを 0 に
    core = (np.abs(pos[:, 2] + 0.15) < 0.01) & (np.abs(pos[:, 0]) < 0.03)
    pos[:, 1] -= (pos[core, 1].max() + pos[core, 1].min()) / 2

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
    for name in SPECIALS:
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


def write_glb(path, pos, nrm, uv, idx, textures):
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

    ip = add_acc(pos, 5126, 'VEC3', 34962, True)
    inn = add_acc(nrm, 5126, 'VEC3', 34962)
    iu = add_acc(uv, 5126, 'VEC2', 34962)
    ii = add_acc(idx.astype(np.uint16 if idx.max() < 65536 else np.uint32), 5123 if idx.max() < 65536 else 5125, 'SCALAR', 34963)
    images = []
    for key in ['base', 'normal', 'rough']:
        images.append({'bufferView': add_view(textures[key]), 'mimeType': 'image/jpeg', 'name': key})
    gltf = {
        'asset': {'version': '2.0', 'generator': 'tools/build_whale_model.py'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': 'humpback'}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': ip, 'NORMAL': inn, 'TEXCOORD_0': iu}, 'indices': ii, 'material': 0}]}],
        'materials': [{
            'name': 'humpback',
            'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 2}, 'metallicFactor': 0, 'roughnessFactor': 1},
            'normalTexture': {'index': 1},
        }],
        'textures': [{'source': 0, 'sampler': 0}, {'source': 1, 'sampler': 0}, {'source': 2, 'sampler': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987}],
        'images': images,
        'accessors': accessors, 'bufferViews': views,
        'buffers': [{'byteLength': sum(len(c) for c in chunks)}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    bin_ = b''.join(chunks)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON') + js)
        f.write(struct.pack('<I4s', len(bin_), b'BIN\0') + bin_)


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__ or '使い方: python3 tools/build_whale_model.py <glb> <ファンタジー版のフォルダ> <宇宙版のフォルダ>')
    OUT.mkdir(parents=True, exist_ok=True)
    build(*sys.argv[1:])
