// Voz Bíblica — guardado offline.
// Todo se pide primero a la red y la copia guardada sólo entra cuando no hay
// internet. Así nada se queda pegado en una versión vieja.
const CACHE = 'vozbiblica-v3';

self.addEventListener('install', () => self.skipWaiting());

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
  if (new URL(req.url).origin !== self.location.origin) return;

  const esPagina = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  e.respondWith(
    fetch(req)
      .then(r => {
        if (r && r.status === 200) {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(esPagina ? './' : req, copia)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(esPagina ? './' : req).then(g => g || caches.match(req)))
  );
});
