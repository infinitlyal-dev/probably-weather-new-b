self.addEventListener('install', (e) => {
    e.waitUntil(
      caches.open('probably-cache').then((cache) => cache.addAll([
        '/',
        '/index.html',
        '/assets/app.css',
        '/assets/app.js',
      ]))
    );
  });
  
  self.addEventListener('fetch', (e) => {
    e.respondWith(
      caches.match(e.request).then((response) => response || fetch(e.request))
    );
  });