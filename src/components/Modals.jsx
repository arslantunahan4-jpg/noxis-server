import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { SmartImage, ORIGINAL_IMG, BACKDROP_IMG, POSTER_IMG } from './Shared';
import { fetchTMDB, isWatched, markAsWatched, saveContinueWatching } from '../hooks/useAppLogic';
import { scrapeHdfilmizle, isNativePlatform } from '../services/nativeHttp';
import { GlassPlayer } from './player/GlassPlayer';
import { searchTorrents } from '../services/torrent-aggregator';
import { findInM3U } from '../services/m3uService';
import { findDiziyouSource } from '../services/diziyouScraper';
import { findDizigomSource } from '../services/dizigomScraper';
import { findDizimomSource } from '../services/dizimomScraper';
import { findStreamimdbSource } from '../services/streamimdbScraper';
import { buildVidmodyExternalAudioTracks, buildVidmodyMasterUrl } from '../utils/vidmody';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { mergeSubtitleLists, normalizeExternalSubtitles, normalizeSourceSubtitles } from '../utils/subtitles';
import { getDominantColor } from '../utils/colorExtractor';
import { downloadNoxisMovie, isAppBridgeAvailable } from '../utils/appBridge';


// VPS veya Backend URL'si (.env dosyasından gelir veya URL'den override edilir)
const SERVER_URL = getApiBaseUrl();

// Cloudflare Worker URL (Video Proxy için)
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://ancient-math-1d1b.arslab.workers.dev';

const StreamimdbEmbedFallback = ({ url, onClose }) => (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10000 }}>
        <iframe
            src={url}
            title="StreamIMDb"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="origin"
            style={{ width: '100%', height: '100%', border: 0, background: '#000' }}
        />
        <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.24)',
                background: 'rgba(0,0,0,0.72)',
                color: '#fff',
                fontSize: 22,
                lineHeight: '42px',
                cursor: 'pointer',
                zIndex: 2
            }}
        >
            X
        </button>
    </div>
);

const createSlug = (text) => {
    if (!text) return "";
    const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ı': 'i', 'ö': 'o', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'İ': 'i', 'Ö': 'o' };
    const slug = text.split('').map(char => trMap[char] || char).join('')
        .toLowerCase()
        .replace(/&/g, '-')           // & -> -
        .replace(/\+/g, '-')          // + -> -
        .replace(/\//g, '-')          // / -> -
        .replace(/\\/g, '-')          // \ -> -
        .replace(/\|/g, '-')          // | -> -
        .replace(/[^a-z0-9\s-]/g, '')  // Diğer özel karakterleri sil
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    if (!slug || slug.length === 0) return "movie";
    return slug;
};

export const DetailModal = ({ movie, onClose, onPlay, onOpenDetail, autoPlay = false, autoSeason = 1, autoEpisode = 1 }) => {
    const [details, setDetails] = useState(null);
    const [seasons, setSeasons] = useState([]);
    const [episodes, setEpisodes] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(autoSeason);
    const [similar, setSimilar] = useState([]);
    const [trailer, setTrailer] = useState(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const [dominantColor, setDominantColor] = useState([10, 10, 12]);
    const isSeries = movie.media_type === 'tv' || movie.first_air_date;

    const [torrentOptions, setTorrentOptions] = useState([]);
    const [showTorrentPicker, setShowTorrentPicker] = useState(false);
    const [selectedTorrentSeason, setSelectedTorrentSeason] = useState(1);
    const [selectedTorrentEpisode, setSelectedTorrentEpisode] = useState(1);
    const [currentImdbId, setCurrentImdbId] = useState(null);
    const [vidmodyAudioTracks, setVidmodyAudioTracks] = useState(null);
    const [diziyouAudioTracks, setDiziyouAudioTracks] = useState(null);
    const [dizimomAudioTracks, setDizimomAudioTracks] = useState(null);
    const [streamimdbEmbedFallbackUrl, setStreamimdbEmbedFallbackUrl] = useState(null);
    const [useStreamimdbEmbedFallback, setUseStreamimdbEmbedFallback] = useState(false);

    // Noxis Premium Quality and Network settings states
    const [showQualitySelector, setShowQualitySelector] = useState(false);
    const [pendingDownloadType, setPendingDownloadType] = useState(null); // 'movie' or 'episode'
    const [pendingEpisodeNum, setPendingEpisodeNum] = useState(null);
    const [selectedQuality, setSelectedQuality] = useState('HD');
    const [wifiOnlySetting, setWifiOnlySetting] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setDominantColor([10, 10, 12]);

        const posterPath = movie.poster_path || movie.backdrop_path;
        if (posterPath) {
            const url = `${POSTER_IMG}${posterPath}`;
            getDominantColor(url).then(color => {
                if (isMounted) {
                    setDominantColor(color);
                }
            });
        }

        return () => {
            isMounted = false;
        };
    }, [movie]);

    const [showMagnetPlayer, setShowMagnetPlayer] = useState(false);
        const [streamUrl, setStreamUrl] = useState('');
    const [subtitles, setSubtitles] = useState([]);
    const [magnetLoading, setMagnetLoading] = useState(false);
    const [magnetError, setMagnetError] = useState(null);

    const isDownloadingRef = useRef(false);
    const downloadingEpisodeRef = useRef(1);
    const [downloadingId, setDownloadingId] = useState(null);

    // Intercept resolved streamUrl for offline download
    useEffect(() => {
        if (streamUrl && isDownloadingRef.current) {
            const epNum = downloadingEpisodeRef.current;
            const title = isSeries 
                ? `${movie.title || movie.name} - S${selectedSeason}E${epNum}` 
                : (movie.title || movie.name);
            
            console.log("[DetailModal] Intercepted streamUrl for download:", streamUrl);
            
            // Trigger native bridge download with rich metadata & customized quality/Wi-Fi preferences
            downloadNoxisMovie(
                streamUrl, 
                title, 
                movie.poster_path || null, 
                movie.backdrop_path || null, 
                movie.media_type || (isSeries ? 'tv' : 'movie'), 
                isSeries ? selectedSeason : null, 
                isSeries ? epNum : null,
                JSON.stringify(subtitles),
                JSON.stringify(vidmodyAudioTracks || diziyouAudioTracks || dizimomAudioTracks || null),
                selectedQuality,
                wifiOnlySetting
            );
            
            // Instantly clean up to prevent player overlay
            setStreamUrl('');
            setShowMagnetPlayer(false);
            setDownloadingId(null);
            isDownloadingRef.current = false;
            setMagnetLoading(false);
            setMagnetError("İndirme Başlatıldı!");
            setTimeout(() => setMagnetError(null), 3000);
        }
    }, [streamUrl, isSeries, selectedSeason, movie.title, movie.name, subtitles, vidmodyAudioTracks, diziyouAudioTracks, dizimomAudioTracks, selectedQuality, wifiOnlySetting]);

    // Handle failure to resolve download source
    useEffect(() => {
        if (isDownloadingRef.current && !magnetLoading && !streamUrl && magnetError && magnetError !== "İndirme Başlatıldı!") {
            // Cancel downloading state on error
            setDownloadingId(null);
            isDownloadingRef.current = false;
        }
    }, [magnetLoading, streamUrl, magnetError]);

    const handleDownloadMovie = () => {
        setPendingDownloadType('movie');
        setPendingEpisodeNum(null);
        setShowQualitySelector(true);
    };

    const handleDownloadEpisode = (episodeNum) => {
        setPendingDownloadType('episode');
        setPendingEpisodeNum(episodeNum);
        setShowQualitySelector(true);
    };

    const confirmDownload = () => {
        setShowQualitySelector(false);
        isDownloadingRef.current = true;
        
        if (pendingDownloadType === 'movie') {
            downloadingEpisodeRef.current = 1;
            setDownloadingId('movie');
            // Resolves movie (Vidmody/StreamIMDb fallback)
            handleVidmodyWatch(null, null);
        } else if (pendingDownloadType === 'episode') {
            downloadingEpisodeRef.current = pendingEpisodeNum;
            setDownloadingId(`s${selectedSeason}e${pendingEpisodeNum}`);
            // Resolves episode (Vidmody/StreamIMDb fallback)
            handleVidmodyWatch(selectedSeason, pendingEpisodeNum);
        }
    };

    const episodesRef = useRef(null);
    const similarRef = useRef(null);
    const currentEpisodeNumber = Number(selectedTorrentEpisode) || 1;
    const activeEpisode = isSeries
        ? episodes.find(ep => ep.episode_number === currentEpisodeNumber)
        : null;
    const nextEpisode = isSeries
        ? episodes.find(ep => ep.episode_number === currentEpisodeNumber + 1)
        : null;
    const handleStreamimdbPlaybackError = useCallback((event = {}) => {
        if (event.hasStarted || Number(event.currentTime) > 3) return;
        if (streamimdbEmbedFallbackUrl) {
            setUseStreamimdbEmbedFallback(true);
        }
    }, [streamimdbEmbedFallbackUrl]);

    const handleScroll = (ref, direction) => {
        if (ref.current) {
            const scrollAmount = window.innerWidth * 0.7;
            ref.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        setTimeout(() => {
            document.querySelector('.detail-play-btn')?.focus();
        }, 300);
    }, []);

    useEffect(() => {
        const type = isSeries ? 'tv' : 'movie';
        fetchTMDB(`/${type}/${movie.id}?append_to_response=credits,similar,videos&include_video_language=tr,en`).then(d => {
            setDetails(d);
            if (d?.similar?.results) setSimilar(d.similar.results.slice(0, 12));

            if (d?.videos?.results) {
                const videos = d.videos.results.filter(v => v.site === 'YouTube');

                const t = videos.find(v => v.iso_639_1 === 'tr' && v.type === 'Trailer') ||
                    videos.find(v => v.iso_639_1 === 'en' && v.type === 'Trailer') ||
                    videos.find(v => v.iso_639_1 === 'tr' && v.type === 'Teaser') ||
                    videos.find(v => v.iso_639_1 === 'en' && v.type === 'Teaser') ||
                    videos[0];

                if (t) setTrailer(t.key);
            }
            if (isSeries && d) setSeasons(Array.from({ length: d.number_of_seasons }, (_, i) => i + 1));
        });
    }, [movie, isSeries]);

    useEffect(() => {
        if (isSeries) {
            fetchTMDB(`/tv/${movie.id}/season/${selectedSeason}`).then(d => {
                if (d) setEpisodes(d.episodes || []);
            });
        }
    }, [selectedSeason, isSeries, movie.id]);

    const handlePartyWatch = async (seasonNum = null, episodeNum = null) => {
        console.log('[handlePartyWatch] Çağrıldı - seasonNum:', seasonNum, 'episodeNum:', episodeNum);
        setMagnetLoading(true);
        setMagnetError(null);

        try {
            let imdbId = details?.imdb_id;
            if (!imdbId && details?.external_ids?.imdb_id) imdbId = details.external_ids.imdb_id;

            if (!imdbId) {
                const type = isSeries ? 'tv' : 'movie';
                const d = await fetchTMDB(`/${type}/${movie.id}/external_ids`);
                imdbId = d?.imdb_id;
            }

            if (!imdbId) throw new Error("IMDB ID bulunamadı");
            setCurrentImdbId(imdbId);

            // Determine Season/Episode
            const s = seasonNum !== null && seasonNum !== undefined ? seasonNum : (selectedTorrentSeason || selectedSeason || 1);
            const e = episodeNum !== null && episodeNum !== undefined ? episodeNum : (selectedTorrentEpisode || 1);

            console.log('[handlePartyWatch] Final değerler - s:', s, 'e:', e);

            if (isSeries) {
                setSelectedTorrentSeason(s);
                setSelectedTorrentEpisode(e);
            }

            // Client-side search (Frontend - Torrentio/YTS)
            // Backend IP ban yemez çünkü browser'dan istek atılıyor
            const type = isSeries ? 'tv' : 'movie';
            const results = await searchTorrents(imdbId, type, s, e);

            if (!results || results.length === 0) {
                throw new Error("Torrent bulunamadı");
            }

            if (results.length === 1) {
                await handleSelectTorrent(results[0], s, e);
            } else {
                setTorrentOptions(results);
                setShowTorrentPicker(true);
            }
        } catch (err) {
            console.error(err);
            setMagnetError(err.message || "Kaynak bulunamadı");
            setTimeout(() => setMagnetError(null), 4000);
        } finally {
            setMagnetLoading(false);
        }
    };

    const handleVidmodyWatch = async (seasonNum = null, episodeNum = null) => {
        // Overall timeout - abort everything after 30s
        const overallController = new AbortController();
        const overallTimeout = setTimeout(() => overallController.abort(), 30000);

        try {
            setMagnetLoading(true);
            setMagnetError(null);
            setStreamimdbEmbedFallbackUrl(null);
            setUseStreamimdbEmbedFallback(false);

            let imdbId = details?.imdb_id;
            if (!imdbId && details?.external_ids?.imdb_id) imdbId = details.external_ids.imdb_id;

            if (!imdbId) {
                const type = isSeries ? 'tv' : 'movie';
                const d = await fetchTMDB(`/${type}/${movie.id}/external_ids`);
                imdbId = d?.imdb_id;
            }

            setCurrentImdbId(imdbId);

            const s = seasonNum !== null ? seasonNum : (selectedSeason || 1);
            const e = episodeNum !== null ? episodeNum : 1;

            if (isSeries) {
                setSelectedTorrentSeason(s);
                setSelectedTorrentEpisode(e);
            }

            setVidmodyAudioTracks(null);
            setMagnetError("Kaynak aranıyor...");

            // Helper: fetch with timeout (returns null on timeout/error instead of throwing)
            const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    const res = await fetch(url, { ...options, signal: controller.signal });
                    clearTimeout(id);
                    return res;
                } catch {
                    clearTimeout(id);
                    return null;
                }
            };

            // ===== STEP 1: Try Vidmody via Backend API =====
            const vidmodyParams = new URLSearchParams({
                imdbId,
                season: isSeries ? s : '',
                episode: isSeries ? e : ''
            });
            
            const vidmodyRes = await fetchWithTimeout(
                `${SERVER_URL}/api/vidmody/resolve?${vidmodyParams}`,
                {},
                15000
            );

            if (vidmodyRes) {
                const vidmodyData = await vidmodyRes.json();
                
                if (vidmodyData.success && vidmodyData.videos?.length > 0) {
                    const videos = vidmodyData.videos;
                    const audios = vidmodyData.audios || [];
                    const subs = vidmodyData.subtitles || [];

                    const masterUrl = buildVidmodyMasterUrl({
                        workerUrl: WORKER_URL,
                        videos,
                        audios,
                        subtitles: subs,
                        workingAudio: vidmodyData.workingAudio || 'a1',
                        audioSwitchStrategy: vidmodyData.audioSwitchStrategy
                    });

                    setStreamUrl(masterUrl);
                    setVidmodyAudioTracks(buildVidmodyExternalAudioTracks(audios, {
                        audioSwitchStrategy: vidmodyData.audioSwitchStrategy,
                        workingAudio: vidmodyData.workingAudio || 'a1'
                    }));
                    
                    try {
                        const subParams = new URLSearchParams({
                            imdb: imdbId,
                            season: isSeries ? s : '',
                            episode: isSeries ? e : ''
                        });
                        const subRes = await fetch(`${SERVER_URL}/api/subtitles?${subParams}`);
                        const subData = await subRes.json();
                        if (Array.isArray(subData) && subData.length > 0) {
                            setSubtitles(normalizeExternalSubtitles(subData));
                        } else {
                            setSubtitles([]);
                        }
                    } catch (err) {
                        console.warn('[Vidmody] External subtitle fetch failed:', err);
                        setSubtitles([]);
                    }

                    setShowMagnetPlayer(true);
                    return;
                }
            }

            if (overallController.signal.aborted) throw new Error("Zaman aşımı");

            // ===== STEP 2: Try StreamIMDb via Backend API =====
            if (imdbId) {
                const streamimdbController = new AbortController();
                const streamimdbTimeout = setTimeout(() => streamimdbController.abort(), 10000);

                try {
                    const streamimdbSource = await findStreamimdbSource(
                        imdbId,
                        isSeries ? 'tv' : 'movie',
                        isSeries ? s : null,
                        isSeries ? e : null,
                        { signal: streamimdbController.signal, tmdbId: movie.id }
                    );

                    if (streamimdbSource?.url) {
                        const sourceSubtitles = normalizeSourceSubtitles(streamimdbSource.subtitles || [], 'StreamIMDb');

                        try {
                            const subParams = new URLSearchParams({
                                imdb: imdbId,
                                season: isSeries ? s : '',
                                episode: isSeries ? e : '',
                                source: 'streamimdb'
                            });
                            const subRes = await fetchWithTimeout(`${SERVER_URL}/api/subtitles?${subParams}`, {}, 6000);
                            if (subRes) {
                                const subData = await subRes.json();
                                if (Array.isArray(subData) && subData.length > 0) {
                                    setSubtitles(mergeSubtitleLists(
                                        sourceSubtitles,
                                        normalizeExternalSubtitles(subData)
                                    ));
                                } else {
                                    setSubtitles(sourceSubtitles);
                                }
                            } else {
                                setSubtitles(sourceSubtitles);
                            }
                        } catch (subErr) {
                            setSubtitles(sourceSubtitles);
                        }

                        setVidmodyAudioTracks(null);
                        setDiziyouAudioTracks(null);
                        setDizimomAudioTracks(null);
                        setStreamimdbEmbedFallbackUrl(streamimdbSource.wrapperUrl || streamimdbSource.embedUrl || null);
                        setUseStreamimdbEmbedFallback(false);
                        setStreamUrl(streamimdbSource.url);
                        setShowMagnetPlayer(true);
                        setMagnetLoading(false);
                        return;
                    }
                } catch (streamimdbErr) {
                    console.warn('[StreamIMDb] Failed or timed out:', streamimdbErr.message);
                } finally {
                    clearTimeout(streamimdbTimeout);
                }
            }

            if (overallController.signal.aborted) throw new Error("Zaman aşımı");

            // ===== STEP 3: Try Diziyou (series only) =====
            if (overallController.signal.aborted) throw new Error("Zaman aşımı");
            setMagnetError("Kaynak aranıyor...");

            if (isSeries) {
                try {
                    // Diziyou scraper with 10s timeout via race
                    const diziyouPromise = findDiziyouSource(movie.title || movie.name, s, e, movie.original_name || movie.original_title);
                    const diziyouTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Diziyou timeout')), 10000));
                    const diziyouSources = await Promise.race([diziyouPromise, diziyouTimeout]);

                    const videoUrl = diziyouSources?.original || diziyouSources?.turkish_dub;

                    if (diziyouSources && videoUrl) {
                        const proxiedUrl = `${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(videoUrl)}`;
                        
                        const sourceSubtitles = normalizeSourceSubtitles(diziyouSources.subtitles || [], 'Diziyou');

                        try {
                            const subParams = new URLSearchParams({
                                imdb: imdbId,
                                season: isSeries ? s : '',
                                episode: isSeries ? e : ''
                            });
                            const subRes = await fetchWithTimeout(`${SERVER_URL}/api/subtitles?${subParams}`, {}, 6000);
                            if (subRes) {
                                const subData = await subRes.json();
                                if (Array.isArray(subData) && subData.length > 0) {
                                    setSubtitles(mergeSubtitleLists(
                                        sourceSubtitles,
                                        normalizeExternalSubtitles(subData)
                                    ));
                                } else {
                                    setSubtitles(sourceSubtitles);
                                }
                            } else {
                                setSubtitles(sourceSubtitles);
                            }
                        } catch (subErr) {
                            setSubtitles(sourceSubtitles);
                        }

                        if (diziyouSources.hasOriginal && diziyouSources.hasDub) {
                            setDiziyouAudioTracks({
                                original: diziyouSources.original,
                                dub: diziyouSources.turkish_dub,
                                active: videoUrl === diziyouSources.turkish_dub ? 'dub' : 'original'
                            });
                        } else {
                            setDiziyouAudioTracks(null);
                        }

                        setStreamUrl(proxiedUrl);
                        setShowMagnetPlayer(true);
                        setMagnetLoading(false);
                        return;
                    }
                } catch (diziErr) {
                    console.warn('[Diziyou] Failed or timed out:', diziErr.message);
                }
            }

            // ===== STEP 4: Try Dizigom =====
            if (overallController.signal.aborted) throw new Error("Zaman aşımı");
            setMagnetError("Kaynak aranıyor...");

            if (isSeries) {
                try {
                    const dizigomPromise = findDizigomSource(movie.title || movie.name, s, e, movie.original_name || movie.original_title);
                    const dizigomTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Dizigom timeout')), 14000));
                    const dizigomSources = await Promise.race([dizigomPromise, dizigomTimeout]);

                    if (dizigomSources?.original) {
                        const sourceSubtitles = normalizeSourceSubtitles(dizigomSources.subtitles || [], 'Dizigom');

                        try {
                            const subParams = new URLSearchParams({
                                imdb: imdbId,
                                season: isSeries ? s : '',
                                episode: isSeries ? e : ''
                            });
                            const subRes = await fetchWithTimeout(`${SERVER_URL}/api/subtitles?${subParams}`, {}, 6000);
                            if (subRes) {
                                const subData = await subRes.json();
                                if (Array.isArray(subData) && subData.length > 0) {
                                    setSubtitles(mergeSubtitleLists(
                                        sourceSubtitles,
                                        normalizeExternalSubtitles(subData)
                                    ));
                                } else {
                                    setSubtitles(sourceSubtitles);
                                }
                            } else {
                                setSubtitles(sourceSubtitles);
                            }
                        } catch (err) {
                            setSubtitles(sourceSubtitles);
                        }

                        setStreamUrl(`${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(dizigomSources.original)}`);
                        setShowMagnetPlayer(true);
                        setMagnetLoading(false);
                        return;
                    }
                } catch (diziErr) {
                    console.warn('[Dizigom] Failed or timed out:', diziErr.message);
                }
            }

            // ===== STEP 5: Try Dizimom (Priority 3) =====
            if (overallController.signal.aborted) throw new Error("Zaman aşımı");
            setMagnetError("Kaynak aranıyor...");

            if (isSeries) {
                try {
                    const dizimomPromise = findDizimomSource(movie.title || movie.name, s, e);
                    const dizimomTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Dizimom timeout')), 10000));
                    const dizimomSources = await Promise.race([dizimomPromise, dizimomTimeout]);

                    if (dizimomSources && (dizimomSources.original || dizimomSources.turkish_dub)) {
                        const sourceSubtitles = normalizeSourceSubtitles(dizimomSources.subtitles || [], 'Dizimom');

                        try {
                            const subParams = new URLSearchParams({
                                imdb: imdbId,
                                season: isSeries ? s : '',
                                episode: isSeries ? e : ''
                            });
                            const subRes = await fetchWithTimeout(`${SERVER_URL}/api/subtitles?${subParams}`, {}, 6000);
                            if (subRes) {
                                const subData = await subRes.json();
                                if (Array.isArray(subData) && subData.length > 0) {
                                    setSubtitles(mergeSubtitleLists(
                                        sourceSubtitles,
                                        normalizeExternalSubtitles(subData)
                                    ));
                                } else {
                                    setSubtitles(sourceSubtitles);
                                }
                            } else {
                                setSubtitles(sourceSubtitles);
                            }
                        } catch (err) {
                            setSubtitles(sourceSubtitles);
                        }

                        // Set up audio tracks if both sub and dub available
                        if (dizimomSources.original && dizimomSources.turkish_dub) {
                            setDizimomAudioTracks({
                                original: dizimomSources.original,
                                dub: dizimomSources.turkish_dub,
                                active: 'original'
                            });
                        } else {
                            setDizimomAudioTracks(null);
                        }

                        const initialUrl = dizimomSources.original || dizimomSources.turkish_dub;
                        const proxiedUrl = `${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(initialUrl)}`;
                        setStreamUrl(proxiedUrl);
                        setShowMagnetPlayer(true);
                        setMagnetLoading(false);
                        return;
                    }
                } catch (diziErr) {
                    console.warn('[Dizimom] Failed or timed out:', diziErr.message);
                }
            }

            // ===== STEP 6: Try M3U =====
            if (overallController.signal.aborted) throw new Error("Zaman aşımı");
            setMagnetError("Kaynak aranıyor...");

            // M3U with 8s timeout
            const m3uPromise = findInM3U(movie.title || movie.name, s, e, isSeries ? 'tv' : 'movie');
            const m3uTimeout = new Promise((resolve) => setTimeout(() => resolve(null), 8000));
            const m3uUrl = await Promise.race([m3uPromise, m3uTimeout]);

            if (m3uUrl) {
                try {
                    const subParams = new URLSearchParams({
                        imdb: imdbId,
                        season: isSeries ? s : '',
                        episode: isSeries ? e : ''
                    });
                    const subRes = await fetchWithTimeout(`${SERVER_URL}/api/subtitles?${subParams}`, {}, 6000);
                    if (subRes) {
                        const subData = await subRes.json();
                        if (Array.isArray(subData) && subData.length > 0) {
                            const sorted = subData.sort((a, b) => {
                                if (a.lang === 'tur' || a.lang === 'tr') return -1;
                                if (b.lang === 'tur' || b.lang === 'tr') return 1;
                                return 0;
                            });
                            setSubtitles(normalizeExternalSubtitles(sorted));
                        } else {
                            setSubtitles([]);
                        }
                    } else {
                        setSubtitles([]);
                    }
                } catch (err) {
                    console.error("M3U Subtitle Error:", err);
                    setSubtitles([]);
                }

                setStreamUrl(m3uUrl);
                setShowMagnetPlayer(true);
                setMagnetLoading(false);
                return;
            }
            throw new Error("Kaynak bulunamadı");

        } catch (err) {
            console.error('[Modal] Source finding failed or aborted:', err.name, err.message);
            setMagnetError(err.message === "Zaman aşımı" ? "Bağlantı zaman aşımına uğradı" : "Kaynak bulunamadı");
            setTimeout(() => setMagnetError(null), 3000);
        } finally {
            clearTimeout(overallTimeout);
            setMagnetLoading(false);
        }
    };
    const handleSelectTorrent = async (torrent, seasonOverride = null, episodeOverride = null) => {
        setShowTorrentPicker(false);
        setMagnetLoading(true);
        setMagnetError(null);

        // Parametre olarak gelen değeri kullan, yoksa state'ten al
        const finalSeason = seasonOverride !== null ? seasonOverride : selectedTorrentSeason;
        const finalEpisode = episodeOverride !== null ? episodeOverride : selectedTorrentEpisode;

        try {
            const params = new URLSearchParams({
                magnet: torrent.magnetUri,
                imdb: currentImdbId
            });

            if (isSeries) {
                params.append('season', finalSeason);
                params.append('episode', finalEpisode);
            }

            // VPS'e İstek At (Streaming için)
            // SERVER_URL burada devreye giriyor (VPS Adresi)
            const streamUrl = `${SERVER_URL}/stream?${params}`;

            // Subtitle Fetching (VPS) - Kesinlikle altyazı olmalı!
            try {
                const subParams = new URLSearchParams({
                    imdb: currentImdbId,
                    season: isSeries ? finalSeason : '',
                    episode: isSeries ? finalEpisode : ''
                });
                console.log('[Subtitles] Altyazı aranıyor...', currentImdbId);
                const subRes = await fetch(`${SERVER_URL}/api/subtitles?${subParams}`);
                const subData = await subRes.json();

                if (Array.isArray(subData) && subData.length > 0) {
                    console.log(`[Subtitles] ✅ ${subData.length} altyazı bulundu`);
                    // Türkçe altyazıları en üste koy
                    const sorted = subData.sort((a, b) => {
                        if (a.lang === 'tur' || a.lang === 'tr') return -1;
                        if (b.lang === 'tur' || b.lang === 'tr') return 1;
                        return 0;
                    });
                    setSubtitles(normalizeExternalSubtitles(sorted));
                } else {
                    console.warn('[Subtitles] ⚠️ Altyazı bulunamadı, OpenSubtitles kontrol edilecek');
                    setSubtitles([]);
                }
            } catch (e) {
                console.error("[Subtitles] Altyazı yüklenirken hata:", e.message || e);
                setSubtitles([]);
            }

            setStreamUrl(streamUrl);
            setShowMagnetPlayer(true);
        } catch (err) {
            console.error(err);
            setMagnetError(err.message || "Stream başlatılamadı");
            setTimeout(() => setMagnetError(null), 3000);
        } finally {
            setMagnetLoading(false);
        }
    };

    const [r, g, b] = dominantColor;
    console.log("[DetailModal] dominantColor extracted:", dominantColor);

    return (
        <motion.div
            className="detail-view-container"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '30%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
                backgroundImage: `radial-gradient(circle at 15% 30%, rgba(${r}, ${g}, ${b}, 0.48) 0%, transparent 65%), radial-gradient(circle at 85% 75%, rgba(${r}, ${g}, ${b}, 0.32) 0%, transparent 60%), radial-gradient(circle at 50% 50%, rgba(${r}, ${g}, ${b}, 0.18) 0%, transparent 50%)`,
                backgroundColor: '#070709'
            }}
        >
            <div className="detail-hero-wrapper">
                <SmartImage
                    src={ORIGINAL_IMG + (movie.backdrop_path || movie.poster_path)}
                    className="detail-hero-img"
                    alt={movie.title || movie.name}
                />
            </div>

            <div 
                className="detail-content-layer"
                style={{
                    background: `linear-gradient(to bottom, transparent 0%, rgba(7, 7, 9, 0.15) 15%, rgba(7, 7, 9, 0.45) 45%, rgba(7, 7, 9, 0.72) 75%, rgba(7, 7, 9, 0.85) 100%)`
                }}
            >
                <button
                    tabIndex="0"
                    onClick={onClose}
                    className="focusable detail-back-btn"
                >
                    <i className="fas fa-arrow-left"></i>
                </button>

                <div style={{ maxWidth: '1200px' }}>
                    <motion.h1
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        style={{
                            fontSize: 'clamp(28px, 6vw, 72px)',
                            fontWeight: '800',
                            marginBottom: '12px',
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            textShadow: '0 4px 40px rgba(0,0,0,0.8)'
                        }}
                    >
                        {movie.title || movie.name}
                    </motion.h1>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '16px',
                            flexWrap: 'wrap'
                        }}
                    >
                        <span style={{
                            fontWeight: '700',
                            fontSize: '16px',
                            color: 'rgba(255,255,255,0.85)'
                        }}>
                            {(movie.release_date || movie.first_air_date || '').split('-')[0]}
                        </span>
                        <span className="meta-tag">{isSeries ? 'DİZİ' : 'FİLM'}</span>
                        <span className="meta-tag" style={{ color: '#30d158' }}>
                            <i className="fas fa-star" style={{ marginRight: '4px', fontSize: '10px' }}></i>
                            {(movie.vote_average || 0).toFixed(1)}
                        </span>
                        {details?.runtime && (
                            <span className="meta-tag">
                                <i className="fas fa-clock" style={{ marginRight: '4px', fontSize: '10px' }}></i>
                                {details.runtime} dk
                            </span>
                        )}
                    </motion.div>

                    <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        style={{
                            fontSize: 'clamp(14px, 2vw, 20px)',
                            color: 'rgba(255,255,255,0.75)',
                            lineHeight: '1.7',
                            marginBottom: '24px',
                            maxWidth: '800px'
                        }}
                    >
                        {movie.overview}
                    </motion.p>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        style={{ display: 'flex', gap: '12px', marginBottom: '40px', flexWrap: 'wrap' }}
                    >
                        <button
                            tabIndex="0"
                            onClick={() => onPlay(movie, isSeries ? selectedSeason : 1, 1)}
                            className="focusable detail-play-btn"
                        >
                            <i className="fas fa-play"></i>
                            <span>Oynat</span>
                        </button>
                        {trailer && (
                            <button
                                tabIndex="0"
                                onClick={() => setShowTrailer(true)}
                                className="focusable glass-button"
                            >
                                <i className="fas fa-film"></i>
                                <span>Fragman</span>
                            </button>
                        )}
                        {isAppBridgeAvailable() && (
                            <button
                                tabIndex="0"
                                onClick={handleDownloadMovie}
                                className="focusable glass-button download-btn"
                                disabled={downloadingId !== null}
                                style={{
                                    border: '1px solid rgba(191, 90, 242, 0.4)',
                                    background: downloadingId === 'movie' ? 'rgba(191, 90, 242, 0.25)' : 'var(--liquid-glass-bg)'
                                }}
                            >
                                {downloadingId === 'movie' ? (
                                    <i className="fas fa-spinner fa-spin" style={{ color: '#bf5af2' }}></i>
                                ) : (
                                    <i className="fas fa-download" style={{ color: '#bf5af2' }}></i>
                                )}
                                <span>{downloadingId === 'movie' ? 'Hazırlanıyor...' : 'Cihaza İndir'}</span>
                            </button>
                        )}
                    </motion.div>

                    {isSeries && (
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                marginBottom: '16px',
                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                                paddingBottom: '12px',
                                flexWrap: 'wrap'
                            }}>
                                <h3 style={{ fontSize: '20px', fontWeight: '700' }}>Bölümler</h3>
                                {seasons.length > 0 && (
                                    <select
                                        value={selectedSeason}
                                        onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                        className="focusable season-select"
                                    >
                                        {seasons.map(s => (
                                            <option key={s} value={s}>{s}. Sezon</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="scroll-btn left"
                                    onClick={() => handleScroll(episodesRef, 'left')}
                                    tabIndex="-1"
                                >
                                    <i className="fas fa-chevron-left"></i>
                                </button>
                                <div ref={episodesRef} className="row-scroll-container" style={{ paddingLeft: 0, marginLeft: '-16px', paddingRight: '16px' }}>
                                    {episodes.map(ep => (
                                        <div
                                            key={ep.id}
                                            className="episode-card"
                                            style={{ padding: 0, cursor: 'default', flexDirection: 'column' }}
                                        >
                                            {isWatched(movie.id, selectedSeason, ep.episode_number) && (
                                                <div className="watched-badge" style={{ left: '8px', right: 'auto', top: '8px' }}>
                                                    <i className="fas fa-check"></i>
                                                </div>
                                            )}
                                            <div style={{ aspectRatio: '16/9', position: 'relative' }}>
                                                <button
                                                    onClick={() => onPlay(movie, selectedSeason, ep.episode_number)}
                                                    className="focusable"
                                                    style={{
                                                        position: 'absolute', inset: 0, border: 'none', padding: 0,
                                                        background: 'transparent', width: '100%', height: '100%',
                                                        zIndex: 1, cursor: 'pointer'
                                                    }}
                                                >
                                                    <SmartImage
                                                        src={ep.still_path ? BACKDROP_IMG + ep.still_path : ''}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s', willChange: 'transform', transform: 'translateZ(0)' }} />
                                                    <div style={{
                                                        position: 'absolute', inset: 0,
                                                        background: 'rgba(0,0,0,0.3)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        opacity: 0.8
                                                    }}>
                                                        <div style={{
                                                            width: '40px', height: '40px',
                                                            borderRadius: '50%',
                                                            background: 'rgba(255, 255, 255, 0.2)',
                                                            backdropFilter: 'blur(4px)',
                                                            border: '1px solid rgba(255,255,255,0.4)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                                        }}>
                                                            <i className="fas fa-play" style={{ color: 'white', fontSize: '14px', marginLeft: '2px' }}></i>
                                                        </div>
                                                    </div>
                                                </button>

                                                {isAppBridgeAvailable() && (
                                                    <button
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             handleDownloadEpisode(ep.episode_number);
                                                         }}
                                                         className="focusable episode-download-btn"
                                                         disabled={downloadingId !== null}
                                                         style={{
                                                             position: 'absolute',
                                                             top: '8px',
                                                             right: '8px',
                                                             width: '32px',
                                                             height: '32px',
                                                             borderRadius: '50%',
                                                             background: downloadingId === `s${selectedSeason}e${ep.episode_number}` ? 'rgba(191, 90, 242, 0.35)' : 'rgba(0, 0, 0, 0.6)',
                                                             backdropFilter: 'blur(10px)',
                                                             WebkitBackdropFilter: 'blur(10px)',
                                                             border: downloadingId === `s${selectedSeason}e${ep.episode_number}` ? '1px solid #bf5af2' : '1px solid rgba(255, 255, 255, 0.2)',
                                                             color: downloadingId === `s${selectedSeason}e${ep.episode_number}` ? '#bf5af2' : 'white',
                                                             display: 'flex',
                                                             alignItems: 'center',
                                                             justifyContent: 'center',
                                                             zIndex: 5,
                                                             cursor: 'pointer',
                                                             transition: 'all 0.2s ease'
                                                         }}
                                                         title="Bölümü Cihaza İndir"
                                                     >
                                                         {downloadingId === `s${selectedSeason}e${ep.episode_number}` ? (
                                                             <i className="fas fa-spinner fa-spin" style={{ fontSize: '12px' }}></i>
                                                         ) : (
                                                             <i className="fas fa-download" style={{ fontSize: '12px' }}></i>
                                                         )}
                                                     </button>
                                                )}

                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '8px',
                                                    left: '8px',
                                                    background: 'rgba(0,0,0,0.75)',
                                                    backdropFilter: 'blur(10px)',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    color: 'white',
                                                    fontWeight: '600',
                                                    zIndex: 2, pointerEvents: 'none'
                                                }}>
                                                    {ep.episode_number}. Bölüm
                                                </div>
                                            </div>
                                            <div style={{ padding: '14px', position: 'relative', zIndex: 2 }}>
                                                <div style={{
                                                    fontWeight: '700',
                                                    color: 'white',
                                                    marginBottom: '6px',
                                                    fontSize: '14px'
                                                }}>
                                                    {ep.name}
                                                </div>
                                                <p style={{
                                                    fontSize: '12px',
                                                    color: 'rgba(255,255,255,0.6)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    lineHeight: '1.4'
                                                }}>
                                                    {ep.overview || "Özet bulunmuyor."}
                                                </p>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                                <button
                                    className="scroll-btn right"
                                    onClick={() => handleScroll(episodesRef, 'right')}
                                    tabIndex="-1"
                                >
                                    <i className="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    )}

                    {similar.length > 0 && (
                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{
                                fontSize: '20px',
                                fontWeight: '700',
                                marginBottom: '16px'
                            }}>
                                Benzerleri
                            </h3>
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="scroll-btn left"
                                    onClick={() => handleScroll(similarRef, 'left')}
                                    tabIndex="-1"
                                >
                                    <i className="fas fa-chevron-left"></i>
                                </button>
                                <div ref={similarRef} className="row-scroll-container" style={{ paddingLeft: 0, marginLeft: '-16px', paddingRight: '16px' }}>
                                    {similar.map(s => s.poster_path && (
                                        <button
                                            key={s.id}
                                            tabIndex="0"
                                            onClick={() => {
                                                const similarItem = {
                                                    ...s,
                                                    media_type: isSeries ? 'tv' : 'movie'
                                                };
                                                if (onOpenDetail) {
                                                    onOpenDetail(similarItem);
                                                }
                                            }}
                                            className="focusable poster-card card-portrait"
                                        >
                                            <SmartImage
                                                src={POSTER_IMG + s.poster_path}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            <div className="card-overlay">
                                                <span className="card-title">{s.title || s.name}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <button
                                    className="scroll-btn right"
                                    onClick={() => handleScroll(similarRef, 'right')}
                                    tabIndex="-1"
                                >
                                    <i className="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {showTrailer && trailer && (
                    <motion.div
                        className="trailer-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <button
                            className="focusable trailer-close"
                            onClick={() => setShowTrailer(false)}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                        <iframe
                            src={`https://www.youtube.com/embed/${trailer}?autoplay=1`}
                            className="trailer-iframe"
                            allowFullScreen
                            title="Trailer"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showMagnetPlayer && streamUrl && useStreamimdbEmbedFallback && streamimdbEmbedFallbackUrl ? (
                    <StreamimdbEmbedFallback
                        url={streamimdbEmbedFallbackUrl}
                        onClose={() => {
                            setShowMagnetPlayer(false);
                            setStreamUrl('');
                            setSubtitles([]);
                            setVidmodyAudioTracks(null);
                            setDiziyouAudioTracks(null);
                            setDizimomAudioTracks(null);
                            setStreamimdbEmbedFallbackUrl(null);
                            setUseStreamimdbEmbedFallback(false);
                        }}
                    />
                ) : showMagnetPlayer && streamUrl && (
                    <GlassPlayer
                        streamUrl={streamUrl}
                        subtitles={subtitles}
                        movieTitle={movie?.title || movie?.name}
                        episodeTitle={activeEpisode?.name || null}
                        imdbId={currentImdbId}
                        tmdbId={movie?.id}
                        mediaType={isSeries ? 'tv' : 'movie'}
                        season={isSeries ? selectedTorrentSeason : null}
                        episode={isSeries ? selectedTorrentEpisode : null}
                        poster={movie?.poster_path}
                        backdrop={movie?.backdrop_path}
                        externalAudioTracks={vidmodyAudioTracks || (diziyouAudioTracks ? {
                            provider: 'diziyou',
                            switchStrategy: 'source',
                            original: diziyouAudioTracks.original,
                            dub: diziyouAudioTracks.dub,
                            active: diziyouAudioTracks.active,
                            onChange: (track) => {
                                if (!diziyouAudioTracks) return;
                                if (track === 'dub' && diziyouAudioTracks.dub) {
                                    const proxied = `${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(diziyouAudioTracks.dub)}`;
                                    setStreamUrl(proxied);
                                    setDiziyouAudioTracks({ ...diziyouAudioTracks, active: 'dub' });
                                } else if (track === 'original' && diziyouAudioTracks.original) {
                                    const proxied = `${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(diziyouAudioTracks.original)}`;
                                    setStreamUrl(proxied);
                                    setDiziyouAudioTracks({ ...diziyouAudioTracks, active: 'original' });
                                }
                            }
                        } : (dizimomAudioTracks ? {
                            provider: 'dizimom',
                            switchStrategy: 'source',
                            original: dizimomAudioTracks.original,
                            dub: dizimomAudioTracks.dub,
                            active: dizimomAudioTracks.active,
                            onChange: (track) => {
                                if (!dizimomAudioTracks) return;
                                if (track === 'dub' && dizimomAudioTracks.dub) {
                                    const proxiedUrl = `${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(dizimomAudioTracks.dub)}`;
                                    setStreamUrl(proxiedUrl);
                                    setDizimomAudioTracks({ ...dizimomAudioTracks, active: 'dub' });
                                } else if (track === 'original' && dizimomAudioTracks.original) {
                                    const proxiedUrl = `${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(dizimomAudioTracks.original)}`;
                                    setStreamUrl(proxiedUrl);
                                    setDizimomAudioTracks({ ...dizimomAudioTracks, active: 'original' });
                                }
                            }
                        } : null))}
                        onPlaybackError={handleStreamimdbPlaybackError}
                        onClose={() => { setShowMagnetPlayer(false); setStreamUrl(''); setSubtitles([]); setVidmodyAudioTracks(null); setDiziyouAudioTracks(null); setDizimomAudioTracks(null); setStreamimdbEmbedFallbackUrl(null); setUseStreamimdbEmbedFallback(false); }}
                        onNextEpisode={isSeries ? () => {
                            const currentEp = currentEpisodeNumber;
                            const nextEp = episodes.find(ep => ep.episode_number === currentEp + 1);
                            if (nextEp) {
                                setShowMagnetPlayer(false);
                                setStreamUrl('');
                                setSubtitles([]);
                                setDiziyouAudioTracks(null);
                                setDizimomAudioTracks(null);
                                setStreamimdbEmbedFallbackUrl(null);
                                setUseStreamimdbEmbedFallback(false);
                                setTimeout(() => handleVidmodyWatch(selectedTorrentSeason, currentEp + 1), 100);
                            }
                        } : null}
                        nextEpisodeInfo={isSeries && nextEpisode ? {
                            episode: nextEpisode.episode_number,
                            title: nextEpisode.name
                        } : null}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showTorrentPicker && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.9)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 400,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px'
                        }}
                        onClick={() => setShowTorrentPicker(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'rgba(30, 30, 35, 0.95)',
                                backdropFilter: 'blur(30px)',
                                borderRadius: '20px',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                padding: '24px',
                                maxWidth: '600px',
                                width: '100%',
                                maxHeight: '80vh',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'white', margin: 0 }}>
                                    <i className="fas fa-magnet" style={{ marginRight: '10px', color: '#ffb347' }}></i>
                                    Kaynak Seç
                                </h3>
                                <button
                                    onClick={() => setShowTorrentPicker(false)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '36px',
                                        height: '36px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>

                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                {torrentOptions.map((torrent, index) => {
                                    return (
                                        <button
                                            key={index}
                                            onClick={() => handleSelectTorrent(torrent)}
                                            style={{
                                                width: '100%',
                                                background: (index === 0 ? 'linear-gradient(135deg, rgba(255, 107, 0, 0.2), rgba(255, 193, 7, 0.1))' : 'rgba(255, 255, 255, 0.05)'),
                                                border: (index === 0 ? '1px solid rgba(255, 165, 0, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)'),
                                                borderRadius: '12px',
                                                padding: '16px',
                                                marginBottom: '10px',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'all 0.2s ease',
                                                boxShadow: 'none'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 165, 0, 0.15)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = (index === 0 ? 'linear-gradient(135deg, rgba(255, 107, 0, 0.2), rgba(255, 193, 7, 0.1))' : 'rgba(255, 255, 255, 0.05)')}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{
                                                        background: torrent.quality?.includes('MP4')
                                                            ? 'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)' // MP4 (Direct Play) - Pinkish
                                                            : (torrent.quality?.includes('1080') || torrent.quality?.includes('4K') || torrent.quality?.includes('2160')
                                                                ? 'linear-gradient(135deg, #00C9FF, #92FE9D)' // High Quality - Blue/Green
                                                                : 'rgba(255, 255, 255, 0.2)'), // Standard
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '13px',
                                                        fontWeight: '700',
                                                        color: '#000',
                                                        boxShadow: torrent.quality?.includes('MP4') ? '0 2px 10px rgba(255, 154, 158, 0.4)' : 'none'
                                                    }}>
                                                        {torrent.quality || 'Unknown'}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                                                    {torrent.source}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '14px', color: 'white', marginBottom: '8px', fontWeight: '500' }}>
                                                {torrent.title || torrent.name}
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
                                                <span>
                                                    <i className="fas fa-users" style={{ marginRight: '6px', color: '#4CAF50' }}></i>
                                                    {torrent.seeds || 0} seed
                                                </span>
                                                <span>
                                                    <i className="fas fa-hdd" style={{ marginRight: '6px', color: '#2196F3' }}></i>
                                                    {torrent.size || 'N/A'}
                                                </span>
                                            </div>
                                            {index === 0 && (
                                                <div style={{
                                                    marginTop: '8px',
                                                    fontSize: '11px',
                                                    color: '#ffb347',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    <i className="fas fa-star"></i>
                                                    Önerilen
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                {showQualitySelector && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.75)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 11000,
                            padding: '16px'
                        }}
                        onClick={() => setShowQualitySelector(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 220 }}
                            style={{
                                width: '100%',
                                maxWidth: '380px',
                                background: '#100921',
                                border: '1px solid rgba(157, 84, 255, 0.3)',
                                borderRadius: '20px',
                                boxShadow: '0 8px 32px rgba(157, 84, 255, 0.15)',
                                padding: '24px',
                                color: 'white',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '20px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
                                <h3 style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '0.5px' }}>Noxis Akıllı İndirme</h3>
                                <p style={{ fontSize: '12px', color: '#AFA7C1', marginTop: '4px' }}>
                                    Lütfen çevrimdışı oynatma için indirme kalitesini ve ağ ayarlarını yapılandırın.
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#9D54FF', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Görüntü Kalitesi
                                </label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedQuality('HD')}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '12px',
                                            background: selectedQuality === 'HD' ? 'linear-gradient(135deg, #9D54FF 0%, #6F3ACC 100%)' : '#1E162D',
                                            border: selectedQuality === 'HD' ? '1px solid #9D54FF' : '1px solid rgba(255, 255, 255, 0.08)',
                                            color: 'white',
                                            fontWeight: '700',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: selectedQuality === 'HD' ? '0 4px 12px rgba(157, 84, 255, 0.3)' : 'none'
                                        }}
                                    >
                                        Noxis Premium (HD)
                                        <span style={{ display: 'block', fontSize: '10px', fontWeight: '400', opacity: 0.8, marginTop: '2px' }}>
                                            En yüksek detay (1080p)
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedQuality('SD')}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '12px',
                                            background: selectedQuality === 'SD' ? 'linear-gradient(135deg, #9D54FF 0%, #6F3ACC 100%)' : '#1E162D',
                                            border: selectedQuality === 'SD' ? '1px solid #9D54FF' : '1px solid rgba(255, 255, 255, 0.08)',
                                            color: 'white',
                                            fontWeight: '700',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: selectedQuality === 'SD' ? '0 4px 12px rgba(157, 84, 255, 0.3)' : 'none'
                                        }}
                                    >
                                        Noxis Hızlı (SD)
                                        <span style={{ display: 'block', fontSize: '10px', fontWeight: '400', opacity: 0.8, marginTop: '2px' }}>
                                            Kota dostu (480p)
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                background: '#170F26',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 255, 255, 0.05)'
                            }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '700' }}>Sadece Wi-Fi ile İndir</div>
                                    <div style={{ fontSize: '10px', color: '#AFA7C1', marginTop: '2px' }}>Hücresel veride indirmeyi bekletir.</div>
                                </div>
                                <div 
                                    onClick={() => setWifiOnlySetting(!wifiOnlySetting)}
                                    style={{
                                        width: '40px',
                                        height: '24px',
                                        borderRadius: '12px',
                                        background: wifiOnlySetting ? '#9D54FF' : '#23143D',
                                        border: wifiOnlySetting ? '1px solid #9D54FF' : '1px solid #331A54',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: '3px',
                                        left: wifiOnlySetting ? '19px' : '3px',
                                        transition: 'all 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                                    }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowQualitySelector(false)}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: 'transparent',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        color: '#AFA7C1',
                                        fontWeight: '700',
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    İptal Et
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDownload}
                                    style={{
                                        flex: 2,
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: 'linear-gradient(90deg, #9D54FF 0%, #6F3ACC 100%)',
                                        border: 0,
                                        color: 'white',
                                        fontWeight: '700',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 16px rgba(157, 84, 255, 0.4)'
                                    }}
                                >
                                    İndirmeyi Başlat
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export const Player = ({ movie, onClose, initialSeason, initialEpisode }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [source, setSource] = useState('hdfilmizle');
    const [showControls, setShowControls] = useState(true);
    const [scrapedUrls, setScrapedUrls] = useState({});
    const [loadingSource, setLoadingSource] = useState(null);
    const [iframeError, setIframeError] = useState(false);
    const controlsTimeout = useRef(null);
    const isSeries = movie.media_type === 'tv' || movie.first_air_date || movie.number_of_seasons || (movie.name && !movie.title);

    const [m3uUrl, setM3uUrl] = useState(null);
    const [vidmodyUrl, setVidmodyUrl] = useState(null);
    const [vidmodyAudios, setVidmodyAudios] = useState(null);
    const [streamimdbUrl, setStreamimdbUrl] = useState(null);
    const [streamimdbEmbedUrl, setStreamimdbEmbedUrl] = useState(null);
    const [useStreamimdbEmbedFallback, setUseStreamimdbEmbedFallback] = useState(false);
    const [diziyouUrl, setDiziyouUrl] = useState(null);
    const [diziyouSources, setDiziyouSources] = useState(null);
    const [dizigomUrl, setDizigomUrl] = useState(null);
    const [dizigomSources, setDizigomSources] = useState(null);
    const [dizimomUrl, setDizimomUrl] = useState(null);
    const [dizimomSources, setDizimomSources] = useState(null);
    const [subtitles, setSubtitles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentSource, setCurrentSource] = useState(null); // 'vidmody' | 'streamimdb' | 'diziyou' | 'dizigom' | 'dizimom' | 'm3u' | null
    const [resolvedImdbId, setResolvedImdbId] = useState(movie.imdb_id || movie.external_ids?.imdb_id || null);
    const [episodeTitle, setEpisodeTitle] = useState(null);
    const [nextEpisodeInfo, setNextEpisodeInfo] = useState(null);
    const diziyouAttempted = useRef(false);
    const dizigomAttempted = useRef(false);
    const dizimomAttempted = useRef(false);
    const m3uAttempted = useRef(false);

    const resetResolvedSources = useCallback(() => {
        setM3uUrl(null);
        setVidmodyUrl(null);
        setVidmodyAudios(null);
        setStreamimdbUrl(null);
        setStreamimdbEmbedUrl(null);
        setUseStreamimdbEmbedFallback(false);
        setDiziyouUrl(null);
        setDiziyouSources(null);
        setDizigomUrl(null);
        setDizigomSources(null);
        setDizimomUrl(null);
        setDizimomSources(null);
        setSubtitles([]);
        setCurrentSource(null);
    }, []);

    const applyResolvedSource = useCallback((type, payload = {}) => {
        const {
            url = null,
            subtitles: nextSubtitles = [],
            vidmodyTracks = null,
            streamimdbEmbedUrl: nextStreamimdbEmbedUrl = null,
            diziyouData = null,
            dizigomData = null,
            dizimomData = null
        } = payload;

        setM3uUrl(type === 'm3u' ? url : null);
        setVidmodyUrl(type === 'vidmody' ? url : null);
        setVidmodyAudios(type === 'vidmody' ? vidmodyTracks : null);
        setStreamimdbUrl(type === 'streamimdb' ? url : null);
        setStreamimdbEmbedUrl(type === 'streamimdb' ? nextStreamimdbEmbedUrl : null);
        setUseStreamimdbEmbedFallback(false);
        setDiziyouUrl(type === 'diziyou' ? url : null);
        setDiziyouSources(type === 'diziyou' ? diziyouData : null);
        setDizigomUrl(type === 'dizigom' ? url : null);
        setDizigomSources(type === 'dizigom' ? dizigomData : null);
        setDizimomUrl(type === 'dizimom' ? url : null);
        setDizimomSources(type === 'dizimom' ? dizimomData : null);
        setSubtitles(nextSubtitles);
        setCurrentSource(type);
    }, []);

    useEffect(() => {
        diziyouAttempted.current = false;
        dizigomAttempted.current = false;
        dizimomAttempted.current = false;
        m3uAttempted.current = false;
    }, [movie?.id, initialSeason, initialEpisode]);

    useEffect(() => {
        let cancelled = false;

        const loadEpisodeData = async () => {
            if (!isSeries || !initialSeason || !initialEpisode) {
                setEpisodeTitle(null);
                setNextEpisodeInfo(null);
                return;
            }

            try {
                const seasonData = await fetchTMDB(`/tv/${movie.id}/season/${initialSeason}`);
                if (cancelled) return;

                const currentEpisode = seasonData?.episodes?.find(
                    ep => ep.episode_number === initialEpisode
                );
                const nextEpisode = seasonData?.episodes?.find(
                    ep => ep.episode_number === initialEpisode + 1
                );
                setEpisodeTitle(currentEpisode?.name || null);
                setNextEpisodeInfo(nextEpisode ? {
                    episode: nextEpisode.episode_number,
                    title: nextEpisode.name || null
                } : null);
            } catch (e) {
                if (!cancelled) {
                    setEpisodeTitle(null);
                    setNextEpisodeInfo(null);
                }
            }
        };

        loadEpisodeData();

        return () => {
            cancelled = true;
        };
    }, [movie.id, isSeries, initialSeason, initialEpisode]);

    // Main source resolution - Sequential fallback
    useEffect(() => {
        let cancelled = false;

        const resolveSources = async () => {
            setLoading(true);

            if ((movie.isOffline || movie.isLocal) && movie.localUrl) {
                if (!cancelled) {
                    const fetchOfflineMetadata = async () => {
                        let localSubs = [];
                        try {
                            const metadataUrl = movie.localUrl.replace('video.mp4', 'video.info.json');
                            console.log("[Offline Player] Yerel metadata okunuyor:", metadataUrl);
                            const response = await fetch(metadataUrl);
                            if (response.ok) {
                                const metadata = await response.json();
                                if (metadata && Array.isArray(metadata.subtitles)) {
                                    localSubs = metadata.subtitles.map(s => ({
                                        lang: s.lang,
                                        label: s.label || s.lang,
                                        url: s.url
                                    }));
                                    console.log("[Offline Player] Yerel altyazılar yüklendi:", localSubs);
                                }
                            }
                        } catch (e) {
                            console.warn("[Offline Player] Yerel video.info.json okunamadı, altyazısız devam ediliyor:", e);
                        }
                        
                        if (!cancelled) {
                            applyResolvedSource('vidmody', {
                                url: movie.localUrl,
                                subtitles: localSubs
                            });
                            setLoading(false);
                        }
                    };
                    fetchOfflineMetadata();
                }
                return;
            }

            let imdbId = movie.imdb_id || movie.external_ids?.imdb_id || null;

            if (imdbId && !cancelled) {
                setResolvedImdbId(imdbId);
            }

            // Helper: fetch with timeout
            const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    const res = await fetch(url, { ...options, signal: controller.signal });
                    clearTimeout(id);
                    return res;
                } catch {
                    clearTimeout(id);
                    return null;
                }
            };

            // Step 1: Try Vidmody via Backend API
            try {
                if (!imdbId) {
                    const data = await fetchTMDB(`/${movie.media_type || (isSeries ? 'tv' : 'movie')}/${movie.id}/external_ids`);
                    imdbId = data?.imdb_id || null;
                }

                if (imdbId && !cancelled) {
                    setResolvedImdbId(imdbId);
                }

                if (imdbId && !cancelled) {
                    const vidmodyParams = new URLSearchParams({
                        imdbId,
                        season: isSeries ? initialSeason : '',
                        episode: isSeries ? initialEpisode : ''
                    });
                    
                    const vidmodyRes = await fetchWithTimeout(
                        `${SERVER_URL}/api/vidmody/resolve?${vidmodyParams}`,
                        {},
                        10000
                    );

                    if (vidmodyRes && !cancelled) {
                        const vidmodyData = await vidmodyRes.json();
                        
                        if (vidmodyData.success && vidmodyData.videos?.length > 0) {
                            const videos = vidmodyData.videos;
                            const audios = vidmodyData.audios || [];
                            const subs = vidmodyData.subtitles || [];

                            const masterUrl = buildVidmodyMasterUrl({
                                workerUrl: WORKER_URL,
                                videos,
                                audios,
                                subtitles: subs,
                                workingAudio: vidmodyData.workingAudio || 'a1',
                                audioSwitchStrategy: vidmodyData.audioSwitchStrategy
                            });

                            const vidmodyTracks = buildVidmodyExternalAudioTracks(audios, {
                                audioSwitchStrategy: vidmodyData.audioSwitchStrategy,
                                workingAudio: vidmodyData.workingAudio || 'a1'
                            });

                            try {
                                const subParams = new URLSearchParams({
                                    imdb: imdbId || '',
                                    season: isSeries ? initialSeason : '',
                                    episode: isSeries ? initialEpisode : ''
                                });
                                const subRes = await fetchWithTimeout(`${SERVER_URL}/api/subtitles?${subParams}`, {}, 6000);
                                if (subRes) {
                                    const subData = await subRes.json();
                                    if (Array.isArray(subData) && subData.length > 0) {
                                        applyResolvedSource('vidmody', {
                                            url: masterUrl,
                                            subtitles: normalizeExternalSubtitles(subData),
                                            vidmodyTracks
                                        });
                                    } else {
                                        applyResolvedSource('vidmody', {
                                            url: masterUrl,
                                            subtitles: [],
                                            vidmodyTracks
                                        });
                                    }
                                } else {
                                    applyResolvedSource('vidmody', {
                                        url: masterUrl,
                                        subtitles: [],
                                        vidmodyTracks
                                    });
                                }
                            } catch (err) {
                                console.warn('[Player Vidmody] External subtitle fetch failed:', err);
                                applyResolvedSource('vidmody', {
                                    url: masterUrl,
                                    subtitles: [],
                                    vidmodyTracks
                                });
                            }
                            setLoading(false);
                            return;
                        }
                    }
                }
            } catch (e) {
                console.warn('[Player] Vidmody resolve failed:', e);
            }

            if (cancelled) return;

            // Step 2: Try StreamIMDb via Backend API
            if (imdbId && !cancelled) {
                const streamimdbController = new AbortController();
                const streamimdbTimeout = setTimeout(() => streamimdbController.abort(), 10000);

                try {
                    const sources = await findStreamimdbSource(
                        imdbId,
                        isSeries ? 'tv' : 'movie',
                        isSeries ? initialSeason : null,
                        isSeries ? initialEpisode : null,
                        { signal: streamimdbController.signal, tmdbId: movie.id }
                    );

                    if (sources?.url && !cancelled) {
                        const sourceSubtitles = normalizeSourceSubtitles(sources.subtitles || [], 'StreamIMDb');

                        try {
                            const subParams = new URLSearchParams({
                                imdb: imdbId || '',
                                season: isSeries ? initialSeason : '',
                                episode: isSeries ? initialEpisode : '',
                                source: 'streamimdb'
                            });
                            const subRes = await fetchWithTimeout(`${SERVER_URL}/api/subtitles?${subParams}`, {}, 6000);
                            if (subRes) {
                                const subData = await subRes.json();
                                if (Array.isArray(subData) && subData.length > 0) {
                                    applyResolvedSource('streamimdb', {
                                        url: sources.url,
                                        streamimdbEmbedUrl: sources.wrapperUrl || sources.embedUrl || null,
                                        subtitles: mergeSubtitleLists(
                                            sourceSubtitles,
                                            normalizeExternalSubtitles(subData)
                                        )
                                    });
                                } else {
                                    applyResolvedSource('streamimdb', {
                                        url: sources.url,
                                        streamimdbEmbedUrl: sources.wrapperUrl || sources.embedUrl || null,
                                        subtitles: sourceSubtitles
                                    });
                                }
                            } else {
                                applyResolvedSource('streamimdb', {
                                    url: sources.url,
                                    streamimdbEmbedUrl: sources.wrapperUrl || sources.embedUrl || null,
                                    subtitles: sourceSubtitles
                                });
                            }
                        } catch (subErr) {
                            applyResolvedSource('streamimdb', {
                                url: sources.url,
                                streamimdbEmbedUrl: sources.wrapperUrl || sources.embedUrl || null,
                                subtitles: sourceSubtitles
                            });
                        }
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.warn('[Player] StreamIMDb failed or timed out');
                } finally {
                    clearTimeout(streamimdbTimeout);
                }
            }

            if (cancelled) return;

            // Step 3: Try Diziyou (series only, 10s timeout)
            if (isSeries && !diziyouAttempted.current) {
                diziyouAttempted.current = true;

                try {
                    const diziyouPromise = findDiziyouSource(movie.name || movie.title, initialSeason, initialEpisode, movie.original_name || movie.original_title);
                    const diziyouTimeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 10000));
                    const sources = await Promise.race([diziyouPromise, diziyouTimeoutPromise]);

                    const availableUrl = sources?.original || sources?.turkish_dub;

                    if (sources && availableUrl && !cancelled) {
                        const url = sources.original || sources.turkish_dub;

                        const sourceSubtitles = normalizeSourceSubtitles(sources.subtitles || [], 'Diziyou');
                        try {
                            const subParams = new URLSearchParams({
                                imdb: imdbId || '',
                                season: initialSeason,
                                episode: initialEpisode
                            });
                            const subRes = await fetchWithTimeout(`${SERVER_URL}/api/subtitles?${subParams}`, {}, 6000);
                            if (subRes) {
                                const subData = await subRes.json();
                                if (Array.isArray(subData) && subData.length > 0) {
                                    applyResolvedSource('diziyou', {
                                        url,
                                        subtitles: mergeSubtitleLists(
                                            sourceSubtitles,
                                            normalizeExternalSubtitles(subData)
                                        ),
                                        diziyouData: sources
                                    });
                                } else {
                                    applyResolvedSource('diziyou', {
                                        url,
                                        subtitles: sourceSubtitles,
                                        diziyouData: sources
                                    });
                                }
                            } else {
                                applyResolvedSource('diziyou', {
                                    url,
                                    subtitles: sourceSubtitles,
                                    diziyouData: sources
                                });
                            }
                        } catch (subErr) {
                            applyResolvedSource('diziyou', {
                                url,
                                subtitles: sourceSubtitles,
                                diziyouData: sources
                            });
                        }
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.warn('[Player] Diziyou failed or timed out');
                }
            }

            if (cancelled) return;

            // Step 4: Try Dizigom (series only, 14s timeout)
            if (isSeries && !dizigomAttempted.current) {
                dizigomAttempted.current = true;
                try {
                    const dizigomPromise = findDizigomSource(movie.name || movie.title, initialSeason, initialEpisode, movie.original_name || movie.original_title);
                    const dizigomTimeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 14000));
                    const sources = await Promise.race([dizigomPromise, dizigomTimeoutPromise]);

                    if (sources?.original && !cancelled) {
                        const proxiedUrl = `${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(sources.original)}`;
                        const sourceSubtitles = normalizeSourceSubtitles(sources.subtitles || [], 'Dizigom');

                        try {
                            const subParams = new URLSearchParams({
                                imdb: imdbId || '',
                                season: initialSeason,
                                episode: initialEpisode
                            });
                            const subRes = await fetchWithTimeout(`${SERVER_URL}/api/subtitles?${subParams}`, {}, 6000);
                            if (subRes) {
                                const subData = await subRes.json();
                                if (Array.isArray(subData) && subData.length > 0) {
                                    applyResolvedSource('dizigom', {
                                        url: proxiedUrl,
                                        subtitles: mergeSubtitleLists(
                                            sourceSubtitles,
                                            normalizeExternalSubtitles(subData)
                                        ),
                                        dizigomData: sources
                                    });
                                } else {
                                    applyResolvedSource('dizigom', {
                                        url: proxiedUrl,
                                        subtitles: sourceSubtitles,
                                        dizigomData: sources
                                    });
                                }
                            } else {
                                applyResolvedSource('dizigom', {
                                    url: proxiedUrl,
                                    subtitles: sourceSubtitles,
                                    dizigomData: sources
                                });
                            }
                        } catch (subErr) {
                            applyResolvedSource('dizigom', {
                                url: proxiedUrl,
                                subtitles: sourceSubtitles,
                                dizigomData: sources
                            });
                        }
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.warn('[Player] Dizigom failed or timed out');
                }
            }

            if (cancelled) return;

            // Step 5: Try Dizimom (series only, 10s timeout)
            if (isSeries && !dizimomAttempted.current) {
                dizimomAttempted.current = true;
                try {
                    const dizimomPromise = findDizimomSource(movie.name || movie.title, initialSeason, initialEpisode);
                    const dizimomTimeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 10000));
                    const sources = await Promise.race([dizimomPromise, dizimomTimeoutPromise]);

                    if (sources && (sources.original || sources.turkish_dub) && !cancelled) {
                        const initialUrl = sources.original || sources.turkish_dub;
                        const proxiedUrl = `${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(initialUrl)}`;
                        
                        const sourceSubtitles = normalizeSourceSubtitles(sources.subtitles || [], 'Dizimom');
                        // Try OpenSubtitles as fallback for subtitles
                        try {
                            const subParams = new URLSearchParams({
                                imdb: imdbId || '',
                                season: initialSeason,
                                episode: initialEpisode
                            });
                            const subRes = await fetchWithTimeout(`${SERVER_URL}/api/subtitles?${subParams}`, {}, 6000);
                            if (subRes) {
                                const subData = await subRes.json();
                                if (Array.isArray(subData) && subData.length > 0) {
                                    applyResolvedSource('dizimom', {
                                        url: proxiedUrl,
                                        subtitles: mergeSubtitleLists(
                                            sourceSubtitles,
                                            normalizeExternalSubtitles(subData)
                                        ),
                                        dizimomData: sources
                                    });
                                } else {
                                    applyResolvedSource('dizimom', {
                                        url: proxiedUrl,
                                        subtitles: sourceSubtitles,
                                        dizimomData: sources
                                    });
                                }
                            } else {
                                applyResolvedSource('dizimom', {
                                    url: proxiedUrl,
                                    subtitles: sourceSubtitles,
                                    dizimomData: sources
                                });
                            }
                        } catch (subErr) {
                            applyResolvedSource('dizimom', {
                                url: proxiedUrl,
                                subtitles: sourceSubtitles,
                                dizimomData: sources
                            });
                        }
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.warn('[Player] Dizimom failed or timed out');
                }
            }

            if (cancelled) return;

            // Step 6: Try M3U (8s timeout)
            if (!m3uAttempted.current) {
                m3uAttempted.current = true;

                try {
                    const m3uPromise = findInM3U(movie.name || movie.title, initialSeason, initialEpisode);
                    const m3uTimeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 8000));
                    const m3uResult = await Promise.race([m3uPromise, m3uTimeoutPromise]);

                    if (m3uResult && !cancelled) {
                        applyResolvedSource('m3u', {
                            url: m3uResult,
                            subtitles: []
                        });
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.warn('[Player] M3U failed or timed out');
                }
            }

            // No source found
            if (!cancelled) {
                console.log("[Player] No sources found");
                resetResolvedSources();
                setLoading(false);
            }
        };

        resolveSources();

        return () => { cancelled = true; };
    }, [movie?.id, isSeries, initialSeason, initialEpisode, applyResolvedSource, resetResolvedSources]);

    const handleInteraction = () => {
        setShowControls(true);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    };

    // Audio track switcher for Diziyou
    const handleDiziyouAudioChange = (track) => {
        if (!diziyouSources) return;
        if (track === 'dub' && diziyouSources.turkish_dub) {
            setDiziyouUrl(diziyouSources.turkish_dub);
        } else if (track === 'original' && diziyouSources.original) {
            setDiziyouUrl(diziyouSources.original);
        }
    };

    // Audio track switcher for Dizimom
    const handleDizimomAudioChange = (track) => {
        if (!dizimomSources) return;
        const targetUrl = track === 'dub' ? dizimomSources.turkish_dub : dizimomSources.original;
        if (targetUrl) {
            const proxiedUrl = `${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(targetUrl)}`;
            setDizimomUrl(proxiedUrl);
        }
    };

    const handleStreamimdbPlaybackError = useCallback((event = {}) => {
        if (event.hasStarted || Number(event.currentTime) > 3) return;
        if (currentSource === 'streamimdb' && streamimdbEmbedUrl) {
            setUseStreamimdbEmbedFallback(true);
        }
    }, [currentSource, streamimdbEmbedUrl]);

    const hasSource = vidmodyUrl || streamimdbUrl || diziyouUrl || dizigomUrl || dizimomUrl || m3uUrl;
    const currentStreamUrl = vidmodyUrl || streamimdbUrl || diziyouUrl || dizigomUrl || dizimomUrl || m3uUrl;
    const mediaType = movie.media_type || (isSeries ? 'tv' : 'movie');
    const shouldShowStreamimdbEmbed = currentSource === 'streamimdb' && useStreamimdbEmbedFallback && streamimdbEmbedUrl;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 9999 }} onMouseMove={handleInteraction}>
            {loading && !hasSource ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', marginRight: '10px' }}></i>
                    Kaynaklar taranıyor...
                </div>
            ) : shouldShowStreamimdbEmbed ? (
                <StreamimdbEmbedFallback url={streamimdbEmbedUrl} onClose={onClose} />
            ) : hasSource ? (
                <>
                <GlassPlayer
                    streamUrl={currentStreamUrl}
                    subtitles={subtitles}
                    onClose={onClose}
                    movieTitle={movie.title || movie.name}
                    episodeTitle={episodeTitle}
                    imdbId={resolvedImdbId || movie.imdb_id || movie.external_ids?.imdb_id}
                    tmdbId={movie.id}
                    mediaType={isSeries ? 'tv' : 'movie'}
                    season={isSeries ? initialSeason : null}
                    episode={isSeries ? initialEpisode : null}
                    poster={movie.poster_path}
                    backdrop={movie.backdrop_path}
                        onNextEpisode={isSeries && nextEpisodeInfo ? () => {
                            navigate(`/play/${mediaType}/${movie.id}?s=${initialSeason}&e=${nextEpisodeInfo.episode}`, {
                                replace: true,
                                state: location.state
                            });
                        } : null}
                    nextEpisodeInfo={nextEpisodeInfo}
                    onPlaybackError={handleStreamimdbPlaybackError}
                    externalAudioTracks={vidmodyAudios || (diziyouSources ? {
                        provider: 'diziyou',
                        switchStrategy: 'source',
                        original: diziyouSources.original,
                        dub: diziyouSources.turkish_dub,
                        active: diziyouUrl === diziyouSources.turkish_dub ? 'dub' : 'original',
                        onChange: handleDiziyouAudioChange
                    } : (dizimomSources ? {
                        provider: 'dizimom',
                        switchStrategy: 'source',
                        original: dizimomSources.original,
                        dub: dizimomSources.turkish_dub,
                        active: dizimomUrl.includes(encodeURIComponent(dizimomSources.turkish_dub || '')) ? 'dub' : 'original',
                        onChange: handleDizimomAudioChange
                    } : null))}
                />
                <AnimatePresence>
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(0, 0, 0, 0.28)',
                                backdropFilter: 'blur(6px)',
                                WebkitBackdropFilter: 'blur(6px)',
                                zIndex: 30
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '14px 20px',
                                borderRadius: '14px',
                                background: 'rgba(10, 10, 10, 0.72)',
                                border: '1px solid rgba(255,255,255,0.14)',
                                color: 'white',
                                boxShadow: '0 12px 40px rgba(0,0,0,0.35)'
                            }}>
                                <i className="fas fa-spinner fa-spin" />
                                <span>Sonraki bölüm yükleniyor...</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                </>
            ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <i className="fas fa-exclamation-triangle" style={{ fontSize: '48px', marginBottom: '16px', color: '#e50914' }}></i>
                    <h3>Kaynak Bulunamadı</h3>
                    <p style={{ opacity: 0.7 }}>Bu içerik için şu an uygun bir kaynak yok.</p>
                    <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 20px', background: 'white', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Kapat
                    </button>
                </div>
            )}
        </div>
    );
};
