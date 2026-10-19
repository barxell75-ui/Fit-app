// Forja · service worker: guarda la app en caché para que funcione sin conexión.
// Al publicar una versión nueva, cambia CACHE para que los iPhone descarguen los archivos nuevos.
const CACHE = 'forja-v1.0.0';
const FILES = ['./', './index.html', './app.css', './app.js', './ui.js', './model.js', './exercises.js', './store.js',
  './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero caché (arranque instantáneo y sin conexión); si no está, red.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
