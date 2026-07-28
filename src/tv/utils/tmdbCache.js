import { getApiBaseUrl } from '../../utils/apiBaseUrl';

const DEFAULT_TTL = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const MAX_RESPONSE_ENTRIES = 120;
const MAX_IMAGE_ENTRIES = 64;
const MAX_IMAGE_PRELOADS = 2;
const SERVER_URL = getApiBaseUrl();
const responseCache = new Map();
const imageCache = new Map();
const imageQueue = [];
let activeImagePreloads = 0;

const normalizePage = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const normalizeEndpoint = (endpoint) => String(endpoint || '')
    .replace(/([?&])page=([^&]*)/i, (_, prefix, value) => `${prefix}page=${normalizePage(value)}`);

const touchEntry = (cache, key, value) => {
    cache.delete(key);
    cache.set(key, value);
};

const pruneCache = (cache, maxEntries) => {
    while (cache.size > maxEntries) {
        cache.delete(cache.keys().next().value);
    }
};

const requestTMDB = async (endpoint) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(`${SERVER_URL}/api/tmdb?endpoint=${encodeURIComponent(endpoint)}`, {
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`TMDB request failed (${response.status})`);
        return await response.json();
    } finally {
        window.clearTimeout(timeout);
    }
};

export const fetchTMDBCached = async (endpoint, options = {}) => {
    if (!endpoint) return null;
    const safeEndpoint = normalizeEndpoint(endpoint);
    const ttl = options.ttl ?? DEFAULT_TTL;
    const now = Date.now();
    const cached = responseCache.get(safeEndpoint);

    if (cached?.promise) return cached.promise;
    if (!options.force && cached?.data && cached.expiresAt > now) {
        touchEntry(responseCache, safeEndpoint, cached);
        return cached.data;
    }

    const staleData = cached?.data || null;
    const promise = requestTMDB(safeEndpoint)
        .then((data) => {
            if (data) {
                touchEntry(responseCache, safeEndpoint, {
                    data,
                    expiresAt: Date.now() + ttl
                });
                pruneCache(responseCache, MAX_RESPONSE_ENTRIES);
            } else {
                responseCache.delete(safeEndpoint);
            }
            return data || staleData;
        })
        .catch((error) => {
            responseCache.delete(safeEndpoint);
            console.warn('[Noxis TV] TMDB request deferred', safeEndpoint, error);
            return staleData;
        });

    touchEntry(responseCache, safeEndpoint, { promise, expiresAt: now + REQUEST_TIMEOUT_MS });
    pruneCache(responseCache, MAX_RESPONSE_ENTRIES);
    return promise;
};

const runImageQueue = () => {
    while (activeImagePreloads < MAX_IMAGE_PRELOADS && imageQueue.length > 0) {
        const job = imageQueue.shift();
        activeImagePreloads += 1;

        const img = new Image();
        img.decoding = 'async';
        const finish = async (loaded) => {
            if (loaded && typeof img.decode === 'function') {
                try {
                    await img.decode();
                } catch {
                    // onload already proved the asset is usable.
                }
            }

            activeImagePreloads -= 1;
            if (loaded) {
                touchEntry(imageCache, job.src, { state: 'loaded', touchedAt: Date.now() });
                pruneCache(imageCache, MAX_IMAGE_ENTRIES);
            } else {
                imageCache.delete(job.src);
            }
            job.resolve(loaded ? job.src : '');
            runImageQueue();
        };

        img.onload = () => finish(true);
        img.onerror = () => finish(false);
        img.src = job.src;
    }
};

export const preloadImage = (src) => {
    if (!src || typeof window === 'undefined' || typeof Image === 'undefined') return Promise.resolve('');
    const cached = imageCache.get(src);
    if (cached?.state === 'loaded') {
        touchEntry(imageCache, src, { ...cached, touchedAt: Date.now() });
        return Promise.resolve(src);
    }
    if (cached?.promise) return cached.promise;

    const promise = new Promise((resolve) => {
        imageQueue.push({ src, resolve });
        runImageQueue();
    });
    touchEntry(imageCache, src, { state: 'pending', promise, touchedAt: Date.now() });
    pruneCache(imageCache, MAX_IMAGE_ENTRIES);
    return promise;
};

export const preloadImages = (sources = [], limit = 2) => {
    sources.filter(Boolean).slice(0, limit).forEach((src) => preloadImage(src));
};
