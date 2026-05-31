import { getApiBaseUrl } from '../utils/apiBaseUrl';

const normalizeMediaType = (type = 'movie') => {
    const normalized = String(type || '').toLowerCase();
    return normalized === 'tv' || normalized === 'series' ? 'tv' : 'movie';
};

export const findStreamimdbSource = async (
    imdbId,
    type = 'movie',
    season = null,
    episode = null,
    options = {}
) => {
    const tmdbId = options.tmdbId || null;
    if (!imdbId && !tmdbId) return null;

    try {
        const serverUrl = getApiBaseUrl();
        const mediaType = normalizeMediaType(type);
        const params = new URLSearchParams({
            type: mediaType
        });

        if (imdbId) {
            params.set('imdbId', imdbId);
        } else {
            params.set('tmdbId', String(tmdbId));
        }

        if (mediaType === 'tv' && season && episode) {
            params.set('season', String(season));
            params.set('episode', String(episode));
        }

        const response = await fetch(`${serverUrl}/api/streamimdb/resolve?${params}`, {
            signal: options.signal
        });
        if (!response.ok) return null;

        const data = await response.json();
        if (!data?.success || !Array.isArray(data.videos) || data.videos.length === 0) {
            return null;
        }

        return {
            url: data.videos[0].url,
            original: data.videos[0].url,
            videos: data.videos,
            subtitles: data.subtitles || [],
            title: data.title || null,
            fileName: data.fileName || null,
            backdrop: data.backdrop || null,
            wrapperUrl: data.wrapperUrl || null,
            embedUrl: data.embedUrl || null,
            resolvedBy: 'backend'
        };
    } catch (error) {
        if (error?.name !== 'AbortError') {
            console.warn('[StreamimdbScraper] Error:', error);
        }
        return null;
    }
};
