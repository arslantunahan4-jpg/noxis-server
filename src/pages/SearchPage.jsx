import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SmartImage, POSTER_IMG } from '../components/Shared';
import { fetchTMDB } from '../hooks/useAppLogic';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const GENRES = {
    movie: [
        { id: 28, name: 'Aksiyon' }, { id: 12, name: 'Macera' }, { id: 16, name: 'Animasyon' },
        { id: 35, name: 'Komedi' }, { id: 80, name: 'Suç' }, { id: 99, name: 'Belgesel' },
        { id: 18, name: 'Dram' }, { id: 10751, name: 'Aile' }, { id: 14, name: 'Fantastik' },
        { id: 36, name: 'Tarih' }, { id: 27, name: 'Korku' }, { id: 10402, name: 'Müzik' },
        { id: 9648, name: 'Gizem' }, { id: 10749, name: 'Romantik' }, { id: 878, name: 'Bilim Kurgu' },
        { id: 53, name: 'Gerilim' }, { id: 10752, name: 'Savaş' }, { id: 37, name: 'Western' }
    ],
    tv: [
        { id: 10759, name: 'Aksiyon & Macera' }, { id: 16, name: 'Animasyon' }, { id: 35, name: 'Komedi' },
        { id: 80, name: 'Suç' }, { id: 99, name: 'Belgesel' }, { id: 18, name: 'Dram' },
        { id: 10751, name: 'Aile' }, { id: 10762, name: 'Çocuk' }, { id: 9648, name: 'Gizem' },
        { id: 10763, name: 'Haber' }, { id: 10764, name: 'Reality' }, { id: 10765, name: 'Bilim Kurgu & Fantastik' },
        { id: 10766, name: 'Pembe Dizi' }, { id: 10767, name: 'Talk Show' }, { id: 10768, name: 'Savaş & Politik' }, { id: 37, name: 'Western' }
    ]
};

const SORT_OPTIONS = [
    { id: 'popularity.desc', name: 'Popülerlik (Yüksek)' },
    { id: 'popularity.asc', name: 'Popülerlik (Düşük)' },
    { id: 'vote_average.desc', name: 'Puan (Yüksek)' },
    { id: 'vote_average.asc', name: 'Puan (Düşük)' },
    { id: 'primary_release_date.desc', name: 'Tarih (Yeni)' },
    { id: 'primary_release_date.asc', name: 'Tarih (Eski)' }
];

const DEFAULT_FILTERS = {
    type: 'all',
    genre: '',
    minRating: 0,
    sortBy: 'popularity.desc',
    year: ''
};

const getFiltersFromParams = (params) => ({
    type: ['all', 'movie', 'tv'].includes(params.get('type')) ? params.get('type') : DEFAULT_FILTERS.type,
    genre: params.get('genre') || DEFAULT_FILTERS.genre,
    minRating: Number(params.get('minRating') || DEFAULT_FILTERS.minRating),
    sortBy: params.get('sortBy') || DEFAULT_FILTERS.sortBy,
    year: params.get('year') || DEFAULT_FILTERS.year
});

const hasActiveFilters = (filters) => (
    filters.type !== DEFAULT_FILTERS.type ||
    filters.genre !== DEFAULT_FILTERS.genre ||
    filters.minRating !== DEFAULT_FILTERS.minRating ||
    filters.sortBy !== DEFAULT_FILTERS.sortBy ||
    filters.year !== DEFAULT_FILTERS.year
);

const SearchPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const searchParamsString = searchParams.toString();
    const queryParam = useMemo(() => searchParams.get('q') || '', [searchParamsString]);
    const paramFilters = useMemo(() => getFiltersFromParams(searchParams), [searchParamsString]);
    const pageParam = useMemo(
        () => Math.max(1, Number(searchParams.get('page') || 1)),
        [searchParamsString]
    );
    const [searchQuery, setSearchQuery] = useState(queryParam);
    const [searchResults, setSearchResults] = useState([]);
    const [showFilters, setShowFilters] = useState(() => hasActiveFilters(paramFilters));
    const [filters, setFilters] = useState(paramFilters);
    
    const [discoverResults, setDiscoverResults] = useState([]);
    const [discoverPage, setDiscoverPage] = useState(pageParam);
    const [discoverTotalPages, setDiscoverTotalPages] = useState(1);
    const [isDiscoverLoading, setIsDiscoverLoading] = useState(false);

    useEffect(() => {
        setSearchQuery(prev => (prev !== queryParam ? queryParam : prev));
        setFilters(prev => (
            prev.type !== paramFilters.type ||
            prev.genre !== paramFilters.genre ||
            prev.minRating !== paramFilters.minRating ||
            prev.sortBy !== paramFilters.sortBy ||
            prev.year !== paramFilters.year
                ? paramFilters
                : prev
        ));
        setDiscoverPage(prev => (prev !== pageParam ? pageParam : prev));
        setShowFilters(prev => (!queryParam && hasActiveFilters(paramFilters) ? true : prev));
    }, [queryParam, pageParam, paramFilters]);

    useEffect(() => {
        const nextParams = new URLSearchParams();
        if (searchQuery) nextParams.set('q', searchQuery);
        if (filters.type !== DEFAULT_FILTERS.type) nextParams.set('type', filters.type);
        if (filters.genre) nextParams.set('genre', filters.genre);
        if (filters.minRating > 0) nextParams.set('minRating', String(filters.minRating));
        if (filters.sortBy !== DEFAULT_FILTERS.sortBy) nextParams.set('sortBy', filters.sortBy);
        if (filters.year) nextParams.set('year', filters.year);
        if (!searchQuery && discoverPage > 1) nextParams.set('page', String(discoverPage));

        if (nextParams.toString() !== searchParamsString) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [searchQuery, filters, discoverPage, searchParamsString, setSearchParams]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length > 2) {
                fetchTMDB(`/search/multi?query=${searchQuery}`).then(d => {
                    if (d && d.results) {
                        const resultsWithType = d.results.map(item => ({
                            ...item,
                            media_type: item.media_type || (item.first_air_date ? 'tv' : 'movie')
                        }));
                        setSearchResults(resultsWithType);
                    }
                });
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const discoverContent = useCallback(async (page = 1, resetResults = true) => {
        setIsDiscoverLoading(true);
        const fetchPagedResults = async (endpointBase, mediaType) => {
            const pagesToFetch = resetResults ? Array.from({ length: page }, (_, index) => index + 1) : [page];
            const responses = await Promise.all(
                pagesToFetch.map(currentPage => fetchTMDB(`${endpointBase}&page=${currentPage}`))
            );
            const mergedResults = responses.flatMap(res => (res?.results || []).map(item => ({ ...item, media_type: mediaType })));
            const lastResponse = responses[responses.length - 1];
            return {
                results: mergedResults,
                totalPages: lastResponse?.total_pages || 1
            };
        };

        const buildParams = (type) => {
            let params = [];
            const sortBy = type === 'tv'
                ? filters.sortBy.replace('primary_release_date', 'first_air_date')
                : filters.sortBy;
            params.push(`sort_by=${sortBy}`);

            if (filters.minRating > 0) {
                params.push(`vote_average.gte=${filters.minRating}`);
                params.push('vote_count.gte=100');
            }
            if (filters.year) {
                if (type === 'tv') params.push(`first_air_date_year=${filters.year}`);
                else params.push(`primary_release_year=${filters.year}`);
            }
            if (filters.genre) params.push(`with_genres=${filters.genre}`);
            return params.join('&');
        };

        if (filters.type === 'movie') {
            const res = await fetchPagedResults(`/discover/movie?${buildParams('movie')}`, 'movie');
            if (res) {
                const results = res.results;
                setDiscoverResults(resetResults ? results : prev => [...prev, ...results]);
                setDiscoverPage(page);
                setDiscoverTotalPages(res.totalPages || 1);
            }
        } else if (filters.type === 'tv') {
            const res = await fetchPagedResults(`/discover/tv?${buildParams('tv')}`, 'tv');
            if (res) {
                const results = res.results;
                setDiscoverResults(resetResults ? results : prev => [...prev, ...results]);
                setDiscoverPage(page);
                setDiscoverTotalPages(res.totalPages || 1);
            }
        } else {
            const [movieRes, tvRes] = await Promise.all([
                fetchPagedResults(`/discover/movie?${buildParams('movie')}`, 'movie'),
                fetchPagedResults(`/discover/tv?${buildParams('tv')}`, 'tv')
            ]);
            const movies = movieRes?.results || [];
            const tvShows = tvRes?.results || [];
            const combined = [...movies, ...tvShows].sort((a, b) => b.popularity - a.popularity); // Basic sort
            
            setDiscoverResults(resetResults ? combined : prev => [...prev, ...combined]);
            setDiscoverPage(page);
            setDiscoverTotalPages(Math.max(movieRes?.totalPages || 1, tvRes?.totalPages || 1));
        }
        setIsDiscoverLoading(false);
    }, [filters]);

    useEffect(() => {
        if (!searchQuery) {
            discoverContent(pageParam, true);
        }
    }, [filters, searchQuery, discoverContent, pageParam]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setDiscoverPage(1);
    };

    const clearFilters = () => {
        setFilters(DEFAULT_FILTERS);
        setDiscoverPage(1);
    };

    const openDetail = (m) => {
        const type = m.media_type || (m.first_air_date ? 'tv' : 'movie');
        navigate(`/watch/${type}/${m.id}`, {
            state: { from: `${location.pathname}${location.search}` }
        });
    };

    return (
        <div className="tv-screen tv-search-page">
            <section className="tv-search-hero">
                <div className="tv-search-bg" />
                <div className="tv-search-fade" />
                <div className="tv-search-copy">
                    <span className="tv-kicker">Noxis arama</span>
                    <div className="desktop-search-heading">
                        <h1>{searchQuery ? searchQuery : 'Keşfet'}</h1>
                    <button onClick={() => setShowFilters(!showFilters)} className="filter-toggle-btn">
                        <i className={`fas fa-${showFilters ? 'times' : 'sliders-h'}`}></i>
                        <span>{showFilters ? 'Kapat' : 'Filtrele'}</span>
                    </button>
                    </div>

                    <div className="tv-search-box">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            type="text"
                            className="focusable search-input"
                            placeholder="Film, dizi veya oyuncu ara..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <AnimatePresence>
                        {showFilters && !searchQuery && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="filter-panel"
                                style={{ overflow: 'hidden' }}
                            >
                            <div className="filter-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                                <div className="filter-group">
                                    <label className="filter-label">Tür</label>
                                    <div className="filter-chips">
                                        {[
                                            { id: 'all', name: 'Tümü' },
                                            { id: 'movie', name: 'Film' },
                                            { id: 'tv', name: 'Dizi' }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => handleFilterChange('type', t.id)}
                                                className={`filter-chip ${filters.type === t.id ? 'active' : ''}`}
                                            >
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Kategori</label>
                                    <select
                                        value={filters.genre}
                                        onChange={e => handleFilterChange('genre', e.target.value)}
                                        className="filter-select"
                                    >
                                        <option value="">Tüm Kategoriler</option>
                                        {(filters.type === 'tv' ? GENRES.tv : GENRES.movie).map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Sıralama</label>
                                    <select
                                        value={filters.sortBy}
                                        onChange={e => handleFilterChange('sortBy', e.target.value)}
                                        className="filter-select"
                                    >
                                        {SORT_OPTIONS.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Puan (En Az)</label>
                                    <select
                                        value={filters.minRating}
                                        onChange={e => handleFilterChange('minRating', Number(e.target.value))}
                                        className="filter-select"
                                    >
                                        <option value={0}>Farketmez</option>
                                        <option value={7}>7+ İyiler</option>
                                        <option value={8}>8+ Çok İyiler</option>
                                        <option value={9}>9+ Efsaneler</option>
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="filter-label">Yıl</label>
                                    <input
                                        type="number"
                                        placeholder="Örn: 2024"
                                        value={filters.year}
                                        onChange={e => handleFilterChange('year', e.target.value)}
                                        className="filter-input"
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            color: 'white',
                                            fontSize: '14px',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="filter-actions" style={{ marginTop: '10px' }}>
                                <button onClick={clearFilters} className="filter-clear-btn">
                                    <i className="fas fa-undo"></i> Temizle
                                </button>
                            </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </section>

            <section className="tv-search-results">
                <div className="tv-rail-heading">
                    <span>{isDiscoverLoading ? 'Hazırlanıyor' : `${(searchQuery ? searchResults : discoverResults).length} içerik`}</span>
                    <h2>{searchQuery ? 'Sonuçlar' : 'Öne çıkanlar'}</h2>
                </div>
                <div className="tv-result-grid">
                {(searchQuery ? searchResults : discoverResults)
                    .filter(m => m.poster_path)
                    .map(m => (
                    <button
                        key={`${m.id}-${m.media_type || 'unknown'}`}
                        onClick={() => openDetail(m)}
                        className="focusable tv-card tv-card-portrait"
                    >
                        <span className="tv-card-media">
                        <SmartImage
                            src={POSTER_IMG + m.poster_path}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        </span>
                        <span className="tv-card-shade" />
                        <span className="tv-card-focus-layer"><i className="fas fa-play" /></span>
                        <div className="card-rating">
                            <i className="fas fa-star"></i>
                            {(m.vote_average || 0).toFixed(1)}
                        </div>
                        <span className="tv-card-copy">
                            <span className="tv-card-title">{m.title || m.name}</span>
                        </span>
                    </button>
                ))}
                </div>
                 {!searchQuery && discoverPage < discoverTotalPages && (
                     <div className="tv-search-load-more">
                    <button
                        onClick={() => discoverContent(discoverPage + 1, false)}
                        className="focusable tv-action tv-action-secondary"
                        disabled={isDiscoverLoading}
                        style={{ padding: '10px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}
                    >
                        {isDiscoverLoading ? 'Yükleniyor...' : 'Daha Fazla Yükle'}
                    </button>
                     </div>
                 )}
            </section>
        </div>
    );
};

export default SearchPage;
