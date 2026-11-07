# 電波がなくても動くようにする「サービスワーカー」(sw.js)を作る。
# 公開する前に毎回動かす: python3 tools/build_sw.py
#   ・アプリのファイルを全部書き出し、中身から版の名前を決める(ファイルが変わると版も変わり、新しいほうに入れかわる)
#   ・wav(予備の音)は入れない(ふつうは m4a を使うので)
import hashlib, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ['./', 'index.html', 'about.html', 'guide.html', 'manifest.webmanifest']
FILES += sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'assets/guide').glob('*.jpg'))
FILES += sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'src').rglob('*.js'))
FILES += sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'assets/audio').glob('*.m4a'))
FILES += sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'assets/icons').glob('*.png'))
# 外から読みこむ 3D の道具(index.html の importmap と同じ版)
CDN = [
    'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',
    'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/objects/Water.js',
]

h = hashlib.sha256()
for f in FILES:
    p = ROOT / ('index.html' if f == './' else f)
    h.update(f.encode()); h.update(p.read_bytes())
version = h.hexdigest()[:12]

sw = f'''// このファイルは tools/build_sw.py で作る(手で書きかえない)
// 一度開いたら、電波がなくても動くように、アプリのファイルを端末にとっておく
const VERSION = '{version}';
const APP = `whale-ocean-${{VERSION}}`;
const EXTRA = 'whale-ocean-extra';   // 文字の形など、あとから読みこんだもの
const FILES = {json.dumps(FILES, ensure_ascii=False, indent=2)};
const CDN = {json.dumps(CDN, indent=2)};

self.addEventListener('install', event => {{
  event.waitUntil((async () => {{
    const cache = await caches.open(APP);
    await cache.addAll(FILES);
    // 外のファイルは、読めなくてもアプリの準備は続ける
    await Promise.all(CDN.map(u => cache.add(new Request(u, {{ mode: 'cors' }})).catch(() => {{}})));
    // 新しい版は、使っている人が「更新」を押すまで待つ(使っている途中で中身が入れかわらないように)
  }})());
}});

// 「もうすぐクジラが来てくれるかも?」の通知を押したら、開いているアプリにもどる(なければ開く)
self.addEventListener('notificationclick', event => {{
  event.notification.close();
  event.waitUntil((async () => {{
    const list = await self.clients.matchAll({{ type: 'window', includeUncontrolled: true }});
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }})());
}});

self.addEventListener('message', event => {{
  if (event.data === 'skipWaiting') self.skipWaiting();
}});

self.addEventListener('activate', event => {{
  event.waitUntil((async () => {{
    for (const key of await caches.keys()) if (key.startsWith('whale-ocean-') && key !== APP && key !== EXTRA) await caches.delete(key);
    await self.clients.claim();
  }})());
}});

self.addEventListener('fetch', event => {{
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 紹介広告(A8.net)の画像は、とっておかない(表示した回数が正しく数えられるように、毎回読みこむ)
  if (/(^|[.])a8[.]net$/.test(url.hostname)) return;
  // ページそのものは、電波があれば新しいものを、なければとっておいたものを
  if (req.mode === 'navigate') {{
    event.respondWith((async () => {{
      try {{
        const fresh = await fetch(req);
        const cache = await caches.open(APP);
        cache.put(url.pathname.endsWith('/') ? './' : req, fresh.clone());
        return fresh;
      }} catch {{
        return (await caches.match(req, {{ ignoreSearch: true }})) ?? (await caches.match('./'));
      }}
    }})());
    return;
  }}
  // ほかは、とっておいたものを先に使う。なければ読みこんで、とっておく
  event.respondWith((async () => {{
    const hit = await caches.match(req, {{ ignoreSearch: url.origin === location.origin }});
    if (hit) return hit;
    const res = await fetch(req);
    const cacheable = res.ok || res.type === 'opaque';
    if (cacheable && (url.origin !== location.origin || url.pathname.match(/\\.(wav|png|m4a|js)$/))) {{
      const cache = await caches.open(url.origin === location.origin ? APP : EXTRA);
      cache.put(req, res.clone());
    }}
    return res;
  }})());
}});
'''
(ROOT / 'sw.js').write_text(sw)
print('sw.js', version, len(FILES), 'files')
