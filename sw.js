/* Service Worker SEGPRIV v2.0
   Propósito: cumplir requisito PWA + cache mínimo seguro.
   Importante: NO cachea HTML ni navegaciones para evitar estados viejos en PWA.
*/

const CACHE_NAME = "segpriv-pwa-v2";

const ASSETS = [
  "./manifest.webmanifest",
  "./offline.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Instalar: precache mínimo, sin "./" ni "./index.html"
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activar: limpiar todos los caches anteriores
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      ),
      self.clients.claim()
    ])
  );
});

// Fetch: nunca cachear HTML/navegaciones
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const accept = req.headers.get("accept") || "";
  const isNavigation =
    req.mode === "navigate" || accept.includes("text/html");

  // HTML / navegación: siempre red.
  // Si no hay red, mostrar offline.html.
  if (isNavigation) {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match("./offline.html");
      })
    );
    return;
  }

  const url = new URL(req.url);

  // No interceptar recursos de otros dominios
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  // Assets propios: cache-first seguro
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
