/**
 * NOXIS SERVICE WORKER - Performance Optimized
 *
 * Stratejiler:
 * 1. Static assets (JS/CSS/fonts): Cache First - uzun süre cache'le
 * 2. TMDB görseller: Cache First with Network Fallback - bandwidth tasarrufu
 * 3. API responses: Network First - güncellik önemli
 * 4. Video streams: Network Only - cache'lenmez (WebTorrent uyumluluğu)
 */

const CACHE_VERSION = 'noxis-v4';
const STATIC_CACHE = `noxis-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `noxis-images-${CACHE_VERSION}`;
const API_CACHE = `noxis-api-${CACHE_VERSION}`;

// Cache boyut limitleri (entry sayısı)
const MAX_IMAGE_CACHE_SIZE = 200;
const MAX_API_CACHE_SIZE = 50;

// Cache'lenecek static dosyalar
const STATIC_ASSETS = [
    '/noxis-logo.svg'
];

// Cache'lenmeyecek URL pattern'leri (WebTorrent uyumluluğu)
const NO_CACHE_PATTERNS = [
    /\/local-video\//,
    /\/stream/,
    /\/api\/video-proxy/,
    /\/api\/vidmody\/resolve(\?|$)/,
    /\/api\/diziyou(\?|$)/,
    /\/api\/dizimom(\?|$)/,
    /\/api\/subtitles(\?|$)/,
    /\/api\/subtitle-proxy(\?|$)/,
    /\/subtitles(\?|$)/,
    /\/subtitle-proxy(\?|$)/,
    /mode=master/,
    /mode=proxy/,
    /workers\.dev/i,
    /\.m3u8(\?|$)/,
    /\.ts(\?|$)/,
    /\.vtt(\?|$)/,
    /webtorrent/,
    /wss?:\/\//,
    /magnet:/
];

// Install: Static asset'leri precache et
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
            .catch(err => {
                console.warn('[SW] Precache failed:', err);
                self.skipWaiting();
            })
    );
});

// Activate: Eski cache'leri temizle
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => {
                return Promise.all(
                    keys.filter(key =>
                        key !== STATIC_CACHE &&
                        key !== IMAGE_CACHE &&
                        key !== API_CACHE
                    ).map(key => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Cache boyutunu sınırla (LRU benzeri)
const limitCacheSize = async (cacheName, maxSize) => {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    if (keys.length > maxSize) {
        // En eski entry'leri sil (FIFO)
        const toDelete = keys.slice(0, keys.length - maxSize);
        await Promise.all(toDelete.map(key => cache.delete(key)));
    }
};

// URL'in cache'lenmemesi gerekip gerekmediğini kontrol et
const shouldNotCache = (url) => {
    return NO_CACHE_PATTERNS.some(pattern => pattern.test(url));
};

// TMDB görsel URL'i mi?
const isTmdbImage = (url) => {
    return url.includes('image.tmdb.org');
};

// Static asset mi?
const isStaticAsset = (url) => {
    return /\.(js|css|woff2?|ttf|eot|svg|ico|json|webmanifest)(\?.*)?$/.test(url);
};

// API isteği mi?
const isApiRequest = (url) => {
    return url.includes('/api/') && !url.includes('/api/video-proxy');
};

// Fetch: Akıllı cache stratejisi
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = request.url;

    // Cache'lenmeyecek istekler - doğrudan network'e git
    if (shouldNotCache(url) || request.method !== 'GET') {
        return; // Default browser behavior
    }

    // HTML navigations: daima ağı öncele ki yeni deploy eski index.html'de takılı kalmasın
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const cloned = response.clone();
                        caches.open(STATIC_CACHE).then(cache => {
                            cache.put('/index.html', cloned);
                        });
                    }
                    return response;
                })
                .catch(async () => {
                    const cache = await caches.open(STATIC_CACHE);
                    return cache.match('/index.html') || cache.match('/');
                })
        );
        return;
    }

    // TMDB görselleri: Cache First (bandwidth tasarrufu)
    if (isTmdbImage(url)) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(async (cache) => {
                const cachedResponse = await cache.match(request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                try {
                    const networkResponse = await fetch(request);
                    if (networkResponse.ok) {
                        cache.put(request, networkResponse.clone());
                        // Cache boyutunu kontrol et (async, response'u bekletme)
                        limitCacheSize(IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE);
                    }
                    return networkResponse;
                } catch (err) {
                    console.warn('[SW] Image fetch failed:', url);
                    return new Response('', { status: 404 });
                }
            })
        );
        return;
    }

    // Static assets: Cache First
    if (isStaticAsset(url)) {
        event.respondWith(
            caches.match(request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then(networkResponse => {
                    const contentType = networkResponse.headers.get('content-type') || '';
                    const isModuleLike = /\.(js|css|json|webmanifest)(\?.*)?$/.test(new URL(request.url).pathname);
                    if (isModuleLike && contentType.includes('text/html')) {
                        return new Response('', {
                            status: 502,
                            statusText: 'Invalid asset response'
                        });
                    }
                    if (networkResponse.ok) {
                        const cloned = networkResponse.clone();
                        caches.open(STATIC_CACHE).then(cache => {
                            cache.put(request, cloned);
                        });
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // API requests: Network First (güncellik önemli)
    if (isApiRequest(url)) {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    if (networkResponse.ok) {
                        const cloned = networkResponse.clone();
                        caches.open(API_CACHE).then(cache => {
                            cache.put(request, cloned);
                            limitCacheSize(API_CACHE, MAX_API_CACHE_SIZE);
                        });
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    // Offline: Cache'den dön
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return new Response(
                        JSON.stringify({ error: 'Offline', cached: false }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }

    // Diğer tüm istekler: Network with Cache Fallback
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok && request.method === 'GET') {
                    const cloned = response.clone();
                    caches.open(STATIC_CACHE).then(cache => {
                        cache.put(request, cloned);
                    });
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});

// Background sync için message handler (ileride kullanılabilir)
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        event.waitUntil(self.skipWaiting());
        return;
    }

    if (event.data?.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(keys =>
                Promise.all(keys.map(key => caches.delete(key)))
            )
        );
    }
});
