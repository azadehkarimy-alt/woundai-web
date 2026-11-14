const CACHE_NAME = 'woundai-release-v30-8';
const CORE_ASSETS = [
  './', './index.html', './education.html', './API-connection-mini-test.html',
  './styles.css', './clinical-validation-v30.js', './local-db-v308.js', './clinical-guidelines/instrument-implementation-status.json', './app.js', './api-config.js', './tissue-api-v30.js', './supabase-config.js', './supabase-client-v30.js', './supabase-ui-v30.js', './cloud-sync-v30.js', './offline-image-store-v307.js', './clinical-sync-v308.js', './offsite-backup-v308.js', './manifest.webmanifest',
  './assets/woundai-icon-192.png', './assets/woundai-icon-512.png',
  './assets/woundai-icon-apple.png', './assets/icon.svg', './icon.svg',
  './assets/woundai-logo.png', './assets/woundai-logo-horizontal.png',
  './assets/woundai-logo-square.png', './assets/body-front-v20.png',
  './assets/body-back-v20.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('woundai-release-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;
  const isAppShell = /\/(?:app\.js|local-db-v308\.js|styles\.css|api-config\.js|tissue-api-v30\.js|supabase-config\.js|supabase-client-v30\.js|supabase-ui-v30\.js|cloud-sync-v30\.js|offline-image-store-v307\.js|clinical-sync-v308\.js|offsite-backup-v308\.js)$/.test(pathname);
  if (request.mode === 'navigate' || isAppShell) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) ||
          (request.mode === 'navigate' ? (await caches.match('./index.html')) : null) ||
          Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
