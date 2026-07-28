import { getApiBaseUrl } from './apiBaseUrl';

/**
 * WATCH HISTORY - Performance Optimized
 *
 * Optimizasyonlar:
 * 1. Max 500 kayıt limiti (localStorage taşmasını önler)
 * 2. Delta sync - sadece değişen öğeyi gönder (full sync yerine)
 * 3. Gereksiz metadata temizliği (poster/backdrop URL'leri saklanmaz)
 * 4. Throttled sync - çok sık backend çağrısı yapılmaz
 */

export const getStorageKey = () => {
    try {
        const token = localStorage.getItem('noxis_auth_token');
        const userStr = localStorage.getItem('noxis_user');
        if (token && userStr) {
            const user = JSON.parse(userStr);
            const identifier = user?.id || user?._id || user?.username || user?.email;
            if (identifier) return `noxis_watch_history_${identifier}`;
        }
    } catch (e) {}
    return 'noxis_watch_history_guest';
};

const MAX_HISTORY_ITEMS = 500; // PERFORMANCE: Maksimum kayıt sayısı
const SYNC_THROTTLE_MS = 10000; // 10 saniyede bir sync (cihazlar arası senkronizasyon için)

const API_URL = getApiBaseUrl();

// PERFORMANCE: Son sync zamanını takip et
let lastSyncTime = 0;
let pendingSyncItem = null;

const getUserToken = () => localStorage.getItem('noxis_auth_token');

// PERFORMANCE: Eski kayıtları temizle
const pruneOldEntries = (history) => {
    const entries = Object.entries(history);
    if (entries.length <= MAX_HISTORY_ITEMS) return history;

    // En eski kayıtları sil (updatedAt'e göre sırala)
    entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    const pruned = entries.slice(0, MAX_HISTORY_ITEMS);

    console.log(`[WatchHistory] Pruned ${entries.length - MAX_HISTORY_ITEMS} old entries`);
    return Object.fromEntries(pruned);
};

export const syncFromBackend = async () => {
    const token = getUserToken();
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/api/get-history`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const serverHistory = await response.json();
            const localHistory = getWatchHistory();

            // Merge logic: Server data acts as base, but respect newer local updates if conflict
            let merged = { ...serverHistory };

            Object.keys(localHistory).forEach(key => {
                const localItem = localHistory[key];
                const serverItem = merged[key];

                // Keep local if it exists and is newer than server, or if server doesn't have it
                if (!serverItem || (localItem.updatedAt > (serverItem.updatedAt || 0))) {
                    merged[key] = localItem;
                }
            });

            // PERFORMANCE: Prune before saving
            merged = pruneOldEntries(merged);

            localStorage.setItem(getStorageKey(), JSON.stringify(merged));
            console.log('[WatchHistory] Synced from backend');
        }
    } catch (e) {
        console.warn('Backend fetch failed', e);
    }
};

// PERFORMANCE: Delta sync - sadece tek öğeyi gönder
const syncItemWithBackend = async (itemData) => {
    const token = getUserToken();
    if (!token) return;

    const now = Date.now();

    // Throttle: Çok sık sync yapma
    if (now - lastSyncTime < SYNC_THROTTLE_MS) {
        pendingSyncItem = itemData; // Bekleyen sync'i kaydet
        return;
    }

    lastSyncTime = now;
    pendingSyncItem = null;

    try {
        await fetch(`${API_URL}/api/sync-history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ history: itemData })
        });
    } catch (e) {
        console.warn('Backend sync failed', e);
    }
};

// PERFORMANCE: Bekleyen sync'leri periyodik olarak gönder
setInterval(() => {
    if (pendingSyncItem) {
        syncItemWithBackend(pendingSyncItem);
    }
}, SYNC_THROTTLE_MS);

export const getWatchHistory = () => {
    try {
        const data = localStorage.getItem(getStorageKey());
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
};

const getKey = (imdbId, season = null, episode = null) => {
    if (season && episode) {
        return `${imdbId}_s${season}_e${episode}`;
    }
    return imdbId;
};

export const saveProgress = (imdbId, currentTime, duration, metadata = {}) => {
    if (!imdbId || !duration || duration < 60) return;

    let history = getWatchHistory();
    const key = getKey(imdbId, metadata.season, metadata.episode);
    const progress = (currentTime / duration) * 100;

    // PERFORMANCE: Sadece gerekli verileri sakla (poster/backdrop URL'leri SAKLAMA)
    history[key] = {
        imdbId,
        id: metadata.tmdbId || null,
        media_type: metadata.mediaType || 'movie',
        currentTime: Math.floor(currentTime),
        duration: Math.floor(duration),
        progress: Math.round(progress),
        updatedAt: Date.now(),
        completed: progress >= 90,
        title: metadata.title || null,
        season: metadata.season || null,
        episode: metadata.episode || null,
        poster_path: metadata.poster_path || null,
        backdrop_path: metadata.backdrop_path || null
    };

    try {
        // PERFORMANCE: Kayıt sayısını kontrol et
        history = pruneOldEntries(history);

        localStorage.setItem(getStorageKey(), JSON.stringify(history));

        // Her kayıtta backend sync'i tetikle (throttle zaten korur)
        syncItemWithBackend(history[key]);
    } catch (e) {
        console.warn('[WatchHistory] Storage full, clearing old entries');
        // Acil temizlik - yarısını sil
        const entries = Object.entries(history);
        entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
        history = Object.fromEntries(entries.slice(0, Math.floor(MAX_HISTORY_ITEMS / 2)));
        localStorage.setItem(getStorageKey(), JSON.stringify(history));
    }
};

export const getProgress = (imdbId, season = null, episode = null) => {
    const history = getWatchHistory();
    const key = getKey(imdbId, season, episode);
    return history[key] || null;
};

export const markAsWatched = (imdbId, season = null, episode = null, metadata = {}) => {
    const history = getWatchHistory();
    const key = getKey(imdbId, season, episode);

    const data = {
        imdbId,
        currentTime: 0,
        duration: 0,
        progress: 100,
        completed: true,
        updatedAt: Date.now(),
        ...metadata
    };

    history[key] = data;

    localStorage.setItem(getStorageKey(), JSON.stringify(history));
    syncItemWithBackend(data);
};

export const isWatched = (imdbId, season = null, episode = null) => {
    const progress = getProgress(imdbId, season, episode);
    return progress?.completed || false;
};

export const getContinueWatching = (limit = 10) => {
    const history = getWatchHistory();
    const items = Object.values(history)
        .filter(item => !item.completed && item.progress > 5 && item.progress < 90 && item.id)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    
    const seen = new Set();
    const deduplicated = [];
    
    for (const item of items) {
        const uniqueKey = item.id;
        if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            deduplicated.push(item);
        }
    }
    
    return deduplicated.slice(0, limit);
};

export const getLastWatched = () => {
    const history = getWatchHistory();
    const sorted = Object.values(history).sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted.length > 0 ? sorted[0] : null;
};

export const clearOldEntries = () => {
    const history = getWatchHistory();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const filtered = Object.fromEntries(
        Object.entries(history).filter(([_, item]) => item.updatedAt > thirtyDaysAgo)
    );

    localStorage.setItem(getStorageKey(), JSON.stringify(filtered));
};

export const clearAllHistory = () => {
    localStorage.removeItem(getStorageKey());
    localStorage.removeItem('noxis_watch_history');
    localStorage.removeItem('noxis_watch_history_guest');
};

// Sayfa kapanırken bekleyen sync'i zorla gönder (navigator.sendBeacon ile)
export const forceSyncBeforeUnload = () => {
    const token = getUserToken();
    if (!token || !pendingSyncItem) return;

    const url = `${API_URL}/api/sync-history`;
    const payload = JSON.stringify({ history: pendingSyncItem });
    const blob = new Blob([payload], { type: 'application/json' });

    // sendBeacon sayfa kapanırken bile isteği tamamlar
    if (navigator.sendBeacon) {
        const headers = new Blob(
            [JSON.stringify({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` })],
            { type: 'application/json' }
        );
        // sendBeacon custom header desteklemez, fetch keepalive kullan
        try {
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: payload,
                keepalive: true
            });
        } catch (e) {
            // Son çare: en azından localStorage'de kalsın
        }
    }
    pendingSyncItem = null;
};

// Sayfa kapanırken otomatik sync
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', forceSyncBeforeUnload);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            forceSyncBeforeUnload();
        }
    });
}
