/**
 * GymPro Elite — Service Worker
 * Version: 17.15
 * העלה את CACHE_VERSION בכל עדכון קוד כדי לרענן את ה-cache של המשתמשים.
 */

const CACHE_VERSION = 'gympro-v17.15';
const IMG_CACHE = 'gympro-images-v2';

const FILES_TO_CACHE = [
    './index.html',
    './style.css',
    './workout-core.js',
    './archive-logic.js',
    './editor-logic.js',
    './bodylog-logic.js',
    './food-logic.js',
    './storage.js',
    './data.js',
    './manifest.json',
    './version.json',
    './icon-192.png',
    './icon-512.png',
    './img/thumb-arms-1.jpg',
    './img/thumb-chest-1.jpg',
    './img/thumb-shoulders-1.jpg',
    './img/thumb-back-1.jpg',
    './img/thumb-legs-1.jpg',
    './img/bg-track.jpg',
    './img/bg-barbell.jpg',
    './img/bg-dumbbells.jpg',
    './img/bg-berries.jpg',
    './img/bg-eggs.jpg',
    './img/bg-bowl.jpg',
    './img/bg-avocado.jpg',
    './img/bg-meal.jpg'
];

self.addEventListener('install', event => {
    // קריטי: fetch עם no-store — עוקף את ה-HTTP cache של iOS.
    // addAll רגיל מקבל עותקים ישנים מה-HTTP cache, וה-cache החדש
    // נולד "מורעל" בקבצי הגרסה הקודמת (הגרסה לא מתעדכנת לעולם).
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache =>
            Promise.all(FILES_TO_CACHE.map(url =>
                fetch(url, { cache: 'no-store' }).then(resp => {
                    if (!resp.ok) throw new Error('SW install fetch failed: ' + url);
                    return cache.put(url, resp);
                })
            ))
        )
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

    // תמונות חיצוניות (LH3 של תרגילים, Unsplash של מסך הבית/סיום/בורר רקעים) —
    // cache-first, נשמר לאחר ה-fetch הראשון. בלי זה מסך הבית עומד ריק ב-offline.
    if (url.includes('lh3.googleusercontent.com') || url.includes('images.unsplash.com')) {
        event.respondWith(
            caches.open(IMG_CACHE).then(cache =>
                cache.match(event.request).then(cached => {
                    if (cached) return cached;
                    return fetch(event.request).then(response => {
                        if (response.ok) cache.put(event.request, response.clone());
                        return response;
                    });
                })
            ).catch(() => new Response('', { status: 503, statusText: 'Offline' }))
        );
        return;
    }

    // ספריות vendor (ZBar) — cache-first עם שמירה בזמן ריצה. נטענות עצלה רק
    // ב-fallback של iOS, ולכן לא ב-pre-cache (כדי לא להוריד ~330KB לכל המשתמשים).
    if (url.includes('/vendor/')) {
        event.respondWith(
            caches.open(CACHE_VERSION).then(cache =>
                cache.match(event.request).then(cached => {
                    if (cached) return cached;
                    return fetch(event.request).then(response => {
                        if (response.ok) cache.put(event.request, response.clone());
                        return response;
                    });
                })
            ).catch(() => new Response('', { status: 503, statusText: 'Offline' }))
        );
        return;
    }

    // קבצים מקומיים — cache-first; בכשל רשת (offline + לא ב-cache) — fallback
    // ל-index.html עבור ניווט, ותגובת 503 שקטה לכל השאר במקום שגיאת רשת לא מטופלת
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request);
        }).catch(() => {
            if (event.request.mode === 'navigate') return caches.match('./index.html');
            return new Response('', { status: 503, statusText: 'Offline' });
        })
    );
});
