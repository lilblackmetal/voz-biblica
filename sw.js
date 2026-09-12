// Voz Bíblica — guardado offline.
// Las páginas Y el código (support.js, estilos) se piden siempre a la red, con
// la copia guardada como respaldo si no hay internet: así una versión nueva se
// ve en la primera recarga. Sólo las imágenes van desde la copia guardada, que
// es lo que hace que la app abra rápido.
const CACHE = 'vozbiblica-v16';

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
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const esPagina = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const esCodigo = /\.(js|css|json)$/i.test(url.pathname);

  const desdeRed = () => fetch(req).then(r => {
    if (r && r.status === 200) {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
    }
    return r;
  });

  // Páginas y código: red primero, copia guardada solo si falla la red.
  if (esPagina || esCodigo) {
    e.respondWith(desdeRed().catch(() => caches.match(req)));
    return;
  }

  // Imágenes: copia guardada primero, y se refresca por detrás.
  e.respondWith(
    caches.match(req).then(guardado => {
      if (guardado) {
        desdeRed().catch(() => {});
        return guardado;
      }
      return desdeRed().catch(() => caches.match(req));
    })
  );
});
