/**
 * GymPro Elite — Service Worker
 * Version: 15.7
 * העלה את CACHE_VERSION בכל עדכון קוד כדי לרענן את ה-cache של המשתמשים.
 */

const CACHE_VERSION = 'gympro-v15.7';
const IMG_CACHE = 'gympro-images-v1';

const FILES_TO_CACHE = [
    './index.html',
    './style.css',
    './workout-core.js',
    './archive-logic.js',
    './editor-logic.js',
    './storage.js',
    './data.js',
    './manifest.json',
    './version.json',
    './icon-192.png',
    './icon-512.png'
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
                    .filter(key => key !== CACHE_VERSION && key !== IMG_CACHE)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // תמונות חיצוניות מ-LH3 — cache-first, שומר לאחר fetch ראשון
    if (url.includes('lh3.googleusercontent.com')) {
        event.respondWith(
            caches.open(IMG_CACHE).then(cache =>
                cache.match(event.request).then(cached => {
                    if (cached) return cached;
                    return fetch(event.request).then(response => {
                        if (response.ok) cache.put(event.request, response.clone());
                        return response;
                    });
                })
            )
        );
        return;
    }

    // קבצים מקומיים — cache-first
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request);
        })
    );
});
