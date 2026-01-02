// Watch History Utility - localStorage based
// Manages watch progress and "continue watching" functionality

const STORAGE_KEY = 'noxis_watch_history';

/**
 * Get all watch history
 */
export const getWatchHistory = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
};

/**
 * Generate unique key for content
 */
const getKey = (imdbId, season = null, episode = null) => {
    if (season && episode) {
        return `${imdbId}_s${season}_e${episode}`;
    }
    return imdbId;
};

/**
 * Save watch progress
 * @param {string} imdbId - IMDB ID
 * @param {number} currentTime - Current playback time in seconds
 * @param {number} duration - Total duration in seconds
 * @param {object} metadata - Additional info (title, poster, etc.)
 */
export const saveProgress = (imdbId, currentTime, duration, metadata = {}) => {
    if (!imdbId || !duration || duration < 60) return; // Skip short videos

    const history = getWatchHistory();
    const key = getKey(imdbId, metadata.season, metadata.episode);
    const progress = (currentTime / duration) * 100;

    history[key] = {
        imdbId,
        currentTime: Math.floor(currentTime),
        duration: Math.floor(duration),
        progress: Math.round(progress),
        updatedAt: Date.now(),
        completed: progress >= 90,
        ...metadata
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
        console.warn('[WatchHistory] Storage full, clearing old entries');
        clearOldEntries();
    }
};

/**
 * Get saved progress for specific content
 */
export const getProgress = (imdbId, season = null, episode = null) => {
    const history = getWatchHistory();
    const key = getKey(imdbId, season, episode);
    return history[key] || null;
};

/**
 * Mark content as watched (completed)
 */
export const markAsWatched = (imdbId, season = null, episode = null, metadata = {}) => {
    const history = getWatchHistory();
    const key = getKey(imdbId, season, episode);

    history[key] = {
        imdbId,
        currentTime: 0,
        duration: 0,
        progress: 100,
        completed: true,
        updatedAt: Date.now(),
        ...metadata
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
};

/**
 * Check if content was watched
 */
export const isWatched = (imdbId, season = null, episode = null) => {
    const progress = getProgress(imdbId, season, episode);
    return progress?.completed || false;
};

/**
 * Get "Continue Watching" list (sorted by most recent)
 */
export const getContinueWatching = (limit = 10) => {
    const history = getWatchHistory();
    return Object.values(history)
        .filter(item => !item.completed && item.progress > 5 && item.progress < 90)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);
};

/**
 * Clear old entries (older than 30 days)
 */
export const clearOldEntries = () => {
    const history = getWatchHistory();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const filtered = Object.fromEntries(
        Object.entries(history).filter(([_, item]) => item.updatedAt > thirtyDaysAgo)
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

/**
 * Clear all watch history
 */
export const clearAllHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
};
