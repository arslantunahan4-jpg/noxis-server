import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSmartRecommendations } from '../../hooks/useSmartRecommendations';
import { getContinueWatching, syncFromBackend } from '../../utils/watchHistory';
import {
    appendPage,
    cleanItems,
    HOME_RAILS,
    imageUrl,
    mediaTitle,
    mediaType,
    mediaYear,
    ratingText,
    tvBackdropUrl
} from '../utils/media';
import { TvRail, TvRailSkeleton } from '../components/TvRail';
import { TvSpotlightBanner } from '../components/TvSpotlightBanner';
import { fetchTMDBCached, preloadImages } from '../utils/tmdbCache';
import { isScreenStateFresh, mapWithConcurrency, readScreenState, writeScreenState } from '../utils/screenState';

const pageVariants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 }
};

const HeroMeta = ({ item }) => (
    <div className="tv-hero-meta">
        {mediaYear(item) && <span>{mediaYear(item)}</span>}
        <span>{mediaType(item) === 'tv' ? 'Dizi' : 'Film'}</span>
        {ratingText(item) && (
            <span>
                <i className="fas fa-star" /> {ratingText(item)}
            </span>
        )}
        <span>HD</span>
    </div>
);

const TvHero = ({ item, allItems, activeIndex, onSelect, onPlay, onPick }) => {
    if (!item) {
        return <section className="tv-hero-native tv-hero-loading" />;
    }

    const title = mediaTitle(item);
    const backdrop = tvBackdropUrl(item.backdrop_path || item.poster_path);
    const poster = imageUrl(item.poster_path || item.backdrop_path, 'w500');

    return (
        <section className="tv-hero-native">
            <AnimatePresence initial={false}>
                <motion.div
                    key={`${mediaType(item)}-${item.id}`}
                    className="tv-hero-bg"
                    initial={{ opacity: 0, scale: 1.012 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.004 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    style={{ backgroundImage: backdrop ? `url("${backdrop}")` : undefined }}
                />
            </AnimatePresence>

            <div className="tv-hero-vignette" />
            <div className="tv-hero-bottom-fade" />

            <motion.div
                className="tv-hero-copy-native"
                key={`copy-${item.id}`}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.24, delay: 0.04 }}
            >
                <div className="tv-hero-mobile-poster">
                    {poster ? <img src={poster} alt="" /> : null}
                </div>
                <span className="tv-kicker">Noxis seçkisi</span>
                <h1>{title}</h1>
                <HeroMeta item={item} />
                <p>{item.overview || 'Bu içerik için açıklama bilgisi bulunmuyor.'}</p>
                <div className="tv-hero-actions" data-tv-focus-group="tv-home-hero-actions" data-tv-focus-axis="horizontal">
                    <button
                        type="button"
                        className="focusable tv-action tv-action-primary"
                        data-tv-autofocus="true"
                        data-focus-id="tv-home-play"
                        data-tv-focus-index="0"
                        onClick={() => onPlay(item)}
                    >
                        <i className="fas fa-play" />
                        <span>Oynat</span>
                    </button>
                    <button
                        type="button"
                        className="focusable tv-action tv-action-secondary"
                        data-focus-id="tv-home-detail"
                        data-tv-focus-index="1"
                        onClick={() => onSelect(item)}
                    >
                        <i className="fas fa-info-circle" />
                        <span>Detaylar</span>
                    </button>
                </div>
            </motion.div>

            <motion.div
                className="tv-hero-feature-card"
                initial={{ opacity: 0, x: 40, rotateY: -8 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                transition={{ duration: 0.26, delay: 0.06 }}
            >
                {poster && <img src={poster} alt="" />}
                <div>
                    <span>Şimdi öne çıkan</span>
                    <strong>{title}</strong>
                </div>
            </motion.div>

            <div
                className="tv-hero-switcher"
                aria-label="Öne çıkan içerikler"
                data-tv-focus-group="tv-home-hero-switcher"
                data-tv-focus-axis="horizontal"
            >
                {allItems.slice(0, 6).map((candidate, index) => (
                    <button
                        key={`${mediaType(candidate)}-${candidate.id}`}
                        type="button"
                        className={`focusable tv-hero-dot ${index === activeIndex ? 'active' : ''}`}
                        data-focus-id={`tv-hero-dot-${index}`}
                        data-tv-focus-index={index}
                        onClick={() => onPick(index)}
                        aria-label={`${index + 1}. öne çıkan içerik`}
                    />
                ))}
            </div>
        </section>
    );
};

const TvHomePage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const initialSnapshot = useMemo(() => readScreenState('home'), []);
    const [sections, setSections] = useState(() => initialSnapshot?.sections || {});
    const [continueItems, setContinueItems] = useState(() => initialSnapshot?.continueItems || []);
    const [heroIndex, setHeroIndex] = useState(() => initialSnapshot?.heroIndex || 0);
    const [loading, setLoading] = useState(() => !initialSnapshot?.sections?.trending?.length);
    const [loadedAt, setLoadedAt] = useState(() => initialSnapshot?.loadedAt || 0);
    const [railPages, setRailPages] = useState(() => initialSnapshot?.railPages || {});
    const [railHasMore, setRailHasMore] = useState(() => initialSnapshot?.railHasMore || {});
    const [railLoadingMore, setRailLoadingMore] = useState({});
    const smartRecs = useSmartRecommendations(!loading);

    useEffect(() => {
        let cancelled = false;
        const syncHistory = async () => {
            await syncFromBackend();
            if (!cancelled) {
                setContinueItems(getContinueWatching());
            }
        };
        syncHistory();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadRail = async (rail, page = 1, append = false) => {
            const response = await fetchTMDBCached(appendPage(rail.endpoint, page));
            const items = cleanItems(response?.results || []);
            if (!cancelled) {
                setSections((current) => ({
                    ...current,
                    [rail.key]: append ? cleanItems([...(current[rail.key] || []), ...items]) : items
                }));
                setRailPages((current) => ({
                    ...current,
                    [rail.key]: page
                }));
                setRailHasMore((current) => ({
                    ...current,
                    [rail.key]: Boolean(items.length && (response?.total_pages ? page < response.total_pages : items.length >= 20))
                }));
            }
            return items;
        };

        const load = async () => {
            const hasUsableSnapshot = Boolean(initialSnapshot?.sections?.trending?.length);
            if (hasUsableSnapshot && isScreenStateFresh(initialSnapshot)) {
                setLoading(false);
                return;
            }

            setLoading(!hasUsableSnapshot);

            const [priorityRail, ...restRails] = HOME_RAILS;
            await loadRail(priorityRail).catch(() => null);
            if (!cancelled) setLoading(false);

            await mapWithConcurrency(restRails, 2, loadRail);
            if (!cancelled) {
                setLoadedAt(Date.now());
                setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [initialSnapshot]);

    useEffect(() => {
        writeScreenState('home', {
            sections,
            continueItems,
            heroIndex,
            railPages,
            railHasMore,
            loadedAt
        });
    }, [continueItems, heroIndex, loadedAt, railHasMore, railPages, sections]);

    const loadMoreRail = useCallback(async (rail) => {
        if (!rail || railLoadingMore[rail.key] || railHasMore[rail.key] === false) return;

        const nextPage = (railPages[rail.key] || 1) + 1;
        setRailLoadingMore((current) => ({
            ...current,
            [rail.key]: true
        }));

        try {
            const response = await fetchTMDBCached(appendPage(rail.endpoint, nextPage));
            const items = cleanItems(response?.results || []);

            setSections((current) => ({
                ...current,
                [rail.key]: cleanItems([...(current[rail.key] || []), ...items])
            }));
            setRailPages((current) => ({
                ...current,
                [rail.key]: nextPage
            }));
            setRailHasMore((current) => ({
                ...current,
                [rail.key]: Boolean(items.length && (response?.total_pages ? nextPage < response.total_pages : items.length >= 20))
            }));
        } finally {
            setRailLoadingMore((current) => ({
                ...current,
                [rail.key]: false
            }));
        }
    }, [railHasMore, railLoadingMore, railPages]);

    useEffect(() => {
        const refreshContinue = () => setContinueItems(cleanItems(getContinueWatching()));
        refreshContinue();
        window.addEventListener('focus', refreshContinue);
        window.addEventListener('noxis-history-updated', refreshContinue);
        return () => {
            window.removeEventListener('focus', refreshContinue);
            window.removeEventListener('noxis-history-updated', refreshContinue);
        };
    }, []);

    const heroItems = useMemo(() => {
        const base = sections.trending?.length ? sections.trending : sections.popularMovies || [];
        return cleanItems(base).slice(0, 6);
    }, [sections]);

    const heroItem = heroItems[heroIndex % Math.max(heroItems.length, 1)];

    useEffect(() => {
        if (!heroItems.length) return;
        const current = heroIndex % heroItems.length;
        const candidates = [heroItems[current], heroItems[(current + 1) % heroItems.length]];
        preloadImages(candidates.map((item) => tvBackdropUrl(item.backdrop_path || item.poster_path)), 2);
    }, [heroIndex, heroItems]);

    useEffect(() => {
        if (heroItems.length < 2) return;
        const timer = window.setInterval(() => {
            setHeroIndex((value) => (value + 1) % heroItems.length);
        }, 9000);
        return () => window.clearInterval(timer);
    }, [heroItems.length]);

    const openDetail = useCallback((item) => {
        const type = mediaType(item);
        navigate(`/watch/${type}/${item.id}`, {
            state: {
                from: `${location.pathname}${location.search}`,
                preview: item
            }
        });
    }, [location.pathname, location.search, navigate]);

    const openPlayer = useCallback((item) => {
        const type = mediaType(item);
        const season = item.season || 1;
        const episode = item.episode || 1;
        navigate(`/play/${type}/${item.id}?s=${season}&e=${episode}`, {
            state: { from: `${location.pathname}${location.search}` }
        });
    }, [location.pathname, location.search, navigate]);

    const openContinue = useCallback((item) => {
        const type = mediaType(item);
        const season = item.season || 1;
        const episode = item.episode || 1;
        navigate(`/play/${type}/${item.id}?s=${season}&e=${episode}`, {
            state: {
                from: `${location.pathname}${location.search}`,
                preview: item
            }
        });
    }, [location.pathname, location.search, navigate]);

    return (
        <motion.div
            className="tv-screen tv-home-page"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
            <TvHero
                item={heroItem}
                allItems={heroItems}
                activeIndex={heroIndex}
                onSelect={openDetail}
                onPlay={openPlayer}
                onPick={setHeroIndex}
            />

            <div className="tv-rail-stack">
                {continueItems.length > 0 && (
                    <TvRail
                        title="Kaldığın Yerden Devam Et"
                        items={continueItems}
                        layout="landscape"
                        rowKey="continue"
                        onSelect={openContinue}
                        eyebrow="Hemen devam"
                    />
                )}

                {/* DEDICATED TOP 10 LIST (Strictly Top 10 items with giant rank numbers #1 to #10) */}
                {(sections.trending || []).length > 0 && (
                    <TvRail
                        title="Bugünün Top 10 Listesi"
                        eyebrow="En çok izlenen 10 içerik"
                        items={(sections.trending || []).slice(0, 10)}
                        layout="portrait"
                        rowKey="top10"
                        isTop10={true}
                        onSelect={openDetail}
                    />
                )}

                {/* CINEMATIC SPOTLIGHT BANNER #1 */}
                {sections.popularMovies?.[0] && (
                    <TvSpotlightBanner
                        item={sections.popularMovies[0]}
                        eyebrow="Haftanın Öne Çıkan Filmi"
                        onSelect={openDetail}
                    />
                )}

                {!smartRecs.loading && smartRecs.topPicks?.data?.length > 0 && (
                    <TvRail
                        title={smartRecs.topPicks.title}
                        items={cleanItems(smartRecs.topPicks.data)}
                        layout="portrait"
                        rowKey="smart-top"
                        onSelect={openDetail}
                        eyebrow="Sana göre"
                    />
                )}

                {!smartRecs.loading && smartRecs.becauseYouWatched?.data?.length > 0 && (
                    <TvRail
                        title={smartRecs.becauseYouWatched.title}
                        items={cleanItems(smartRecs.becauseYouWatched.data)}
                        layout="landscape"
                        rowKey="smart-because"
                        onSelect={openDetail}
                    />
                )}

                {/* CINEMATIC SPOTLIGHT BANNER #2 */}
                {sections.popularTV?.[0] && (
                    <TvSpotlightBanner
                        item={sections.popularTV[0]}
                        eyebrow="Öne Çıkan Dizi Seçkisi"
                        onSelect={openDetail}
                    />
                )}

                {!smartRecs.loading && smartRecs.genreBased?.data?.length > 0 && (
                    <TvRail
                        title={smartRecs.genreBased.title}
                        items={cleanItems(smartRecs.genreBased.data)}
                        layout="portrait"
                        rowKey="smart-genre"
                        onSelect={openDetail}
                    />
                )}

                {loading && <TvRailSkeleton title="Seçkiler hazırlanıyor" layout="landscape" />}

                {HOME_RAILS.map((rail) => (
                    <TvRail
                        key={rail.key}
                        title={rail.title}
                        items={sections[rail.key] || []}
                        layout={rail.layout}
                        rowKey={rail.key}
                        onSelect={openDetail}
                        canLoadMore={railHasMore[rail.key] !== false}
                        loadingMore={Boolean(railLoadingMore[rail.key])}
                        onLoadMore={() => loadMoreRail(rail)}
                    />
                ))}
            </div>
        </motion.div>
    );
};

export default TvHomePage;
