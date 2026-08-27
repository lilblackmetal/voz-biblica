// Voz Bíblica — guardado offline.
// La página se muestra desde la copia guardada al instante y se actualiza por
// detrás; la siguiente vez que abras ya tienes la versión nueva. Así la app
// abre rápido incluso con internet lento.
const CACHE = 'vozbiblica-v4';

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
  const clave = esPagina ? './' : req;

  // Si trae ?v= es porque queremos forzar la versión nueva: primero la red.
  const forzar = esPagina && url.search.includes('v=');

  const desdeRed = () => fetch(req).then(r => {
    if (r && r.status === 200) {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(clave, copia)).catch(() => {});
    }
    return r;
  });

  if (forzar) {
    e.respondWith(desdeRed().catch(() => caches.match(clave)));
    return;
  }

  e.respondWith(
    caches.match(clave).then(guardado => {
      if (guardado) {
        // Se actualiza sin hacer esperar a nadie.
        desdeRed().catch(() => {});
        return guardado;
      }
      return desdeRed().catch(() => caches.match(req));
    })
  );
});
