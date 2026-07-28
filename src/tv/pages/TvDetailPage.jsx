import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TvRail } from '../components/TvRail';
import {
    cleanItems,
    imageUrl,
    mediaTitle,
    mediaYear,
    ratingText,
    runtimeText,
    tvBackdropUrl
} from '../utils/media';
import { fetchTMDBCached, preloadImage } from '../utils/tmdbCache';
import { friendsService } from '../../utils/friendsService';

const pageVariants = {
    initial: { opacity: 0, scale: 1.006 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.996 }
};

const TvDetailPage = () => {
    const { type, id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const routePreview = useMemo(() => {
        const preview = location.state?.preview;
        return preview && String(preview.id) === String(id)
            ? { ...preview, media_type: type }
            : null;
    }, [id, location.state?.preview, type]);
    const [movie, setMovie] = useState(routePreview);
    const [loading, setLoading] = useState(!routePreview);
    const [detailError, setDetailError] = useState(null);
    const [detailRetry, setDetailRetry] = useState(0);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [episodes, setEpisodes] = useState([]);
    const [episodesLoading, setEpisodesLoading] = useState(false);

    // Social recommend state
    const [showRecommendModal, setShowRecommendModal] = useState(false);
    const [friends, setFriends] = useState([]);
    const [recommendMsg, setRecommendMsg] = useState('');

    // Watchlist state
    const [showWatchlistModal, setShowWatchlistModal] = useState(false);
    const [watchlists, setWatchlists] = useState([]);

    const autoPlay = searchParams.get('autoplay') === '1';
    const autoSeason = Number(searchParams.get('s') || 1);
    const autoEpisode = Number(searchParams.get('e') || 1);
    const returnPath = location.state?.from || '/';
    const isSeries = type === 'tv';

    useEffect(() => {
        if (autoPlay && type && id) {
            navigate(`/play/${type}/${id}?s=${autoSeason}&e=${autoEpisode}`, {
                replace: true,
                state: { from: returnPath, preview: routePreview }
            });
        }
    }, [autoEpisode, autoPlay, autoSeason, id, navigate, returnPath, routePreview, type]);

    useEffect(() => {
        let cancelled = false;

        const loadDetail = async () => {
            setMovie(routePreview);
            setLoading(!routePreview);
            setDetailError(null);
            const response = await fetchTMDBCached(
                `/${type}/${id}?append_to_response=credits,recommendations,similar,videos,external_ids&include_video_language=tr,en`,
                { force: detailRetry > 0 }
            );
            if (!cancelled && response) {
                setMovie({ ...response, media_type: type });
                const firstSeason = response.seasons?.find((season) => season.season_number > 0)?.season_number || 1;
                setSelectedSeason(firstSeason);
            } else if (!cancelled && !routePreview) {
                setDetailError('İçerik bilgileri alınamadı.');
            }
            if (!cancelled) setLoading(false);
        };

        if (type && id && !autoPlay) {
            loadDetail();
        }

        return () => {
            cancelled = true;
        };
    }, [autoPlay, detailRetry, id, routePreview, type]);

    useEffect(() => {
        if (!isSeries || !id || autoPlay) return;
        let cancelled = false;

        const loadEpisodes = async () => {
            setEpisodesLoading(true);
            const response = await fetchTMDBCached(`/tv/${id}/season/${selectedSeason}`);
            if (!cancelled) {
                setEpisodes(response?.episodes || []);
                setEpisodesLoading(false);
            }
        };

        loadEpisodes();
        return () => {
            cancelled = true;
        };
    }, [autoPlay, id, isSeries, selectedSeason]);

    const seasons = useMemo(() => (
        (movie?.seasons || [])
            .filter((season) => season.season_number > 0)
            .map((season) => ({
                number: season.season_number,
                name: season.name || `${season.season_number}. Sezon`,
                count: season.episode_count
            }))
    ), [movie?.seasons]);

    const similar = useMemo(() => {
        const recs = movie?.recommendations?.results || [];
        const sims = movie?.similar?.results || [];
        const scoreMap = new Map();

        recs.forEach((item) => {
            if (!item || !item.id) return;
            const votes = Number(item.vote_count || 0);
            const rating = Number(item.vote_average || 0);
            const pop = Number(item.popularity || 0);
            const score = 1000 + (rating * 100) + Math.min(votes, 10000) * 0.12 + (pop * 2);
            scoreMap.set(`${item.id}`, { item, score });
        });

        sims.forEach((item) => {
            if (!item || !item.id) return;
            const key = `${item.id}`;
            const votes = Number(item.vote_count || 0);
            const rating = Number(item.vote_average || 0);
            const pop = Number(item.popularity || 0);
            if (votes < 80 && pop < 15) return;
            const score = 200 + (rating * 80) + Math.min(votes, 10000) * 0.1 + (pop * 1.5);

            if (scoreMap.has(key)) {
                const existing = scoreMap.get(key);
                scoreMap.set(key, { ...existing, score: existing.score + 350 });
            } else {
                scoreMap.set(key, { item, score });
            }
        });

        const ranked = Array.from(scoreMap.values())
            .sort((a, b) => b.score - a.score)
            .map((entry) => entry.item);

        return cleanItems(ranked).slice(0, 20);
    }, [movie?.recommendations?.results, movie?.similar?.results]);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const cast = (movie?.credits?.cast || []).slice(0, 6);
    const title = mediaTitle(movie || {});
    const overview = movie?.overview || 'Bu içerik için açıklama bilgisi bulunmuyor.';
    const overviewDensity = overview.length > 520 ? 'long' : overview.length > 360 ? 'medium' : 'compact';
    const backdrop = tvBackdropUrl(movie?.backdrop_path || movie?.poster_path);
    const poster = imageUrl(movie?.poster_path || movie?.backdrop_path, 'w500');
    const rating = ratingText(movie || {});
    const runtime = isSeries ? null : runtimeText(movie?.runtime);
    const genres = movie?.genres || [];

    useEffect(() => {
        preloadImage(backdrop);
        preloadImage(poster);
    }, [backdrop, poster]);

    const goBack = useCallback((event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const fromPath = location.state?.from;
        if (fromPath && fromPath !== location.pathname) {
            navigate(fromPath, { replace: true });
        } else if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/', { replace: true });
        }
    }, [location.pathname, location.state?.from, navigate]);

    const play = (season = selectedSeason, episode = 1) => {
        navigate(`/play/${type}/${id}?s=${season || 1}&e=${episode || 1}`, {
            state: {
                from: `${location.pathname}${location.search}`,
                detailFrom: returnPath,
                preview: movie
            }
        });
    };

    const openSimilar = (item) => {
        const nextType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        navigate(`/watch/${nextType}/${item.id}`, {
            state: {
                from: `${location.pathname}${location.search}`,
                preview: item
            }
        });
    };

    const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);

    const handleEpisodeWheel = useCallback((event) => {
        if (event.deltaY !== 0) {
            event.currentTarget.scrollLeft += event.deltaY * 1.5;
        }
    }, []);

    const handleEpisodeFocus = useCallback((event) => {
        event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, []);

    if (loading && !movie) {
        return (
            <div className="tv-screen tv-detail-loading">
                <i className="fas fa-circle-notch fa-spin" />
            </div>
        );
    }

    if (!movie) {
        return (
            <div className="tv-screen tv-empty-state">
                <i className="fas fa-triangle-exclamation" />
                <h1>{detailError || 'İçerik bulunamadı'}</h1>
                <div data-tv-focus-group="tv-detail-error-actions" data-tv-focus-axis="horizontal">
                    <button
                        type="button"
                        className="focusable tv-action tv-action-primary"
                        data-tv-autofocus="true"
                        data-focus-id="tv-detail-retry"
                        data-tv-focus-index="0"
                        onClick={() => setDetailRetry(value => value + 1)}
                    >
                        <i className="fas fa-rotate-right" />
                        <span>Tekrar dene</span>
                    </button>
                    <button
                        type="button"
                        className="focusable tv-action tv-action-secondary"
                        data-focus-id="tv-detail-error-back"
                        data-tv-focus-index="1"
                        onClick={goBack}
                        onPointerDown={goBack}
                    >
                        <i className="fas fa-arrow-left" />
                        <span>Geri</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            className="tv-screen tv-detail-page"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="tv-detail-backdrop" style={{ backgroundImage: backdrop ? `url("${backdrop}")` : undefined }} />
            <div className="tv-detail-vignette" />

            <button
                type="button"
                className="focusable tv-back-pill"
                data-focus-id="tv-detail-back"
                data-tv-focus-group="tv-detail-back-group"
                data-tv-focus-axis="horizontal"
                data-tv-focus-index="0"
                onClick={goBack}
                onPointerDown={goBack}
            >
                <i className="fas fa-arrow-left" />
                <span>Geri</span>
            </button>

            <section className="tv-detail-hero">
                <motion.div
                    className="tv-detail-poster"
                    layoutId={`tv-poster-${type}-${id}`}
                    initial={{ opacity: 0, x: -36, rotateY: 9 }}
                    animate={{ opacity: 1, x: 0, rotateY: 0 }}
                    transition={{ duration: 0.24, delay: 0.03 }}
                >
                    {poster ? <img src={poster} alt="" /> : <i className="fas fa-film" />}
                </motion.div>

                <motion.div
                    className="tv-detail-copy"
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, delay: 0.05 }}
                >
                    <span className="tv-kicker">{isSeries ? 'Noxis dizi' : 'Noxis film'}</span>
                    <h1>{title}</h1>
                    <div className="tv-detail-meta">
                        {mediaYear(movie) && <span>{mediaYear(movie)}</span>}
                        <span>{isSeries ? 'Dizi' : 'Film'}</span>
                        {rating && (
                            <span>
                                <i className="fas fa-star" /> {rating}
                            </span>
                        )}
                        {runtime && <span>{runtime}</span>}
                        {isSeries && seasons.length > 0 && <span>{seasons.length} sezon</span>}
                    </div>
                    <div className="tv-detail-overview-container">
                        <p className={`tv-detail-overview ${overviewDensity} ${isOverviewExpanded ? 'expanded' : 'clamped'}`}>
                            {overview}
                        </p>
                        {isMobile && overview && overview.length > 170 && (
                            <button
                                type="button"
                                className="tv-overview-toggle-btn"
                                onClick={() => setIsOverviewExpanded((prev) => !prev)}
                            >
                                <span>{isOverviewExpanded ? 'Daha az göster' : 'Devamını oku'}</span>
                                <i className={`fas fa-chevron-${isOverviewExpanded ? 'up' : 'down'}`} />
                            </button>
                        )}
                    </div>

                    {genres.length > 0 && (
                        <div className="tv-genre-row">
                            {genres.slice(0, 5).map((genre) => (
                                <span key={genre.id}>{genre.name}</span>
                            ))}
                        </div>
                    )}

                    <div className="tv-detail-actions" data-tv-focus-group="tv-detail-actions" data-tv-focus-axis="horizontal">
                        <button
                            type="button"
                            className="focusable tv-action tv-action-primary"
                            data-tv-autofocus="true"
                            data-focus-id="tv-detail-play"
                            data-tv-focus-index="0"
                            onClick={() => play(isSeries ? selectedSeason : 1, 1)}
                        >
                            <i className="fas fa-play" />
                            <span>{isSeries ? `${selectedSeason}. Sezonu Oynat` : 'Oynat'}</span>
                        </button>
                        <button
                            type="button"
                            className="focusable tv-action tv-action-secondary"
                            data-focus-id="tv-detail-back-secondary"
                            data-tv-focus-index="1"
                            onClick={goBack}
                        >
                            <i className="fas fa-layer-group" />
                            <span>Listeye Dön</span>
                        </button>
                        <button
                            type="button"
                            className="focusable tv-action tv-action-secondary"
                            data-focus-id="tv-detail-recommend"
                            data-tv-focus-index="2"
                            onClick={() => {
                                setShowRecommendModal(true);
                                friendsService.getFriendsList().then(res => setFriends(res.friends || []));
                            }}
                        >
                            <i className="fas fa-paper-plane" />
                            <span>Arkadaşına Öner</span>
                        </button>
                        <button
                            type="button"
                            className="focusable tv-action tv-action-secondary"
                            data-focus-id="tv-detail-add-list"
                            data-tv-focus-index="3"
                            onClick={() => {
                                setShowWatchlistModal(true);
                                friendsService.getWatchlists().then(res => setWatchlists(res.watchlists || []));
                            }}
                        >
                            <i className="fas fa-plus" />
                            <span>Listeye Ekle</span>
                        </button>
                    </div>

                    {showRecommendModal && (
                        <div className="tv-recommend-overlay" onClick={() => setShowRecommendModal(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="tv-recommend-modal" onClick={e => e.stopPropagation()} style={{ background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(20px)', padding: '30px', borderRadius: '24px', width: '400px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <h2 style={{ margin: '0 0 20px', fontSize: '24px' }}>Kime Öneriyorsun?</h2>
                                <input type="text" placeholder="İsteğe bağlı bir not ekle..." value={recommendMsg} onChange={e => setRecommendMsg(e.target.value)} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '12px', color: '#fff', marginBottom: '20px' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                                    {friends.map(f => (
                                        <button key={f._id} onClick={async () => {
                                            await friendsService.sendRecommendation({
                                                recipientId: f._id,
                                                tmdbId: id,
                                                mediaType: type,
                                                title: mediaTitle(movie),
                                                posterPath: movie?.poster_path,
                                                message: recommendMsg
                                            });
                                            setShowRecommendModal(false);
                                            setRecommendMsg('');
                                        }} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.05)', padding: '10px 15px', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e50914', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{f.username.charAt(0).toUpperCase()}</div>
                                            <span style={{ fontSize: '18px' }}>{f.username}</span>
                                        </button>
                                    ))}
                                    {friends.length === 0 && <span style={{ color: 'rgba(255,255,255,0.5)' }}>Arkadaşın bulunmuyor.</span>}
                                </div>
                            </div>
                        </div>
                    )}

                    {showWatchlistModal && (
                        <div className="tv-recommend-overlay" onClick={() => setShowWatchlistModal(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="tv-recommend-modal" onClick={e => e.stopPropagation()} style={{ background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(20px)', padding: '30px', borderRadius: '24px', width: '400px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <h2 style={{ margin: '0 0 20px', fontSize: '24px' }}>Hangi Listeye Eklensin?</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                                    {watchlists.map(list => (
                                        <button key={list._id} onClick={async () => {
                                            await friendsService.addToWatchlist(list._id, {
                                                tmdbId: String(id),
                                                mediaType: type,
                                                title: mediaTitle(movie),
                                                posterPath: movie?.poster_path,
                                                backdropPath: movie?.backdrop_path
                                            });
                                            setShowWatchlistModal(false);
                                        }} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.05)', padding: '15px', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{list.title}</h4>
                                                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{list.items.length} içerik</span>
                                            </div>
                                            <i className="fas fa-plus" style={{ color: '#e50914' }} />
                                        </button>
                                    ))}
                                    {watchlists.length === 0 && <span style={{ color: 'rgba(255,255,255,0.5)' }}>Henüz hiçbir ortak listeniz yok.</span>}
                                </div>
                            </div>
                        </div>
                    )}

                    {cast.length > 0 && (
                        <div className="tv-cast-line">
                            <span>Oyuncular</span>
                            <strong>{cast.map((person) => person.name).join(', ')}</strong>
                        </div>
                    )}
                </motion.div>
            </section>

            {isSeries && seasons.length > 0 && (
                <section className="tv-season-panel">
                    <div className="tv-season-heading">
                        <div>
                            <span className="tv-rail-eyebrow">Bölümler</span>
                            <h2>Sezon Seç</h2>
                        </div>
                        {episodesLoading && <i className="fas fa-circle-notch fa-spin" />}
                    </div>

                    <div className="tv-season-tabs" data-tv-focus-group={`tv-seasons-${id}`} data-tv-focus-axis="horizontal">
                        {seasons.map((season) => (
                            <button
                                key={season.number}
                                type="button"
                                className={`focusable tv-season-tab ${selectedSeason === season.number ? 'active' : ''}`}
                                data-focus-id={`tv-season-${season.number}`}
                                data-tv-focus-index={season.number}
                                onClick={() => setSelectedSeason(season.number)}
                            >
                                <strong>{season.number}. Sezon</strong>
                                {season.count ? <span>{season.count} bölüm</span> : null}
                            </button>
                        ))}
                    </div>

                    <div
                        className="tv-episode-strip"
                        data-tv-focus-group={`tv-episodes-${id}-${selectedSeason}`}
                        data-tv-focus-axis="horizontal"
                        onWheel={handleEpisodeWheel}
                    >
                        {episodes.map((episode) => (
                            <button
                                key={episode.id || episode.episode_number}
                                type="button"
                                className="focusable tv-episode-card"
                                data-focus-id={`tv-episode-${selectedSeason}-${episode.episode_number}`}
                                data-tv-focus-index={episode.episode_number}
                                onClick={() => play(selectedSeason, episode.episode_number)}
                                onFocus={handleEpisodeFocus}
                            >
                                <span className="tv-episode-image">
                                    {episode.still_path ? (
                                        <img src={imageUrl(episode.still_path, 'w500')} alt="" loading="lazy" />
                                    ) : (
                                        <i className="fas fa-play" />
                                    )}
                                    <span>
                                        <i className="fas fa-play" />
                                    </span>
                                </span>
                                <span className="tv-episode-copy">
                                    <strong>{episode.episode_number}. {episode.name || 'Bölüm'}</strong>
                                    <small>{episode.overview || 'Özet bilgisi bulunmuyor.'}</small>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {similar.length > 0 && (
                <div className="tv-detail-rails">
                    <TvRail
                        title="Benzer İçerikler"
                        items={similar}
                        layout="landscape"
                        rowKey={`similar-${type}-${id}`}
                        onSelect={openSimilar}
                    />
                </div>
            )}
        </motion.div>
    );
};

export default TvDetailPage;
