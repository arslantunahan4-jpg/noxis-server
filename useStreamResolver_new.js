import { useState, useEffect, useCallback } from 'react';
import { fetchTMDB } from './useAppLogic';
import { findInM3U } from '../services/m3uService';

const SERVER_URL = localStorage.getItem('noxis_api_url') || import.meta.env.VITE_API_URL || "http://localhost:3000";

export const useStreamResolver = (tmdbId, type, season = 1, episode = 1) => {
    const [streamUrl, setStreamUrl] = useState(null);
    const [subtitles, setSubtitles] = useState([]);
    const [audios, setAudios] = useState([]);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const resolveStream = useCallback(async () => {
        if (!tmdbId) return;
        
        setLoading(true);
        setError(null);
        setStreamUrl(null);
        setVideos([]);
        setAudios([]);
        setSubtitles([]);

        try {
            const isSeries = type === 'tv';
            
            let imdbId = null;
            let movieTitle = null;

            const detail = await fetchTMDB(`/${type}/${tmdbId}`);
            if (detail?.imdb_id) imdbId = detail.imdb_id;
            movieTitle = detail?.title || detail?.name;

            if (!imdbId) {
                const data = await fetchTMDB(`/${type}/${tmdbId}/external_ids`);
                if (data?.imdb_id) imdbId = data.imdb_id;
            }

            if (!imdbId) throw new Error("IMDB ID bulunamadı");

            const vidmodyParams = new URLSearchParams({
                imdbId,
                season: isSeries ? season : '',
                episode: isSeries ? episode : '',
                nocache: 'true'
            });
            
            const vidmodyRes = await fetch(`${SERVER_URL}/api/vidmody/resolve?${vidmodyParams}`);
            const vidmodyData = await vidmodyRes.json();

            if (vidmodyData.success && vidmodyData.videos?.length > 0) {
                setVideos(vidmodyData.videos);
                setAudios(vidmodyData.audios || []);
                setSubtitles(vidmodyData.subtitles || []);

                const bestVideo = vidmodyData.videos[0];
                setStreamUrl(bestVideo.url);

                try {
                    const subParams = new URLSearchParams({
                        imdb: imdbId,
                        season: isSeries ? season : '',
                        episode: isSeries ? episode : ''
                    });
                    const subRes = await fetch(`${SERVER_URL}/subtitles?${subParams}`);
                    const subData = await subRes.json();
                    if (Array.isArray(subData) && subData.length > 0) {
                        setSubtitles(prev => {
                            const existingUrls = new Set(prev.map(s => s.url));
                            const newSubs = subData.filter(s => !existingUrls.has(s.url));
                            return [...prev, ...newSubs];
                        });
                    }
                } catch (e) {}

                setLoading(false);
                return;
            }

            if (movieTitle) {
                const m3uUrl = await findInM3U(movieTitle, season, episode, type);
                if (m3uUrl) {
                    setStreamUrl(m3uUrl);
                    setVideos([{ resolution: 'unknown', url: m3uUrl }]);
                    
                    try {
                        const subParams = new URLSearchParams({
                            imdb: imdbId,
                            season: isSeries ? season : '',
                            episode: isSeries ? episode : ''
                        });
                        const subRes = await fetch(`${SERVER_URL}/subtitles?${subParams}`);
                        const subData = await subRes.json();
                        if (Array.isArray(subData)) setSubtitles(subData);
                    } catch (e) {}

                    setLoading(false);
                    return;
                }
            }

            throw new Error("Kaynak bulunamadı");

        } catch (err) {
            console.error('[Resolver] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [tmdbId, type, season, episode]);

    useEffect(() => {
        resolveStream();
    }, [resolveStream]);

    return { 
        streamUrl, 
        subtitles, 
        audios,
        videos,
        loading, 
        error, 
        refetch: resolveStream 
    };
};
