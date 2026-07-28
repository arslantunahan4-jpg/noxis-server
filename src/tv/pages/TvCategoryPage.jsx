import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    appendPage,
    cleanItems,
    mediaTitle,
    mediaType,
    MOVIE_RAILS,
    SERIES_RAILS,
    tvBackdropUrl
} from '../utils/media';
import { TvRail, TvRailSkeleton } from '../components/TvRail';
import { fetchTMDBCached, preloadImage } from '../utils/tmdbCache';
import { isScreenStateFresh, mapWithConcurrency, readScreenState, writeScreenState } from '../utils/screenState';

const TvCategoryPage = ({ type = 'movie' }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const snapshotKey = `category:${type}`;
    const initialSnapshot = useMemo(() => readScreenState(snapshotKey), [snapshotKey]);
    const [sections, setSections] = useState(() => initialSnapshot?.sections || {});
    const [loading, setLoading] = useState(() => !initialSnapshot?.sections?.popular?.length);
    const [loadedAt, setLoadedAt] = useState(() => initialSnapshot?.loadedAt || 0);
    const [railPages, setRailPages] = useState(() => initialSnapshot?.railPages || {});
    const [railHasMore, setRailHasMore] = useState(() => initialSnapshot?.railHasMore || {});
    const [railLoadingMore, setRailLoadingMore] = useState({});
    const rails = useMemo(() => (type === 'tv' ? SERIES_RAILS : MOVIE_RAILS), [type]);

    useEffect(() => {
        let cancelled = false;

        setSections(initialSnapshot?.sections || {});
        setRailPages(initialSnapshot?.railPages || {});
        setRailHasMore(initialSnapshot?.railHasMore || {});
        setRailLoadingMore({});

        const loadRail = async (rail, page = 1, append = false) => {
            const response = await fetchTMDBCached(appendPage(rail.endpoint, page));
            const items = cleanItems(response?.results || []).map((item) => ({
                ...item,
                media_type: type
            }));
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
            const hasUsableSnapshot = Boolean(initialSnapshot?.sections?.[rails[0]?.key]?.length);
            if (hasUsableSnapshot && isScreenStateFresh(initialSnapshot)) {
                setLoading(false);
                return;
            }

            setLoading(!hasUsableSnapshot);
            const [priorityRail, ...restRails] = rails;
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
    }, [initialSnapshot, rails, type]);

    useEffect(() => {
        writeScreenState(snapshotKey, { sections, railPages, railHasMore, loadedAt });
    }, [loadedAt, railHasMore, railPages, sections, snapshotKey]);

    const loadMoreRail = useCallback(async (rail) => {
        if (!rail || railLoadingMore[rail.key] || railHasMore[rail.key] === false) return;

        const nextPage = (railPages[rail.key] || 1) + 1;
        setRailLoadingMore((current) => ({
            ...current,
            [rail.key]: true
        }));

        try {
            const response = await fetchTMDBCached(appendPage(rail.endpoint, nextPage));
            const items = cleanItems(response?.results || []).map((item) => ({
                ...item,
                media_type: type
            }));

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
    }, [railHasMore, railLoadingMore, railPages, type]);

    const openDetail = useCallback((item) => {
        const nextType = mediaType(item, type);
        navigate(`/watch/${nextType}/${item.id}`, {
            state: {
                from: `${location.pathname}${location.search}`,
                preview: { ...item, media_type: nextType }
            }
        });
    }, [location.pathname, location.search, navigate, type]);

    const hero = useMemo(() => {
        const pool = rails.flatMap((rail) => sections[rail.key] || []);
        const cleaned = cleanItems(pool);
        return cleaned.find((item) => item.backdrop_path && (item.vote_count || 0) > 200) || cleaned[0] || null;
    }, [rails, sections]);
    const heroImage = tvBackdropUrl(hero?.backdrop_path || hero?.poster_path);

    useEffect(() => {
        preloadImage(heroImage);
    }, [heroImage]);

    return (
        <motion.div
            className="tv-screen tv-category-page"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
            <section className="tv-category-hero">
                <div className="tv-category-bg" style={{ backgroundImage: heroImage ? `url("${heroImage}")` : undefined }} />
                <div className="tv-category-fade" />
                <div className="tv-category-copy">
                    <span className="tv-kicker">Noxis koleksiyonu</span>
                    <h1>{type === 'tv' ? 'Diziler' : 'Filmler'}</h1>
                    <p>
                        {type === 'tv'
                            ? 'Yeni bölümler, güçlü hikayeler ve uzun geceler.'
                            : 'Büyük perdeden kalan his, TV ekranında devam ediyor.'}
                    </p>
                    {hero && (
                        <div className="tv-hero-actions" data-tv-focus-group={`tv-category-actions-${type}`} data-tv-focus-axis="horizontal">
                        <button
                            type="button"
                            className="focusable tv-action tv-action-primary"
                            data-tv-autofocus="true"
                            data-focus-id={`tv-category-feature-${type}`}
                            data-tv-focus-index="0"
                            onClick={() => openDetail(hero)}
                        >
                            <i className="fas fa-play" />
                            <span>{mediaTitle(hero)}</span>
                        </button>
                        </div>
                    )}
                </div>
            </section>

            <div className="tv-rail-stack tv-category-rails">
                {loading && <TvRailSkeleton title="Koleksiyon yükleniyor" layout="landscape" />}
                {rails.map((rail) => (
                    <TvRail
                        key={rail.key}
                        title={rail.title}
                        items={sections[rail.key] || []}
                        layout={rail.layout}
                        rowKey={`${type}-${rail.key}`}
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

export default TvCategoryPage;
