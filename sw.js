/* sw.js — service worker mínimo: cachea la app para que funcione offline
   y se pueda instalar como app en la pantalla de inicio. */

const CACHE = "toji-fit-v1";
const ASSETS = [
  "./", "./index.html", "./manifest.json",
  "./css/style.css",
  "./js/store.js", "./js/engine.js", "./js/gate.js",
  "./js/view-rutina.js", "./js/view-entrenar.js", "./js/view-comer.js", "./js/view-guias.js", "./js/view-yo.js",
  "./js/main.js",
  "./data/exercises.json", "./data/routine.json", "./data/recipes.json", "./data/nutrition.json",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResp => {
        if (networkResp && networkResp.ok) {
          const clone = networkResp.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return networkResp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
