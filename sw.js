const CACHE_NAME = 'tuneit-v6-cache';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/assets/logo.png',
  '/assets/album_art.png'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caching App Shell...');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For API calls, use Network First, fallback to Cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, resClone);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else if (url.hostname === 'res.cloudinary.com' || url.hostname === 'itunes.apple.com') {
    // For media and external images, use Cache First
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Don't cache opaque responses or errors heavily
          if(!response || response.status !== 200 || response.type !== 'basic') {
              if (response.type === 'opaque') {
                  const resClone = response.clone();
                  caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
              }
              return response;
          }
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return response;
        });
      })
    );
  } else {
    // For local assets (HTML, CSS, JS), use Stale-While-Revalidate
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(networkRes => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkRes.clone()));
          return networkRes;
        }).catch(() => {});
        return cached || fetchPromise;
      })
    );
  }
});
