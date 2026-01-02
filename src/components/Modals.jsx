import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartImage, ORIGINAL_IMG, BACKDROP_IMG, POSTER_IMG } from './Shared';
import { fetchTMDB, isWatched, markAsWatched, saveContinueWatching } from '../hooks/useAppLogic';
import { scrapeHdfilmizle, isNativePlatform } from '../services/nativeHttp';
import { GlassPlayer } from './player/GlassPlayer';
import { searchTorrents } from '../services/torrent-aggregator';

// VPS veya Backend URL'si (.env dosyasından gelir veya URL'den override edilir)
const SERVER_URL = localStorage.getItem('noxis_api_url') || import.meta.env.VITE_API_URL || "http://localhost:3000";

const createSlug = (text) => {
    if (!text) return "";
    const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ı': 'i', 'ö': 'o', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'İ': 'i', 'Ö': 'o' };
    const slug = text.split('').map(char => trMap[char] || char).join('')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    if (!slug || slug.length === 0) return "movie";
    return slug;
};

export const DetailModal = ({ movie, onClose, onPlay, onOpenDetail }) => {
    const [details, setDetails] = useState(null);
    const [seasons, setSeasons] = useState([]);
    const [episodes, setEpisodes] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [similar, setSimilar] = useState([]);
    const [trailer, setTrailer] = useState(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const isSeries = movie.media_type === 'tv' || movie.first_air_date;

    const [showMagnetPlayer, setShowMagnetPlayer] = useState(false);
    const [streamUrl, setStreamUrl] = useState('');
    const [subtitles, setSubtitles] = useState([]);
    const [magnetLoading, setMagnetLoading] = useState(false);
    const [magnetError, setMagnetError] = useState(null);
    const [torrentOptions, setTorrentOptions] = useState([]);
    const [showTorrentPicker, setShowTorrentPicker] = useState(false);
    const [selectedTorrentSeason, setSelectedTorrentSeason] = useState(1);
    const [selectedTorrentEpisode, setSelectedTorrentEpisode] = useState(1);
    const [currentImdbId, setCurrentImdbId] = useState(null);

    const episodesRef = useRef(null);
    const similarRef = useRef(null);

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
        fetchTMDB(`/${type}/${movie.id}?append_to_response=credits,similar,videos`).then(d => {
            setDetails(d);
            if (d?.similar?.results) setSimilar(d.similar.results.slice(0, 12));
            if (d?.videos?.results) {
                const t = d.videos.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
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

    const handlePlayEpisode = useCallback((s, e) => {
        markAsWatched(movie.id, s, e);
        setTimeout(() => onPlay(movie, s, e), 50);
    }, [movie, onPlay]);

    const handlePlayMovie = useCallback(() => {
        markAsWatched(movie.id);
        onPlay(movie, 1, 1);
    }, [movie, onPlay]);

    const handlePartyWatch = async (seasonNum = null, episodeNum = null) => {
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
            const s = seasonNum || selectedTorrentSeason || selectedSeason || 1;
            const e = episodeNum || selectedTorrentEpisode || 1;

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
                await handleSelectTorrent(results[0]);
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

    const handleSelectTorrent = async (torrent) => {
        setShowTorrentPicker(false);
        setMagnetLoading(true);
        setMagnetError(null);

        try {
            const params = new URLSearchParams({
                magnet: torrent.magnetUri,
                imdb: currentImdbId
            });

            if (isSeries) {
                params.append('season', selectedTorrentSeason);
                params.append('episode', selectedTorrentEpisode);
            }

            // VPS'e İstek At (Streaming için)
            // SERVER_URL burada devreye giriyor (VPS Adresi)
            const streamUrl = `${SERVER_URL}/stream?${params}`;

            // Subtitle Fetching (VPS) - Kesinlikle altyazı olmalı!
            try {
                const subParams = new URLSearchParams({
                    imdb: currentImdbId,
                    season: isSeries ? selectedTorrentSeason : '',
                    episode: isSeries ? selectedTorrentEpisode : ''
                });
                console.log('[Subtitles] Altyazı aranıyor...', currentImdbId);
                const subRes = await fetch(`${SERVER_URL}/subtitles?${subParams}`);
                const subData = await subRes.json();

                if (Array.isArray(subData) && subData.length > 0) {
                    console.log(`[Subtitles] ✅ ${subData.length} altyazı bulundu`);
                    // Türkçe altyazıları en üste koy
                    const sorted = subData.sort((a, b) => {
                        if (a.lang === 'tur' || a.lang === 'tr') return -1;
                        if (b.lang === 'tur' || b.lang === 'tr') return 1;
                        return 0;
                    });
                    setSubtitles(sorted);
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

    return (
        <motion.div
            className="detail-view-container"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '30%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
        >
            <div className="detail-hero-wrapper">
                <SmartImage
                    src={ORIGINAL_IMG + (movie.backdrop_path || movie.poster_path)}
                    className="detail-hero-img"
                    alt={movie.title || movie.name}
                />
            </div>

            <div className="detail-content-layer">
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
                            onClick={handlePlayMovie}
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

                        <button
                            tabIndex="0"
                            onClick={() => handlePartyWatch()}
                            className="focusable glass-button"
                            style={{ background: 'linear-gradient(135deg, rgba(255, 107, 0, 0.2), rgba(255, 193, 7, 0.2))', borderColor: 'rgba(255, 165, 0, 0.5)', color: '#ffb347', gap: '8px' }}
                            disabled={magnetLoading}
                        >
                            <i className={`fas ${magnetLoading ? 'fa-spinner fa-spin' : 'fa-magnet'}`}></i>
                            <span>{magnetLoading ? 'Aranıyor...' : 'Torrent İzle'}</span>
                        </button>

                        {magnetError && <span style={{ color: '#ff6b6b', fontSize: '13px', marginLeft: '10px', alignSelf: 'center' }}>{magnetError}</span>}
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
                                                {/* Main Play Action (Focusable) */}
                                                <button
                                                    onClick={() => handlePlayEpisode(selectedSeason, ep.episode_number)}
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
                                                        opacity: 0.8 // Always visible for TV clarity
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

                                                {/* Independent Torrent Button (Focusable) */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePartyWatch(selectedSeason, ep.episode_number);
                                                    }}
                                                    className="focusable"
                                                    title="Torrent / 4K İzle"
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '8px',
                                                        right: '8px',
                                                        width: '36px', height: '36px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, rgba(255, 107, 0, 0.9), rgba(255, 193, 7, 0.9))',
                                                        backdropFilter: 'blur(4px)',
                                                        border: '2px solid rgba(255, 255, 255, 0.2)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                                        cursor: 'pointer',
                                                        zIndex: 3 // Higher than play button
                                                    }}
                                                >
                                                    <i className="fas fa-magnet" style={{ color: 'white', fontSize: '14px' }}></i>
                                                </button>
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
                                                onClose();
                                                setTimeout(() => {
                                                    if (onOpenDetail) {
                                                        onOpenDetail(similarItem);
                                                    }
                                                }, 300);
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
                {showMagnetPlayer && streamUrl && (
                    <GlassPlayer
                        streamUrl={streamUrl}
                        subtitles={subtitles}
                        movieTitle={movie?.title || movie?.name}
                        imdbId={currentImdbId}
                        season={isSeries ? selectedTorrentSeason : null}
                        episode={isSeries ? selectedTorrentEpisode : null}
                        poster={movie?.poster_path}
                        backdrop={movie?.backdrop_path}
                        onClose={() => { setShowMagnetPlayer(false); setStreamUrl(''); setSubtitles([]); }}
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
            </AnimatePresence>
        </motion.div>
    );
};

export const Player = ({ movie, onClose, initialSeason, initialEpisode }) => {
    const [source, setSource] = useState('hdfilmizle');
    const [showControls, setShowControls] = useState(true);
    const [scrapedUrls, setScrapedUrls] = useState({});
    const [loadingSource, setLoadingSource] = useState(null);
    const [iframeError, setIframeError] = useState(false);
    const controlsTimeout = useRef(null);
    const isSeries = movie.media_type === 'tv' || movie.first_air_date;

    const scrapeIframeUrl = useCallback(async (site) => {
        if (scrapedUrls[site]) return scrapedUrls[site];

        setLoadingSource(site);
        const movieTitle = movie.title || movie.name;
        const originalTitle = movie.original_title || movie.original_name || movieTitle;
        const slug = createSlug(movieTitle);
        const year = (movie.release_date || movie.first_air_date || '').split('-')[0];

        try {
            console.log(`[Player] Scraping ${site} for: ${movieTitle} (${slug})`);

            if (site === 'hdfilmizle' && isNativePlatform()) {
                console.log(`[Player] Using native HTTP for scraping`);
                const result = await scrapeHdfilmizle(
                    movieTitle,
                    year,
                    isSeries,
                    isSeries ? initialSeason : null,
                    isSeries ? initialEpisode : null
                );

                if (result.success && result.iframeUrl) {
                    console.log(`[Player] ✅ Found iframe (native): ${result.iframeUrl}`);
                    setScrapedUrls(prev => ({ ...prev, [site]: result.iframeUrl }));
                    setLoadingSource(null);
                    return result.iframeUrl;
                } else {
                    console.log(`[Player] ❌ No iframe found (native)`, result);
                    setLoadingSource(null);
                    return null;
                }
            }

            const params = new URLSearchParams({ site, slug, title: movieTitle, original: originalTitle });
            if (isSeries) {
                params.append('s', initialSeason);
                params.append('e', initialEpisode);
            }

            const res = await fetch(`/api/scrape-iframe?${params}`);
            const data = await res.json();

            if (data.success && data.url) {
                console.log(`[Player] ✅ Found iframe: ${data.url}`);
                setScrapedUrls(prev => ({ ...prev, [site]: data.url }));
                setLoadingSource(null);
                return data.url;
            } else {
                console.log(`[Player] ❌ No iframe found for ${site}`, data);
                setLoadingSource(null);
                return null;
            }
        } catch (err) {
            console.error(`[Player] Scrape error:`, err);
            setLoadingSource(null);
            return null;
        }
    }, [movie, isSeries, initialSeason, initialEpisode, scrapedUrls]);

    useEffect(() => {
        if (source === 'hdfilmizle' || source === 'yabancidizibox' || source === 'filmizlejet') {
            if (!scrapedUrls[source]) {
                scrapeIframeUrl(source);
            }
        }
    }, [source, scrapeIframeUrl, scrapedUrls]);

    const SOURCES = [
        { id: 'filmizlejet', name: '🎬 Filmizlejet' },
        { id: 'yabancidizibox', name: '🇹🇷 TR Dublaj' },
        { id: 'hdfilmizle', name: '🇹🇷 TR Altyazı' },
        { id: 'multiembed', name: 'MultiEmbed' },
        { id: 'vidsrc.cc', name: 'VidSrc CC' },
        { id: 'vidsrc.me', name: 'VidSrc ME' }
    ];

    const getUrl = useCallback(() => {
        if ((source === 'hdfilmizle' || source === 'yabancidizibox' || source === 'filmizlejet') && scrapedUrls[source]) {
            if (isNativePlatform()) {
                return scrapedUrls[source];
            }
            const targetUrl = scrapedUrls[source];
            let referer = 'https://filmizlejet.com/';
            if (source === 'yabancidizibox') referer = 'https://yabancidizibox.com/';
            else if (source === 'hdfilmizle') referer = 'https://www.hdfilmizle.life/';
            return `/api/video-proxy?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent(referer)}`;
        }

        if (source === 'multiembed') {
            return isSeries
                ? `https://multiembed.mov/directstream.php?video_id=${movie.id}&tmdb=1&s=${initialSeason}&e=${initialEpisode}`
                : `https://multiembed.mov/directstream.php?video_id=${movie.id}&tmdb=1`;
        } else if (source === 'vidsrc.cc') {
            return isSeries
                ? `https://vidsrc.cc/v2/embed/tv/${movie.id}/${initialSeason}/${initialEpisode}`
                : `https://vidsrc.cc/v2/embed/movie/${movie.id}`;
        } else if (source === 'vidsrc.me') {
            return isSeries
                ? `https://vidsrc.me/embed/tv?tmdb=${movie.id}&season=${initialSeason}&episode=${initialEpisode}`
                : `https://vidsrc.me/embed/movie?tmdb=${movie.id}`;
        }

        return isSeries
            ? `https://${source}/embed/tv/${movie.id}/${initialSeason}/${initialEpisode}`
            : `https://${source}/embed/movie/${movie.id}`;
    }, [source, isSeries, movie.id, initialSeason, initialEpisode, scrapedUrls]);

    const getDirectUrl = useCallback(() => {
        if ((source === 'hdfilmizle' || source === 'yabancidizibox' || source === 'filmizlejet') && scrapedUrls[source]) {
            return scrapedUrls[source];
        }
        return null;
    }, [source, scrapedUrls]);

    const openInNewWindow = useCallback(() => {
        const directUrl = getDirectUrl();
        if (directUrl) {
            window.open(directUrl, '_blank', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
        }
    }, [getDirectUrl]);

    useEffect(() => {
        setIframeError(false);
    }, [source, scrapedUrls]);

    const handleActivity = useCallback(() => {
        setShowControls(true);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        controlsTimeout.current = setTimeout(() => {
            setShowControls(false);
            document.getElementById('video-frame')?.focus();
        }, 4000);
    }, []);

    useEffect(() => {
        saveContinueWatching(movie, initialSeason, initialEpisode, 30);
        handleActivity();

        const handleKeyDown = (e) => {
            handleActivity();
            if (e.key === 'Backspace' || e.key === 'Escape' || e.keyCode === 10009 || e.keyCode === 461) {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('touchstart', handleActivity);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('touchstart', handleActivity);
            if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        };
    }, [onClose, handleActivity, movie, initialSeason, initialEpisode]);

    useEffect(() => {
        if (showControls) document.getElementById('player-back')?.focus();
    }, [showControls]);

    return (
        <div className="player-container">
            <div className={`player-controls ${!showControls ? 'hidden' : ''}`}>
                <div className="player-header">
                    <button
                        id="player-back"
                        tabIndex="0"
                        onClick={onClose}
                        className="focusable glass-button"
                    >
                        <i className="fas fa-arrow-left"></i>
                        <span>ÇIKIŞ</span>
                    </button>

                    <div className="source-selector">
                        {SOURCES.map(s => (
                            <button
                                key={s.id}
                                tabIndex="0"
                                onClick={() => setSource(s.id)}
                                className={`focusable source-btn ${source === s.id ? 'active' : ''}`}
                                style={s.id === 'filmizlejet' ? {
                                    background: 'linear-gradient(135deg, #2196F3 0%, #00BCD4 100%)',
                                    color: '#fff',
                                    fontWeight: '700',
                                    boxShadow: '0 0 15px rgba(33, 150, 243, 0.4)'
                                } : s.id === 'hdfilmizle' ? {
                                    background: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)',
                                    color: '#fff',
                                    fontWeight: '700',
                                    boxShadow: '0 0 15px rgba(233, 30, 99, 0.4)'
                                } : s.id === 'yabancidizibox' ? {
                                    background: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)',
                                    color: '#fff',
                                    fontWeight: '700',
                                    boxShadow: '0 0 15px rgba(255, 81, 47, 0.4)'
                                } : {}}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loadingSource ? (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    color: 'white'
                }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        border: '3px solid rgba(255,255,255,0.2)',
                        borderTop: '3px solid #e91e63',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                    }}></div>
                    <p style={{ fontSize: '16px', opacity: 0.8 }}>
                        Kaynak aranıyor...
                    </p>
                </div>
            ) : getUrl() ? (
                <>
                    <iframe
                        id="video-frame"
                        className="focusable"
                        key={source + (scrapedUrls[source] || '')}
                        src={getUrl()}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        allowFullScreen
                        allow="autoplay; encrypted-media"
                        title="Video Player"
                        onError={() => setIframeError(true)}
                    />
                    {(source === 'hdfilmizle' || source === 'yabancidizibox' || source === 'filmizlejet') && getDirectUrl() && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <p style={{
                                fontSize: '14px',
                                color: 'rgba(255,255,255,0.7)',
                                textAlign: 'center',
                                textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                            }}>
                                Video yüklenmiyor mu?
                            </p>
                            <button
                                onClick={openInNewWindow}
                                className="focusable"
                                style={{
                                    padding: '12px 24px',
                                    background: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 20px rgba(233, 30, 99, 0.4)'
                                }}
                            >
                                <i className="fas fa-external-link-alt"></i>
                                Yeni Pencerede Aç
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    color: 'white'
                }}>
                    <i className="fas fa-exclamation-triangle" style={{ fontSize: '48px', marginBottom: '16px', color: '#ff6b6b' }}></i>
                    <p style={{ fontSize: '16px', opacity: 0.8 }}>Bu kaynak için video bulunamadı</p>
                    <p style={{ fontSize: '14px', opacity: 0.5, marginTop: '8px' }}>Lütfen başka bir kaynak deneyin</p>
                    {(source === 'hdfilmizle' || source === 'yabancidizibox' || source === 'filmizlejet') && getDirectUrl() && (
                        <button
                            onClick={openInNewWindow}
                            className="focusable"
                            style={{
                                marginTop: '20px',
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 20px rgba(233, 30, 99, 0.4)'
                            }}
                        >
                            <i className="fas fa-external-link-alt"></i>
                            Yeni Pencerede Aç
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
