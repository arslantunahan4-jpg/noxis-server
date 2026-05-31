import { useState, useEffect, useCallback } from 'react';
import { fetchTMDB } from './useAppLogic';
import { findInM3U } from '../services/m3uService';
import { findStreamimdbSource } from '../services/streamimdbScraper';
import { buildVidmodyMasterUrl } from '../utils/vidmody';
import { mergeSubtitleLists, normalizeExternalSubtitles, normalizeSourceSubtitles } from '../utils/subtitles';
import { getApiBaseUrl } from '../utils/apiBaseUrl';

const SERVER_URL = getApiBaseUrl();
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://ancient-math-1d1b.arslab.workers.dev';

export const useStreamResolver = (tmdbId, type, season = 1, episode = 1) => {
    const [streamUrl, setStreamUrl] = useState(null);
    const [subtitles, setSubtitles] = useState([]);
    const [audios, setAudios] = useState([]);
    const [videos, setVideos] = useState([]);
    const [audioSwitchStrategy, setAudioSwitchStrategy] = useState('none');
    const [workingAudio, setWorkingAudio] = useState(null);
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
        setAudioSwitchStrategy('none');
        setWorkingAudio(null);

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
                const videos = vidmodyData.videos;
                const audios = vidmodyData.audios || [];
                const subs = vidmodyData.subtitles || [];
                
                setVideos(videos);
                setAudios(audios);
                const defaultAudio = vidmodyData.workingAudio || 'a1';
                const switchStrategy = vidmodyData.audioSwitchStrategy || (audios.length > 1 ? 'hls-track' : 'none');
                setWorkingAudio(defaultAudio);
                setAudioSwitchStrategy(switchStrategy);

                const masterUrl = buildVidmodyMasterUrl({
                    workerUrl: WORKER_URL,
                    videos,
                    audios,
                    subtitles: subs,
                    workingAudio: defaultAudio,
                    audioSwitchStrategy: switchStrategy
                });
                
                setStreamUrl(masterUrl);
                
                setSubtitles([]);

                try {
                    const subParams = new URLSearchParams({
                        imdb: imdbId,
                        season: isSeries ? season : '',
                        episode: isSeries ? episode : ''
                    });
                    const subRes = await fetch(`${SERVER_URL}/api/subtitles?${subParams}`);
                    const subData = await subRes.json();
                    if (Array.isArray(subData) && subData.length > 0) {
                        setSubtitles(normalizeExternalSubtitles(subData));
                    }
                } catch (e) {}

                setLoading(false);
                return;
            }

            const streamimdbSource = await findStreamimdbSource(
                imdbId,
                isSeries ? 'tv' : 'movie',
                isSeries ? season : null,
                isSeries ? episode : null,
                { tmdbId }
            );

            if (streamimdbSource?.url) {
                const sourceSubtitles = normalizeSourceSubtitles(streamimdbSource.subtitles || [], 'StreamIMDb');

                setStreamUrl(streamimdbSource.url);
                setVideos(streamimdbSource.videos || [{ resolution: 'auto', url: streamimdbSource.url }]);
                setAudios([]);
                setWorkingAudio(null);
                setAudioSwitchStrategy('none');

                try {
                    const subParams = new URLSearchParams({
                        imdb: imdbId,
                        season: isSeries ? season : '',
                        episode: isSeries ? episode : '',
                        source: 'streamimdb'
                    });
                    const subRes = await fetch(`${SERVER_URL}/api/subtitles?${subParams}`);
                    const subData = await subRes.json();
                    if (Array.isArray(subData) && subData.length > 0) {
                        setSubtitles(mergeSubtitleLists(
                            sourceSubtitles,
                            normalizeExternalSubtitles(subData)
                        ));
                    } else {
                        setSubtitles(sourceSubtitles);
                    }
                } catch (e) {
                    setSubtitles(sourceSubtitles);
                }

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
                        const subRes = await fetch(`${SERVER_URL}/api/subtitles?${subParams}`);
                        const subData = await subRes.json();
                        if (Array.isArray(subData)) setSubtitles(normalizeExternalSubtitles(subData));
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
        audioSwitchStrategy,
        workingAudio,
        loading, 
        error, 
        refetch: resolveStream 
    };
};
