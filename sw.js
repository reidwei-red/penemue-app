const CACHE = 'penemue-v3';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css?v=3',
  './assets/js/app.js?v=3',
  './assets/js/github-store.js',
  './assets/js/tasks.js',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  // GitHub API 等跨域请求直接交给浏览器，绝不写入外壳缓存。
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
