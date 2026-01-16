/*
  PAVI FAST — Service Worker (offline inteligente)
  Versao: 2026.01.15-01

  - Abre offline (cache-first) para paginas HTML
  - Assets: stale-while-revalidate (abre do cache e atualiza quando online)
  - Apps Script (/exec): network-only (nao cacheia)
*/

const VERSION = '2026.01.15-01';
const CACHE_CORE = `pavi-fast-core-${VERSION}`;
const CACHE_ASSETS = `pavi-fast-assets-${VERSION}`;

const CORE_URLS = [
  "./",
  "./index.html",
  "./FunnelSans-Bold.ttf",
  "./FunnelSans-BoldItalic.ttf",
  "./FunnelSans-Italic.ttf",
  "./FunnelSans-Medium.ttf",
  "./FunnelSans-Regular.ttf",
  "./FunnelSans-SemiBold.ttf",
  "./Roboto-Italic-VariableFont_wdth,wght.ttf",
  "./Roboto-VariableFont_wdth,wght.ttf",
  "./logo.png",
  "./poslog.html",
  "./primeiro_acesso.html",
  "./seletor_lotes.html",
  "./manifest.webmanifest"
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_CORE);
    await cache.addAll(CORE_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k.startsWith('pavi-fast-') && k !== CACHE_CORE && k !== CACHE_ASSETS) {
        return caches.delete(k);
      }
    }));
    self.clients.claim();
  })());
});

function isAppsScript(url) {
  return url.hostname === 'script.google.com' || url.hostname.endsWith('.googleusercontent.com');
}

function isHtmlRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

function isFontOrCss(url) {
  return url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_CORE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const resp = await fetch(request);
  if (resp && resp.ok) cache.put(request, resp.clone());
  return resp;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_ASSETS);
  const cached = await cache.match(request, { ignoreSearch: true });

  const fetchPromise = fetch(request)
    .then((resp) => {
      if (resp && resp.ok) cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => null);

  return cached || (await fetchPromise);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1) Apps Script: sempre rede
  if (isAppsScript(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // 2) Navegacao (HTML): cache-first (abre offline garantido)
  if (isHtmlRequest(request) && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        return await cacheFirst(request);
      } catch (e) {
        const cache = await caches.open(CACHE_CORE);
        // fallback: index.html (garante abrir algo)
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // 3) Google Fonts: cache runtime (ajuda offline mesmo com link externo)
  if (isFontOrCss(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 4) Mesma origem (imagens, fontes locais, etc.): stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 5) Outros: rede normal
  event.respondWith(fetch(request));
});
