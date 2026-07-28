import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { appendPage, cleanItems, mediaTitle, mediaType, tvBackdropUrl } from '../utils/media';
import { TvCard, TvLoadMoreCard } from '../components/TvRail';
import { fetchTMDBCached, preloadImage } from '../utils/tmdbCache';
import { isScreenStateFresh, readScreenState, writeScreenState } from '../utils/screenState';

const TYPE_FILTERS = [
    { id: 'multi', label: 'Tümü' },
    { id: 'movie', label: 'Filmler' },
    { id: 'tv', label: 'Diziler' }
];

const GENRE_FILTERS = [
    { id: 'all', label: 'Tüm Türler' },
    { id: '28', label: 'Aksiyon' },
    { id: '80', label: 'Suç' },
    { id: '18', label: 'Dram' },
    { id: '878', label: 'Bilim Kurgu' },
    { id: '35', label: 'Komedi' },
    { id: '27', label: 'Korku' },
    { id: '53', label: 'Gerilim' },
    { id: '10749', label: 'Romantik' }
];

const RATING_FILTERS = [
    { id: '0', label: 'Tüm Puanlar' },
    { id: '8', label: '★ 8.0+' },
    { id: '7', label: '★ 7.0+' },
    { id: '6', label: '★ 6.0+' }
];

const SORT_FILTERS = [
    { id: 'pop', label: 'En Popüler' },
    { id: 'rating', label: 'En Yüksek Puanlı' },
    { id: 'year', label: 'En Yeni' }
];

// Map genre names (Turkish & English) to TMDB Genre IDs
const GENRE_NAME_TO_ID = {
    'aksiyon': 28,
    'action': 28,
    'macera': 12,
    'adventure': 12,
    'animasyon': 16,
    'animation': 16,
    'komedi': 35,
    'comedy': 35,
    'suç': 80,
    'crime': 80,
    'belgesel': 99,
    'documentary': 99,
    'dram': 18,
    'drama': 18,
    'aile': 10751,
    'family': 10751,
    'fantastik': 14,
    'fantasy': 14,
    'tarih': 36,
    'history': 36,
    'korku': 27,
    'horror': 27,
    'müzik': 10402,
    'music': 10402,
    'gizem': 9648,
    'mystery': 9648,
    'romantik': 10749,
    'romance': 10749,
    'bilim kurgu': 878,
    'sci-fi': 878,
    'scifi': 878,
    'gerilim': 53,
    'thriller': 53,
    'savaş': 10752,
    'war': 10752,
    'vahşi batı': 37,
    'western': 37
};

// Smart Mood Search Chips
const SMART_MOOD_CHIPS = [
    { id: '28', label: '🔥 Alev Alev Aksiyon', genreId: '28', query: 'Aksiyon' },
    { id: '9648', label: '🧠 Beyin Yakan', genreId: '9648', query: 'Gizem' },
    { id: '35', label: '😂 Kahkaha Garanti', genreId: '35', query: 'Komedi' },
    { id: '27', label: '🌙 3 AM Korkusu', genreId: '27', query: 'Korku' },
    { id: '878', label: '🚀 Uzay & Gelecek', genreId: '878', query: 'Bilim Kurgu' }
];

const TvSearchPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const initialSnapshot = useMemo(() => readScreenState('search'), []);
    const canReuseInitialSnapshotRef = useRef(true);
    const [query, setQuery] = useState(() => initialSnapshot?.query || '');
    const [filter, setFilter] = useState(() => initialSnapshot?.filter || 'multi');
    const [genreFilter, setGenreFilter] = useState('all');
    const [ratingFilter, setRatingFilter] = useState('0');
    const [sortFilter, setSortFilter] = useState('pop');
    const [results, setResults] = useState(() => initialSnapshot?.results || []);
    const [loading, setLoading] = useState(() => !initialSnapshot?.results?.length);
    const [heroBackdrop, setHeroBackdrop] = useState(() => initialSnapshot?.heroBackdrop || '');
    const [page, setPage] = useState(() => initialSnapshot?.page || 1);
    const [hasMore, setHasMore] = useState(() => initialSnapshot?.hasMore || false);
    const [loadedAt, setLoadedAt] = useState(() => initialSnapshot?.loadedAt || 0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // Smart Endpoint Resolution: Genre vs Title Search
    const endpoint = useMemo(() => {
        const trimmed = query.trim().toLowerCase();

        // 1. Check if the search query matches a known Genre Name (e.g. "Aksiyon", "Komedi", "Korku")
        const matchedGenreId = GENRE_NAME_TO_ID[trimmed];
        if (matchedGenreId) {
            if (filter === 'tv') return `/discover/tv?with_genres=${matchedGenreId}&sort_by=popularity.desc`;
            return `/discover/movie?with_genres=${matchedGenreId}&sort_by=popularity.desc`;
        }

        // 2. Normal Title / Actor Search
        if (trimmed.length >= 2) {
            if (filter === 'movie') return `/search/movie?query=${encodeURIComponent(query.trim())}`;
            if (filter === 'tv') return `/search/tv?query=${encodeURIComponent(query.trim())}`;
            return `/search/multi?query=${encodeURIComponent(query.trim())}`;
        }

        // 3. Default Popular / Trending
        if (filter === 'movie') return '/movie/popular';
        if (filter === 'tv') return '/tv/popular';
        return '/trending/all/week';
    }, [filter, query]);

    useEffect(() => {
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            const canReuseSnapshot = canReuseInitialSnapshotRef.current &&
                initialSnapshot?.endpoint === endpoint &&
                initialSnapshot?.results?.length &&
                isScreenStateFresh(initialSnapshot);
            canReuseInitialSnapshotRef.current = false;
            if (canReuseSnapshot) {
                setLoading(false);
                return;
            }

            setLoading(!results.length);
            setPage(1);
            setLoadingMore(false);
            const response = await fetchTMDBCached(appendPage(endpoint, 1));
            if (!cancelled) {
                const items = cleanItems(response?.results || [])
                    .filter((item) => item.media_type !== 'person')
                    .map((item) => ({
                        ...item,
                        media_type: item.media_type || (filter === 'tv' ? 'tv' : 'movie')
                    }));
                setResults(items);
                setHasMore(Boolean(items.length && (response?.total_pages ? response.page < response.total_pages : items.length >= 20)));
                setLoadedAt(Date.now());
                setLoading(false);
            }
        }, query.trim().length ? 360 : 0);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [endpoint, filter, initialSnapshot, query]);

    useEffect(() => {
        writeScreenState('search', {
            query,
            filter,
            results,
            heroBackdrop,
            page,
            hasMore,
            endpoint,
            loadedAt
        });
    }, [endpoint, filter, hasMore, heroBackdrop, loadedAt, page, query, results]);

    const filteredResults = useMemo(() => {
        let list = [...results];

        if (genreFilter !== 'all') {
            const genreId = Number(genreFilter);
            list = list.filter((item) => (item.genre_ids || []).includes(genreId));
        }

        const minRating = Number(ratingFilter);
        if (minRating > 0) {
            list = list.filter((item) => Number(item.vote_average || 0) >= minRating);
        }

        if (sortFilter === 'rating') {
            list.sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0));
        } else if (sortFilter === 'year') {
            list.sort((a, b) => {
                const dateA = a.release_date || a.first_air_date || '';
                const dateB = b.release_date || b.first_air_date || '';
                return dateB.localeCompare(dateA);
            });
        }

        return list;
    }, [genreFilter, ratingFilter, results, sortFilter]);

    const loadMoreResults = useCallback(async () => {
        if (loadingMore || !hasMore) return;

        const nextPage = page + 1;
        setLoadingMore(true);

        try {
            const response = await fetchTMDBCached(appendPage(endpoint, nextPage));
            const items = cleanItems(response?.results || [])
                .filter((item) => item.media_type !== 'person')
                .map((item) => ({
                    ...item,
                    media_type: item.media_type || (filter === 'tv' ? 'tv' : 'movie')
                }));

            setResults((current) => cleanItems([...current, ...items]));
            setPage(nextPage);
            setHasMore(Boolean(items.length && (response?.total_pages ? nextPage < response.total_pages : items.length >= 20)));
        } finally {
            setLoadingMore(false);
        }
    }, [endpoint, filter, hasMore, loadingMore, page]);

    const openDetail = useCallback((item) => {
        const type = mediaType(item, filter === 'tv' ? 'tv' : 'movie');
        navigate(`/watch/${type}/${item.id}`, {
            state: {
                from: `${location.pathname}${location.search}`,
                preview: { ...item, media_type: type }
            }
        });
    }, [filter, location.pathname, location.search, navigate]);

    // Speech Recognition for Voice Search
    const handleVoiceSearch = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Tarayıcınız sesli aramayı desteklemiyor.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'tr-TR';
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);

        recognition.onresult = (event) => {
            const transcript = event.results[0]?.[0]?.transcript || '';
            if (transcript) setQuery(transcript);
        };

        recognition.start();
    }, []);

    const featured = filteredResults[0] || results[0];
    const featuredImage = tvBackdropUrl(featured?.backdrop_path || featured?.poster_path);

    useEffect(() => {
        if (!featuredImage) {
            setHeroBackdrop('');
            return undefined;
        }

        let cancelled = false;
        const settleDelay = query.trim().length >= 2 ? 900 : 0;
        const timer = window.setTimeout(() => {
            preloadImage(featuredImage).finally(() => {
                if (!cancelled) setHeroBackdrop(featuredImage);
            });
        }, settleDelay);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [featuredImage, query]);

    return (
        <motion.div
            className="tv-screen tv-search-page"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
            <section className="tv-search-hero">
                <div className="tv-search-bg" style={{ backgroundImage: heroBackdrop ? `url("${heroBackdrop}")` : undefined }} />
                <div className="tv-search-fade" />
                <div className="tv-search-copy">
                    <span className="tv-kicker">Noxis Akıllı Arama & Keşfet</span>
                    <h1>{query.trim() ? query.trim() : 'Küresel Sinema Kütüphanesi'}</h1>

                    {/* Search Input Bar with Voice & Clear */}
                    <div className="tv-search-box-wrapper">
                        <div className="tv-search-box" data-tv-focus-group="tv-search-input-group" data-tv-focus-axis="horizontal">
                            <i className="fas fa-search tv-search-icon" />
                            <input
                                className="tv-search-input-field"
                                data-tv-autofocus="true"
                                data-focus-id="tv-search-input"
                                data-tv-focus-index="0"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Film adı, dizi adı veya bir tür yazın (Aksiyon, Korku vb.)..."
                                autoComplete="off"
                            />

                            {query && (
                                <button type="button" className="tv-search-action-btn" onClick={() => setQuery('')} title="Aramayı Temizle">
                                    <i className="fas fa-times" />
                                </button>
                            )}

                            <button
                                type="button"
                                className={`tv-search-action-btn ${isListening ? 'listening' : ''}`}
                                onClick={handleVoiceSearch}
                                title="Sesle Ara"
                            >
                                <i className={`fas ${isListening ? 'fa-microphone-alt fa-pulse' : 'fa-microphone'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Listening Feedback Banner */}
                    <AnimatePresence>
                        {isListening && (
                            <motion.div
                                className="tv-voice-listening-badge"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                            >
                                <span className="tv-voice-dot" />
                                <span>Dinleniyor... Şimdi film, dizi veya tür söyleyin</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Smart Mood Chips */}
                    <div className="tv-search-mood-chips">
                        {SMART_MOOD_CHIPS.map((chip) => (
                            <button
                                key={chip.id}
                                type="button"
                                className="tv-mood-chip"
                                onClick={() => {
                                    setGenreFilter(chip.genreId);
                                    setQuery(chip.query);
                                }}
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>

                    {/* Mobile Toggle Button for Filters */}
                    <div className="tv-mobile-filter-toggle">
                        <button
                            type="button"
                            className="tv-btn-toggle-filters"
                            onClick={() => setShowMobileFilters(!showMobileFilters)}
                        >
                            <i className="fas fa-sliders-h" /> {showMobileFilters ? 'Filtreleri Gizle' : 'Filtrele & Sırala'}
                        </button>
                    </div>

                    {/* Filter Bar (Collapsible on Mobile) */}
                    <div className={`tv-search-filter-section ${showMobileFilters ? 'mobile-visible' : ''}`}>
                        <div className="tv-filter-row" data-tv-focus-group="tv-search-type-filters" data-tv-focus-axis="horizontal">
                            <span className="tv-filter-row-label">İçerik</span>
                            <div className="tv-filter-tabs">
                                {TYPE_FILTERS.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`focusable tv-filter-tab ${filter === item.id ? 'active' : ''}`}
                                        data-focus-id={`tv-search-type-${item.id}`}
                                        data-tv-focus-index={TYPE_FILTERS.findIndex((entry) => entry.id === item.id)}
                                        onClick={() => setFilter(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="tv-filter-row" data-tv-focus-group="tv-search-genre-filters" data-tv-focus-axis="horizontal">
                            <span className="tv-filter-row-label">Tür</span>
                            <div className="tv-filter-tabs">
                                {GENRE_FILTERS.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`focusable tv-filter-tab ${genreFilter === item.id ? 'active' : ''}`}
                                        data-focus-id={`tv-search-genre-${item.id}`}
                                        data-tv-focus-index={GENRE_FILTERS.findIndex((entry) => entry.id === item.id)}
                                        onClick={() => setGenreFilter(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="tv-filter-row" data-tv-focus-group="tv-search-rating-filters" data-tv-focus-axis="horizontal">
                            <span className="tv-filter-row-label">Puan & Sıra</span>
                            <div className="tv-filter-tabs">
                                {RATING_FILTERS.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`focusable tv-filter-tab ${ratingFilter === item.id ? 'active' : ''}`}
                                        data-focus-id={`tv-search-rating-${item.id}`}
                                        data-tv-focus-index={RATING_FILTERS.findIndex((entry) => entry.id === item.id)}
                                        onClick={() => setRatingFilter(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                                <span className="tv-filter-divider" />
                                {SORT_FILTERS.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`focusable tv-filter-tab ${sortFilter === item.id ? 'active' : ''}`}
                                        data-focus-id={`tv-search-sort-${item.id}`}
                                        data-tv-focus-index={100 + SORT_FILTERS.findIndex((entry) => entry.id === item.id)}
                                        onClick={() => setSortFilter(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="tv-search-results">
                <div className="tv-rail-heading">
                    <div>
                        <span className="tv-rail-eyebrow">{loading ? 'Aranıyor' : `${filteredResults.length} Sonuç Bulundu`}</span>
                        <h2>{query.trim() ? 'Arama Sonuçları' : 'Trendler & Öne Çıkanlar'}</h2>
                    </div>
                </div>
                <div className="tv-result-grid" data-tv-focus-group="tv-search-results" data-tv-focus-axis="grid">
                    {loading && !filteredResults.length
                        ? Array.from({ length: 12 }).map((_, index) => (
                            <div key={index} className="tv-card tv-card-portrait tv-card-skeleton" />
                        ))
                        : filteredResults.map((item, index) => (
                            <TvCard
                                key={`${mediaType(item)}-${item.id}-${index}`}
                                item={item}
                                index={index}
                                rowKey="search"
                                layout="portrait"
                                onSelect={() => openDetail(item)}
                            />
                        ))}
                </div>

                {hasMore && (
                    <div className="tv-search-more-wrap">
                        <TvLoadMoreCard
                            loading={loadingMore}
                            onSelect={loadMoreResults}
                            index={filteredResults.length}
                        />
                    </div>
                )}
            </section>
        </motion.div>
    );
};

export default TvSearchPage;
