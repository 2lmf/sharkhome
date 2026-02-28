const CACHE_NAME = 'sharkhome-v2.5';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((resp) => {
            return resp || fetch(event.request).then((response) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    // Don't cache Google Sheets API calls
                    if (!event.request.url.includes('google.com')) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                });
            });
        }).catch(() => caches.match('./index.html'))
    );
});
