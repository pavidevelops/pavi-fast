/*
  PAVI FAST — Service Worker (offline inteligente)
  Versao: 2026.01.15-02

  ✔ HTML: cache-first (SEM fallback para index.html)
  ✔ Assets: stale-while-revalidate
  ✔ Apps Script (/exec): network-only
*/

const VERSION = '2026.01.15-02';

const CACHE_CORE   = `pavi-fast-core-${VERSION}`;
const CACHE_ASSETS = `pavi-fast-assets-${VERSION}`;

const CORE_URLS = [
  './',
  './index.html',
  './poslog.html',
  './seletor_lotes.html',
  './primeiro_acesso.html',
  './manifest.webmanifest',
  './logo.png',

  // Fonts locais
  './FunnelSans-Regular.ttf',
  './FunnelSans-Medium.ttf',
  './FunnelSans-SemiBold.ttf',
  './FunnelSans-Bold.ttf',
  './FunnelSans-Italic.ttf',
  './FunnelSans-BoldItalic.ttf',

  // Roboto (se estiver local)
  './Roboto-VariableFont_wdth,wght.ttf',
  './Roboto-Italic-VariableFont_wdth,wght.ttf'
];

/* ==========================================================
   INSTALL
========================================================== */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_CORE);
    await cache.addAll(CORE_URLS);
    self.skipWaiting();
  })());
});

/* ==========================================================
   ACTIVATE
========================================================== */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        if (k.startsWith('pavi-fast-') && k !== CACHE_CORE && k !== CACHE_ASSETS) {
          return caches.delete(k);
        }
      })
    );
    self.clients.claim();
  })());
});

/* ==========================================================
   HELPERS
========================================================== */
function isAppsScript(url) {
  return (
    url.hostname === 'script.google.com' ||
    url.hostname.endsWith('.googleusercontent.com')
  );
}

function isHtmlRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  );
}

function isGoogleFont(url) {
  return (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_CORE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const resp = await fetch(request);
  if (resp && resp.ok) {
    cache.put(request, resp.clone());
  }
  return resp;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_ASSETS);
  const cached = await cache.match(request, { ignoreSearch: true });

  const fetchPromise = fetch(request)
    .then((resp) => {
      if (resp && resp.ok) {
        cache.put(request, resp.clone());
      }
      return resp;
    })
    .catch(() => null);

  return cached || fetchPromise;
}

/* ==========================================================
   FETCH
========================================================== */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1️⃣ Apps Script → SEMPRE REDE
  if (isAppsScript(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // 2️⃣ HTML (navegação) → cache-first SEM fallback indevido
  if (isHtmlRequest(request) && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        return await cacheFirst(request);
      } catch (e) {
        // ❌ NÃO redireciona para index.html
        return Response.error();
      }
    })());
    return;
  }

  // 3️⃣ Google Fonts
  if (isGoogleFont(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 4️⃣ Mesma origem (imagens, fontes, css, js)
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 5️⃣ Outros → rede padrão
  event.respondWith(fetch(request));
});
