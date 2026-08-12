const CACHE_NAME = 'mis-gastos-cache-v1'
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-1024.png'
]

// Instalación: precargar assets estáticos en el cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  )
})

// Activación: limpiar caches viejos y tomar el control de la app inmediatamente
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  )
})

// Intercepción de peticiones: Network First con fallback a Cache / Offline
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET (como POST o PUT a la API/Supabase)
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Solo guardar en cache si la respuesta es válida y no es de la API de Supabase
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
        }
        return response
      })
      .catch(() => {
        // Si no hay conexión a internet, intentar servir desde el cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          // Fallback a la página principal si es una navegación
          if (event.request.mode === 'navigate') {
            return caches.match('/')
          }
        })
      })
  )
})