const CACHE_NAME = 'my-cool-game-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/lib/phaser.js',
  '/src/play.js',
  '/src/main.js',
  '/src/LanguageManager.js',
  '/style.css',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic&family=Noto+Sans+TC&display=swap', 
  '/assets/sprite.png', 
];

// Install event - caching assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching essential files...');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches if needed
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve files from cache if available, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Serve from cache if available
      }
      return fetch(event.request); // Otherwise fetch from network
    })
  );
});
