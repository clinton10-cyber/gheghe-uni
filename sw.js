// Ghegeh University service worker.
// - Versioned cache: bump VERSION on every deploy so old caches are deleted.
// - Code/HTML/CSS: network-first (players always get new deploys, offline falls back to cache).
// - Everything else same-origin (3D vendor, models, icons): stale-while-revalidate.
// - The index.html fallback is for page navigations only. The old worker returned HTML for failed
//   .js requests, which broke ES modules offline.
const VERSION = "v9";
const CACHE = `ghegeh-university-${VERSION}`;
const CORE = ["./", "./index.html", "./css/fonts.css", "./css/hud-icons.css", "./css/hud.css", "./css/hud-landscape.css", "./css/uni.css", "./assets/fonts/archivo-latin-wdth.woff2", "./src/main.js", "./src/life.js", "./src/progress.js", "./src/quality.js", "./manifest.webmanifest", "./icons/icon-192.png", "./game-assets/vendor/three/three.module.min.js"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // allSettled: one missing file must not abort the whole install (addAll is all-or-nothing).
    await Promise.allSettled(CORE.map(u => cache.add(new Request(u, { cache: "reload" }))));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("ghegeh-university-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isCode = url => /\.(?:js|mjs|css|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/");
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") return (await cache.match("./index.html")) || Response.error();
    return Response.error();
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const refresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await refresh) || Response.error();
}
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(req.mode === "navigate" || isCode(url) ? networkFirst(req) : staleWhileRevalidate(req));
});
