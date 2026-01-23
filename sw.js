// 2) Navegacao (HTML): cache-first SEM fallback forçado
if (isHtmlRequest(request) && url.origin === self.location.origin) {
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_CORE);
    const cached = await cache.match(request, { ignoreSearch: true });

    if (cached) return cached;

    try {
      const resp = await fetch(request);
      if (resp && resp.ok) {
        cache.put(request, resp.clone());
        return resp;
      }
      return resp;
    } catch (e) {
      // ❌ NÃO redireciona para index.html
      // retorna erro real (ou página offline, se quiser criar uma)
      return Response.error();
    }
  })());
  return;
}
