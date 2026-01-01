import React, { useState, useEffect, useCallback } from 'react';
import { SmartImage, POSTER_IMG } from '../components/Shared';
import { fetchTMDB } from '../hooks/useAppLogic';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

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

const SearchPage = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        type: 'all',
        genre: '',
        minRating: 0,
        sortBy: 'popularity.desc',
        year: ''
    });
    
    const [discoverResults, setDiscoverResults] = useState([]);
    const [discoverPage, setDiscoverPage] = useState(1);
    const [discoverTotalPages, setDiscoverTotalPages] = useState(1);
    const [isDiscoverLoading, setIsDiscoverLoading] = useState(false);

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
            const res = await fetchTMDB(`/discover/movie?${buildParams('movie')}&page=${page}`);
            if (res) {
                const results = (res.results || []).map(item => ({ ...item, media_type: 'movie' }));
                setDiscoverResults(resetResults ? results : prev => [...prev, ...results]);
                setDiscoverPage(page);
                setDiscoverTotalPages(res.total_pages || 1);
            }
        } else if (filters.type === 'tv') {
            const res = await fetchTMDB(`/discover/tv?${buildParams('tv')}&page=${page}`);
            if (res) {
                const results = (res.results || []).map(item => ({ ...item, media_type: 'tv' }));
                setDiscoverResults(resetResults ? results : prev => [...prev, ...results]);
                setDiscoverPage(page);
                setDiscoverTotalPages(res.total_pages || 1);
            }
        } else {
            const [movieRes, tvRes] = await Promise.all([
                fetchTMDB(`/discover/movie?${buildParams('movie')}&page=${page}`),
                fetchTMDB(`/discover/tv?${buildParams('tv')}&page=${page}`)
            ]);
            const movies = (movieRes?.results || []).map(m => ({ ...m, media_type: 'movie' }));
            const tvShows = (tvRes?.results || []).map(t => ({ ...t, media_type: 'tv' }));
            const combined = [...movies, ...tvShows].sort((a, b) => b.popularity - a.popularity); // Basic sort
            
            setDiscoverResults(resetResults ? combined : prev => [...prev, ...combined]);
            setDiscoverPage(page);
            setDiscoverTotalPages(Math.max(movieRes?.total_pages || 1, tvRes?.total_pages || 1));
        }
        setIsDiscoverLoading(false);
    }, [filters]);

    useEffect(() => {
        if (!searchQuery) {
            discoverContent(1, true);
        }
    }, [filters, searchQuery, discoverContent]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setDiscoverPage(1);
    };

    const clearFilters = () => {
        setFilters({
            type: 'all',
            genre: '',
            minRating: 0,
            sortBy: 'popularity.desc',
            year: ''
        });
    };

    const openDetail = (m) => {
        const type = m.media_type || (m.first_air_date ? 'tv' : 'movie');
        navigate(`/watch/${type}/${m.id}`);
    };

    return (
        <div style={{ paddingBottom: '80px', paddingTop: '20px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <div style={{ padding: '0 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h1 className="text-2xl font-bold text-white">Keşfet</h1>
                    <button onClick={() => setShowFilters(!showFilters)} className="filter-toggle-btn">
                        <i className={`fas fa-${showFilters ? 'times' : 'sliders-h'}`}></i>
                        <span>{showFilters ? 'Kapat' : 'Filtrele'}</span>
                    </button>
                </div>

                <div className="search-input-container" style={{ marginBottom: '16px' }}>
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
                             <div className="filter-row">
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

            <div className="search-grid" style={{ padding: '0 16px' }}>
                {(searchQuery ? searchResults : discoverResults)
                    .filter(m => m.poster_path)
                    .map(m => (
                    <button
                        key={`${m.id}-${m.media_type || 'unknown'}`}
                        onClick={() => openDetail(m)}
                        className="focusable poster-card search-grid-card"
                    >
                        <SmartImage
                            src={POSTER_IMG + m.poster_path}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div className="card-rating">
                            <i className="fas fa-star"></i>
                            {(m.vote_average || 0).toFixed(1)}
                        </div>
                        <div className="card-overlay">
                            <span className="card-title">{m.title || m.name}</span>
                        </div>
                    </button>
                ))}
            </div>
             {!searchQuery && discoverPage < discoverTotalPages && (
                 <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                        onClick={() => discoverContent(discoverPage + 1, false)}
                        className="focusable load-more-card"
                        disabled={isDiscoverLoading}
                        style={{ padding: '10px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}
                    >
                        {isDiscoverLoading ? 'Yükleniyor...' : 'Daha Fazla Yükle'}
                    </button>
                 </div>
             )}
        </div>
    );
};

export default SearchPage;
