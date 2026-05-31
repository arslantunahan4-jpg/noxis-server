import { getApiBaseUrl } from '../utils/apiBaseUrl';

export const findDizimomSource = async (title, season, episode) => {
    try {
        const serverUrl = getApiBaseUrl();
        const params = new URLSearchParams({
            title: title,
            season: season.toString(),
            episode: episode.toString()
        });
        
        const response = await fetch(`${serverUrl}/api/dizimom?${params}`);
        const data = await response.json();
        
        if (!data.success) {
            return null;
        }
        
        return {
            url: data.url,
            original: data.original,
            turkish_dub: data.turkish_dub,
            subtitles: data.subtitles || []
        };
        
    } catch (error) {
        console.warn('[DizimomScraper] Error:', error);
        return null;
    }
};
