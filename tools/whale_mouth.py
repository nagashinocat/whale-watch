# 3Dモデルの口とまぶたを作る(tools/build_whale_model.py から使う)。
#
# 口: モデルの口の線(上あごと下あごのさかいのみぞ)で網目を切り分け、下あごが離れて開くようにする。
#     口の中(上あごの天井・ひげ板・舌と口の底・のどの奥の壁)を新しく作る。
#     頂点ごとの「あごの重み」(シェーダーの aJaw)もここで決める: [下あご, 上あご, のど, 下あごの回る量]
# まぶた: 目のくぼみ(モデルの目の玉の部分)を抜き、アプリの目の玉が見えるようにする。
#     まぶたの肌の頂点ごとに「閉じたときに動く量」(aLid)を決める。上まぶたは下りて目をおおい、下まぶたは少し上がる
import numpy as np

# 口の線: モデルを正面と横から写して、みぞの上を読みとったもの(体長1、頭が -z)
GAPE_FRONT = [(0.0, 0.006), (0.02, 0.008), (0.04, 0.0176), (0.055, 0.031), (0.065, 0.044)]          # 正面から (x, y)
GAPE_SIDE = [(0.04, 0.028), (0.08, 0.034), (0.12, 0.039), (0.16, 0.043), (0.2, 0.047),
             (0.234, 0.049), (0.248, 0.046), (0.253, 0.040)]                                       # 横から (u, y)
UPPER_FADE = (0.16, 0.25)   # 上あご(頭)が持ち上がる重みが、ここで 1 → 0
LOWER_FADE = (0.22, 0.29)   # 下あごの重みが、ここで 1 → 0(口の端のうしろは、のどの皮がのびてつながる)
EYE = dict(y=0.032, z=-0.212, open=0.0047, lid=0.011)   # 目のまん中、目の開きの半径、まぶたの肌の広さ
BALEEN = 0.04    # ひげ板のいちばん長いところ(体長1。14mで約0.55m)
FLOOR = 0.034    # 口の底の深さ(口の線から)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def gape_curve(pos):
    """口の線を、モデルの肌の上の点の列にする(左の口の端 → 口先 → 右の口の端)"""
    pts = []
    for x, y in GAPE_FRONT:
        m = (np.abs(pos[:, 0] - x) < 0.003) & (np.abs(pos[:, 1] - y) < 0.002) & (pos[:, 2] < -0.3)
        q = pos[m][np.argmin(pos[m][:, 2])]
        pts.append(q)
    for u, y in GAPE_SIDE:
        m = (np.abs(pos[:, 2] + 0.5 - u) < 0.003) & (np.abs(pos[:, 1] - y) < 0.002) & (pos[:, 0] > 0)
        q = pos[m][np.argmax(pos[m][:, 0])]
        pts.append(q)
    P = np.array(sorted(pts, key=lambda p: p[2]))
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    t = np.linspace(0, d[-1], 40)
    C = np.stack([np.interp(t, d, P[:, k]) for k in range(3)], 1)
    k = np.array([1, 2, 3, 2, 1], float) / 9
    S = C.copy()
    for j in range(3):
        S[2:-2, j] = np.convolve(C[:, j], k, 'valid')
    S[0, 0] = 0
    return np.concatenate([S[::-1] * [-1, 1, 1], S[1:]]), S   # 両側の線と、右半分(口先 → 右の口の端)


def classify(pos, curve):
    """頂点ごとに、口の線より上(+)か下(-)か。口の端よりうしろは切らない(valid = False)"""
    n = len(pos)
    f = np.zeros(n)
    valid = np.zeros(n, bool)
    corner_z, corner_y = curve[-1, 2], curve[-1, 1]
    head = np.where(pos[:, 2] < corner_z + 0.03)[0]
    for s in range(0, len(head), 4000):
        ids = head[s:s + 4000]
        d = np.linalg.norm(pos[ids, None, :] - curve[None, :, :], axis=2)
        k = np.argmin(d, axis=1)
        k0, k1 = np.clip(k - 1, 0, len(curve) - 1), np.clip(k + 1, 0, len(curve) - 1)
        T = curve[k1] - curve[k0]
        T /= np.linalg.norm(T, axis=1, keepdims=True)
        up = np.array([0, 1, 0]) - T * T[:, 1:2]
        up /= np.linalg.norm(up, axis=1, keepdims=True)
        f[ids] = np.sum((pos[ids] - curve[k]) * up, axis=1)
        inner = (k > 0) & (k < len(curve) - 1)
        valid[ids] = inner & (pos[ids, 2] < corner_z)
        # いちばん近いのが口の端(線のはし)の点のときは、口の端の高さより上か下かで決める(のどの下側など)
        f[ids] = np.where(inner, f[ids], pos[ids, 1] - corner_y)
    return f, valid


def cut(idx, f, valid):
    """口の線をまたぐ三角を、線のところで2つに切る。線の上の点は、上と下で別々の頂点にする(口が開く)。
    戻り値: 新しい三角のならび、足した頂点の作り方 [(i, j, t)]、足した頂点が下あご側か"""
    tris = idx.reshape(-1, 3)
    n0 = int(idx.max()) + 1
    extra, extra_lower, cache, out = [], [], {}, []
    side = lambda i: -1 if f[i] < 0 else 1

    def point(i, j, lower):
        key = (min(i, j), max(i, j), lower)
        if key not in cache:
            a, b = (i, j) if i < j else (j, i)
            t = f[a] / (f[a] - f[b])
            cache[key] = n0 + len(extra)
            extra.append((a, b, t))
            extra_lower.append(lower)
        return cache[key]

    for tri in tris:
        s = [side(i) for i in tri]
        if not all(valid[i] for i in tri) or s[0] == s[1] == s[2]:
            out.append(tri)
            continue
        # ひとつだけちがう側にある頂点を先頭に(向きはそのまま)
        lone = next(k for k in range(3) if s[k] != s[(k + 1) % 3] and s[k] != s[(k + 2) % 3])
        A, B, C = tri[lone], tri[(lone + 1) % 3], tri[(lone + 2) % 3]
        la = s[lone] < 0
        pa, qa = point(A, B, la), point(A, C, la)
        pb, qb = point(A, B, not la), point(A, C, not la)
        out += [[A, pa, qa], [pb, B, C], [pb, C, qb]]
    return np.array(out, dtype=np.int64).reshape(-1), extra, np.array(extra_lower, bool)


def extend(arr, extra):
    """足した頂点の値を、もとの頂点の値のまぜ合わせで作る。extra の1つは (i, j, t) か ([i, j, k], [wi, wj, wk])"""
    if not extra:
        return arr
    rows = []
    for e in extra:
        if len(e) == 3 and np.isscalar(e[2]):
            rows.append(arr[e[0]] * (1 - e[2]) + arr[e[1]] * e[2])
        else:
            ids, w = e
            rows.append(sum(arr[i] * wi for i, wi in zip(ids, w)))
    return np.concatenate([arr, np.array(rows, dtype=arr.dtype)])


def body_jaw(pos, lower, corner):
    """体の頂点の、あごの重み [下あご, 上あご, のど, 下あごの回る量]"""
    u = pos[:, 2] + 0.5
    low = (1 - smoothstep(*LOWER_FADE, u))
    w = np.where(lower, low, 0.0)
    # 口の端よりうしろ(切っていないところ)は、口の端の高さより下の皮が、なだらかにいっしょに下がる
    behind = (pos[:, 2] >= corner[2]) & (pos[:, 1] < corner[1]) & (u < LOWER_FADE[1])
    w = np.where(behind, low * smoothstep(0, 0.025, corner[1] - pos[:, 1]), w)
    up = np.where(~lower & (u < UPPER_FADE[1]) & (pos[:, 1] > corner[1] - 0.06), 1 - smoothstep(*UPPER_FADE, u), 0.0)
    return np.stack([w, up, np.zeros_like(w), w], 1).astype(np.float32)


def mouth_inside(right):
    """口の中の網目。right は口の線の右半分(口先 → 右の口の端)。
    戻り値: 位置、色(計算用の色)、あごの重み、三角"""
    P, C, J, I, M = [], [], [], [], []

    def grid(rows, cols, fn, region):
        base = len(P)
        for r in range(rows):
            for c in range(cols):
                s_, t_ = r / (rows - 1), c / (cols - 1)
                p, col, jaw = fn(s_, t_)
                P.append(p); C.append(col); J.append(jaw); M.append([region, s_, t_])   # 場所の種類と、その中の場所(模様を描くため)
        for r in range(rows - 1):
            for c in range(cols - 1):
                a = base + r * cols + c
                I.extend([a, a + 1, a + cols, a + 1, a + cols + 1, a + cols])

    n = len(right)
    u = right[:, 2] + 0.5
    lip_x = np.maximum(right[:, 0] * 0.93 - 0.0015, 0)   # 口の中は、肌より少し内側
    taper = np.sin(np.pi * np.clip((u - u[0]) / (u[-1] - u[0]), 0, 1)) ** 0.6
    upw = 1 - smoothstep(*UPPER_FADE, u)
    loww = 1 - smoothstep(*LOWER_FADE, u)
    at = lambda s: np.array([np.interp(s * (n - 1), np.arange(n), right[:, k]) for k in range(3)])
    lx = lambda s: np.interp(s * (n - 1), np.arange(n), lip_x)
    tp = lambda s: np.interp(s * (n - 1), np.arange(n), taper)
    uw = lambda s: np.interp(s * (n - 1), np.arange(n), upw)
    lw = lambda s: np.interp(s * (n - 1), np.arange(n), loww)
    PALATE, GUM, TONGUE, THROAT = [0.045, 0.022, 0.022], [0.22, 0.13, 0.13], [0.42, 0.20, 0.19], [0.03, 0.012, 0.012]

    # 上あごの天井(ひげ板のつけ根のあいだ)
    def palate(s, t):
        p = at(s); x = (2 * t - 1) * lx(s)
        return [x, p[1] + 0.004 * (1 - (2 * t - 1) ** 2) * tp(s), p[2] + 0.002], PALATE, [0, uw(s), 0, 0]
    grid(24, 9, palate, 1)
    # ひげ板(左右): 上あごのふちから下がる黒い幕。内側のはしは、ふさで茶色っぽい
    for sgn in (1, -1):
        def baleen(s, t, sgn=sgn):
            p = at(s); top = np.array([sgn * lx(s), p[1] - 0.0008, p[2] + 0.002])
            L = BALEEN * tp(s)
            bot = np.array([sgn * lx(s) * 0.72, p[1] - L, p[2] + 0.002])   # 内側へたれさがる(口の中の左右をうめる、毛のかたまり)
            q = top + (bot - top) * t
            # 1枚ずつの板の筋(前後に細かく、明るさをかえる)。内側のはしは、ふさで茶色っぽい
            stripe = 0.55 + 0.45 * np.sin(s * 160) ** 2
            col = list((np.array([0.012, 0.011, 0.01]) * (1 - t) + np.array([0.06, 0.045, 0.032]) * t) * stripe)
            return list(q), col, [0, uw(s), 0, 0]
        grid(90, 8, baleen, 2)
    # 口の底(下あごの内側の歯ぐきと舌): 左右の下くちびるのふちから、まん中の深いところへ
    def floor(s, t):
        p = at(s); k = 2 * t - 1
        # 口の底はくぼみ、まん中に大きくやわらかい舌がもり上がる
        y = p[1] - 0.0015 - FLOOR * tp(s) * (1 - abs(k) ** 3) + 0.5 * FLOOR * tp(s) * (1 - k * k) ** 2 * smoothstep(0.0, 0.25, s)
        col = list(np.array(GUM) + (np.array(TONGUE) - np.array(GUM)) * (1 - abs(k) ** 2))
        return [k * lx(s) * 0.98, y, p[2] + 0.003], col, [lw(s), 0, 0, lw(s)]
    grid(30, 17, floor, 3)
    # のどの奥の壁: 口の端で、天井と口の底をつなぐ暗い幕(口を開けると、のびて奥をふさぐ)
    def throat(s, t):
        p = right[-3]; k = 2 * t - 1; x = k * lip_x[-3]
        top = p[1] + 0.002
        bot = p[1] - 0.0015 - FLOOR * taper[-3] * (1 - abs(k) ** 3)
        return [x, top + (bot - top) * s, p[2] + 0.004], THROAT, [loww[-3] * s, upw[-3] * (1 - s), 0, loww[-3] * s]
    grid(6, 13, throat, 4)
    return (np.array(P, np.float32), np.array(C, np.float32), np.array(J, np.float32), np.array(I, np.int64), np.array(M, np.float32))


def eye_frames(pos, nrm):
    """左右の目のまん中(肌の上)と、外向き・上向き・前向きの向き"""
    frames = []
    for side in (1, -1):
        m = (np.sign(pos[:, 0]) == side) & (np.hypot(pos[:, 1] - EYE['y'], pos[:, 2] - EYE['z']) < 0.004)
        x = np.abs(pos[m, 0]).max() * side
        p0 = np.array([x, EYE['y'], EYE['z']])
        near = (np.sign(pos[:, 0]) == side) & (np.linalg.norm(pos - p0, axis=1) < 0.02)
        n = nrm[near].sum(0); n /= np.linalg.norm(n)
        up = np.array([0, 1, 0]) - n * n[1]; up /= np.linalg.norm(up)
        fwd = np.cross(up, n)
        frames.append((p0, n, up, fwd))
    return frames


EYE_OPEN = (0.0056, 0.0034)   # 目の開き(アーモンド形)の、横の半分と縦の半分
EYE_RINGS, EYE_SPOKES = 10, 72


def ray_hit(pos, tris, origin, direction):
    """origin から direction へのばした線が、いちばん先に当たる三角と、その中の場所(重み)"""
    A, B, C = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    e1, e2 = B - A, C - A
    h = np.cross(direction, e2)
    det = np.einsum('ij,ij->i', e1, h)
    ok = np.abs(det) > 1e-12
    inv = np.where(ok, 1 / np.where(ok, det, 1), 0)
    sv = origin - A
    u = np.einsum('ij,ij->i', sv, h) * inv
    q = np.cross(sv, e1)
    v = (q @ direction) * inv
    t = np.einsum('ij,ij->i', e2, q) * inv
    hit = ok & (u >= -1e-6) & (v >= -1e-6) & (u + v <= 1 + 1e-6) & (t > 0)
    if not hit.any():
        return None
    k = np.where(hit, t, np.inf).argmin()
    return k, np.array([1 - u[k] - v[k], u[k], v[k]])


def eye_uv(pos, uv, tris, p0, n, up, fwd, radius):
    """目のまわりのテクスチャの場所を、目のまん中と同じ島(テクスチャの切れ目のない一続きの部分)から、まっすぐな対応で求める式。
    まぶたの網目が、テクスチャの切れ目をまたいで、まだらにならないように"""
    hit = ray_hit(pos, tris, p0 + n * 0.03, -n)
    k, w = hit
    uv0 = (uv[tris[k]] * w[:, None]).sum(0)
    d = pos - p0
    near = (np.linalg.norm(d, axis=1) < radius) & (np.linalg.norm(uv - uv0, axis=1) < 0.04)
    X = np.stack([d[near] @ fwd, d[near] @ up, np.ones(near.sum())], 1)
    M, *_ = np.linalg.lstsq(X, uv[near], rcond=None)
    return lambda a, b: np.array([a, b, 1.0]) @ M


def eyelids(pos, nrm, idx, frames, uv=None):
    """目のまわりを、細かい網目(まぶたの肌)に作りなおす。
    体の三角は目のまわりだけ抜き、そこを、体の肌の上をなぞった細かい網目でうめる(色やテクスチャは、なぞった場所の体と同じ)。
    まん中はアーモンド形にあけて、アプリの目の玉が見えるようにする。
    戻り値: 新しい三角、足した頂点の作り方(extend 用)、足した頂点の数ぶんの閉じたときの動き(aLid)"""
    tris = idx.reshape(-1, 3)
    n0 = len(pos)
    extra, lid_add, new_tris, patch_uv, patch_uv0 = [], [], [], [], []
    keep = np.ones(len(tris), bool)
    A_, B_ = EYE_OPEN
    r_lid = EYE['lid']
    for p0, n, up, fwd in frames:
        cen = pos[tris].mean(1) - p0
        near_t = np.where(np.linalg.norm(cen, axis=1) < 0.04)[0]
        cand = tris[near_t]
        base = n0 + len(extra)
        k0, w0 = ray_hit(pos, cand, p0 + n * 0.03, -n)
        uv0 = (uv[cand[k0]] * w0[:, None]).sum(0)   # 目のまん中のテクスチャの場所(まぶたの網目は、テクスチャをここ1点にそろえる)
        for ring in range(EYE_RINGS + 1):
            rho = ring / EYE_RINGS
            for sp in range(EYE_SPOKES):
                phi = 2 * np.pi * sp / EYE_SPOKES
                e = A_ * B_ / np.hypot(B_ * np.cos(phi), A_ * np.sin(phi))   # だ円の半径
                R = e + (r_lid - e) * rho ** 1.3
                a, b = R * np.cos(phi), R * np.sin(phi)
                o = p0 + a * fwd + b * up + n * 0.03
                hit = ray_hit(pos, cand, o, -n)
                if hit is None:
                    hit = ray_hit(pos, cand, o - n * 0.06, n)
                k, w = hit
                ids = cand[k]
                extra.append((list(ids), list(w)))
                patch_uv.append((uv[ids] * np.array(w)[:, None]).sum(0))   # その点の、ほんとうのテクスチャの場所(色を写しとるため)
                patch_uv0.append(uv0)
                # 閉じたときの動き: 上まぶたのふちは、下まぶたのふちまで下りる。下まぶたは少し上がる。
                # ふち(rho = 0)ほど大きく動き、外へいくほど小さい。目の玉の丸みの上を通るよう、外へ少し出る
                edge = B_ * np.sqrt(max(0.0, 1 - (np.clip(a / A_, -1, 1)) ** 2)) if abs(a) < A_ else 0.0
                fall = (1 - rho) ** 1.6
                if np.sin(phi) >= 0:
                    db = -1.62 * edge * fall
                    dc = 1.0 * MODEL_EYE_R * (1 - rho) ** 1.2 * max(edge / B_, 0.35)
                else:
                    db = 0.38 * edge * fall
                    dc = 0.5 * MODEL_EYE_R * (1 - rho) ** 1.2 * max(edge / B_, 0.35)
                lid_add.append(db * up + dc * n)
        for ring in range(EYE_RINGS):
            for sp in range(EYE_SPOKES):
                i0 = base + ring * EYE_SPOKES + sp
                i1 = base + ring * EYE_SPOKES + (sp + 1) % EYE_SPOKES
                new_tris += [[i0, i0 + EYE_SPOKES, i1], [i1, i0 + EYE_SPOKES, i1 + EYE_SPOKES]]   # 外向きが表
        # 体の三角は、まぶたの網目の内側だけ抜く(抜いたふちは、まぶたの網目の外側の輪の下にかくれる)
        d = pos[tris] - p0
        r_v = np.hypot(d @ fwd, d @ up)
        c_v = d @ n
        inside = ((r_v < r_lid * 0.82).any(1) | (np.hypot(cen @ fwd, cen @ up) < r_lid * 0.82)) & (np.abs(c_v) < 0.015).all(1)
        keep &= ~inside
    return (np.concatenate([tris[keep].reshape(-1), np.array(new_tris, np.int64).reshape(-1)]), extra,
            np.array(lid_add, np.float32), np.array(patch_uv, np.float32), np.array(patch_uv0, np.float32))


MODEL_EYE_R = 0.0052   # アプリの目の玉の半径(src/logic/whaleModelLayout.js の MODEL.eye.radius と同じ)
