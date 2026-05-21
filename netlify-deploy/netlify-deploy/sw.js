// Contigo+ Service Worker v1.0
const CACHE_NAME = 'contigo-plus-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Instalación: cachear archivos estáticos
self.addEventListener('install', function(event) {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Cacheando archivos estáticos');
      return cache.addAll(STATIC_ASSETS);
    }).catch(function(err) {
      console.log('[SW] Error en cache:', err);
    })
  );
  self.skipWaiting();
});

// Activación: limpiar caches viejos
self.addEventListener('activate', function(event) {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: estrategia Network First con fallback a cache
self.addEventListener('fetch', function(event) {
  // Solo manejar requests GET
  if (event.request.method !== 'GET') return;

  // No interceptar requests a APIs externas (Anthropic, Google Fonts, Facebook)
  const url = new URL(event.request.url);
  const externalDomains = [
    'api.anthropic.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'connect.facebook.net',
    'www.facebook.com'
  ];
  if (externalDomains.some(domain => url.hostname.includes(domain))) {
    return;
  }

  event.respondWith(
    // Intentar red primero
    fetch(event.request)
      .then(function(response) {
        // Si la respuesta es válida, clonar y guardar en cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        // Si no hay red, buscar en cache
        return caches.match(event.request).then(function(cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback: retornar la página principal para navegación
          if (event.request.mode === 'navigate') {
            return caches.match('/') || caches.match('/index.html');
          }
        });
      })
  );
});

// Notificaciones push (preparado para futuras versiones)
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Contigo+';
  const options = {
    body: data.body || 'Tienes un recordatorio de bienestar 💜',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
