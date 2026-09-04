/* sw.js — service worker mínimo: cachea la app para que funcione offline
   y se pueda instalar como app en la pantalla de inicio. */

const CACHE = "toji-fit-v8";
const ASSETS = [
  "./", "./index.html", "./manifest.json",
  "./css/style.css?v=8",
  "./js/firebase-config.js?v=8", "./js/store.js?v=8", "./js/engine.js?v=8", "./js/auth.js?v=8",
  "./js/view-quiz.js?v=8", "./js/view-rutina.js?v=8", "./js/view-entrenar.js?v=8", "./js/view-comer.js?v=8", "./js/view-guias.js?v=8", "./js/view-amigos.js?v=8", "./js/view-yo.js?v=8",
  "./js/main.js?v=8",
  "./data/exercises.json", "./data/routine.json", "./data/recipes.json", "./data/nutrition.json",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/flame.svg", "./icons/hero-silhouette.svg"
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
