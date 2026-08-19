// Voz Bíblica — guardado offline.
// La página siempre se pide primero a la red, para que nunca se quede pegada
// en una versión vieja. La copia guardada sólo entra si no hay internet.
const CACHE = 'vozbiblica-v1';
const ESTATICOS = ['./manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESTATICOS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const esPagina = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (esPagina) {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put('./', copia)).catch(() => {});
          return r;
        })
        .catch(() => caches.match('./').then(r => r || caches.match(req)))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(guardado => guardado || fetch(req).then(r => {
      if (r && r.status === 200) {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
      }
      return r;
    }).catch(() => guardado))
  );
});
