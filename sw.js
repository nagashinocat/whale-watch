// このファイルは tools/build_sw.py で作る(手で書きかえない)
// 一度開いたら、電波がなくても動くように、アプリのファイルを端末にとっておく
const VERSION = 'c814828378ec';
const APP = `whale-ocean-${VERSION}`;
const EXTRA = 'whale-ocean-extra';   // 文字の形など、あとから読みこんだもの
const FILES = [
  "./",
  "index.html",
  "about.html",
  "guide.html",
  "gallery.html",
  "manifest.webmanifest",
  "assets/guide/en-alarm.jpg",
  "assets/guide/en-book.jpg",
  "assets/guide/en-card.jpg",
  "assets/guide/en-closed.jpg",
  "assets/guide/en-panel.jpg",
  "assets/guide/en-sleep.jpg",
  "assets/guide/en-sleeptimer.jpg",
  "assets/guide/en-start.jpg",
  "assets/guide/en-timer.jpg",
  "assets/guide/en-whale.jpg",
  "assets/guide/ja-alarm.jpg",
  "assets/guide/ja-book.jpg",
  "assets/guide/ja-card.jpg",
  "assets/guide/ja-closed.jpg",
  "assets/guide/ja-panel.jpg",
  "assets/guide/ja-sleep.jpg",
  "assets/guide/ja-sleeptimer.jpg",
  "assets/guide/ja-start.jpg",
  "assets/guide/ja-timer.jpg",
  "assets/guide/ja-whale.jpg",
  "assets/guide/scene.jpg",
  "src/audio/mixer.js",
  "src/logic/ads.js",
  "src/logic/astro.js",
  "src/logic/away.js",
  "src/logic/backup.js",
  "src/logic/behavior.js",
  "src/logic/breach.js",
  "src/logic/breathing.js",
  "src/logic/comingSoon.js",
  "src/logic/config.js",
  "src/logic/eyeShape.js",
  "src/logic/features3d.js",
  "src/logic/feeding.js",
  "src/logic/firstWhale.js",
  "src/logic/flukeId.js",
  "src/logic/foam.js",
  "src/logic/gains.js",
  "src/logic/gallery.js",
  "src/logic/galleryConfig.js",
  "src/logic/hints.js",
  "src/logic/i18n.js",
  "src/logic/impact.js",
  "src/logic/kids.js",
  "src/logic/lighting.js",
  "src/logic/migration.js",
  "src/logic/northPacific.js",
  "src/logic/patterns.js",
  "src/logic/photoScore.js",
  "src/logic/photos.js",
  "src/logic/places.js",
  "src/logic/plus.js",
  "src/logic/quality.js",
  "src/logic/research.js",
  "src/logic/scheduler.js",
  "src/logic/settings.js",
  "src/logic/sky.js",
  "src/logic/skyPalette.js",
  "src/logic/sleep.js",
  "src/logic/sleepTimer.js",
  "src/logic/songs.js",
  "src/logic/spawn.js",
  "src/logic/specialCoats.js",
  "src/logic/splash.js",
  "src/logic/time.js",
  "src/logic/timer.js",
  "src/logic/tour.js",
  "src/logic/traits.js",
  "src/logic/view.js",
  "src/logic/waterNormals.js",
  "src/logic/whaleShape.js",
  "src/logic/whisper.js",
  "src/logic/zukan.js",
  "src/main.js",
  "src/scene/cameras.js",
  "src/scene/effects.js",
  "src/scene/footprints.js",
  "src/scene/ocean.js",
  "src/scene/portrait.js",
  "src/scene/sky.js",
  "src/scene/whaleModel.js",
  "src/scene/whales.js",
  "src/scene/whitecaps.js",
  "src/ui/flukeCanvas.js",
  "src/ui/galleryPage.js",
  "src/ui/kids.js",
  "src/ui/menu.js",
  "src/ui/migrationMap.js",
  "src/ui/photoStore.js",
  "src/ui/shareCard.js",
  "src/ui/zukan.js",
  "assets/audio/blow.m4a",
  "assets/audio/breach-rise.m4a",
  "assets/audio/breach.m4a",
  "assets/audio/bubbles.m4a",
  "assets/audio/humpback-call.m4a",
  "assets/audio/humpback-song.m4a",
  "assets/audio/pec-slap.m4a",
  "assets/audio/sperm-clicks.m4a",
  "assets/audio/splash.m4a",
  "assets/audio/tail-slap.m4a",
  "assets/audio/waves-cliff.m4a",
  "assets/audio/waves-surface.m4a",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon-32.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/og.png"
];
const CDN = [
  "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/objects/Water.js"
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP);
    await cache.addAll(FILES);
    // 外のファイルは、読めなくてもアプリの準備は続ける
    await Promise.all(CDN.map(u => cache.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    // 新しい版は、使っている人が「更新」を押すまで待つ(使っている途中で中身が入れかわらないように)
  })());
});

// 「もうすぐクジラが来てくれるかも?」の通知を押したら、開いているアプリにもどる(なければ開く)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('whale-ocean-') && key !== APP && key !== EXTRA) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 紹介広告(A8.net)の画像は、とっておかない(表示した回数が正しく数えられるように、毎回読みこむ)
  if (/(^|[.])a8[.]net$/.test(url.hostname)) return;
  // みんなのギャラリー(Supabase)の写真と一覧は、いつも新しいものを読む
  if (/(^|[.])supabase[.]co$/.test(url.hostname)) return;
  // ページそのものは、電波があれば新しいものを、なければとっておいたものを
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(APP);
        cache.put(url.pathname.endsWith('/') ? './' : req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(req, { ignoreSearch: true })) ?? (await caches.match('./'));
      }
    })());
    return;
  }
  // ほかは、とっておいたものを先に使う。なければ読みこんで、とっておく
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: url.origin === location.origin });
    if (hit) return hit;
    const res = await fetch(req);
    const cacheable = res.ok || res.type === 'opaque';
    if (cacheable && (url.origin !== location.origin || url.pathname.match(/\.(wav|png|m4a|js)$/))) {
      const cache = await caches.open(url.origin === location.origin ? APP : EXTRA);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
