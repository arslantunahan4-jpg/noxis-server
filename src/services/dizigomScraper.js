import { getApiBaseUrl } from '../utils/apiBaseUrl';

export const findDizigomSource = async (title, season, episode, originalTitle = null) => {
    try {
        const serverUrl = getApiBaseUrl();
        const params = new URLSearchParams({
            title,
            season: season.toString(),
            episode: episode.toString()
        });

        if (originalTitle) {
            params.append('originalTitle', originalTitle);
        }

        const response = await fetch(`${serverUrl}/api/dizigom?${params}`);
        if (!response.ok) return null;

        const data = await response.json();
        if (!data?.success) return null;

        return {
            url: data.url || data.original || null,
            original: data.original || data.url || null,
            turkish_dub: data.turkish_dub || null,
            subtitles: data.subtitles || [],
            iframeUrl: data.iframeUrl || null,
            episodeUrl: data.episodeUrl || null,
            resolvedBy: data.resolvedBy || 'backend'
        };
    } catch (error) {
        console.warn('[DizigomScraper] Error:', error);
        return null;
    }
};
