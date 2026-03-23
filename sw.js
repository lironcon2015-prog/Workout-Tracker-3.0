/**
 * GymPro Elite — Service Worker
 * Version: 14.11.0-5
 * העלה את CACHE_VERSION בכל עדכון קוד כדי לרענן את ה-cache של המשתמשים.
 */

const CACHE_VERSION = 'gympro-v14.11.0-9';

const FILES_TO_CACHE = [
    './index.html',
    './style.css',
    './workout-core.js',
    './archive-logic.js',
    './editor-logic.js',
    './storage.js',
    './data.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache => {
            return cache.addAll(FILES_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_VERSION)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request);
        })
    );
});
