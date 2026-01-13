import React, { useState, useEffect } from 'react';
import { HeroCarousel, Row } from '../components/HomeWidgets';
import { fetchTMDB, getStorageData, CATEGORY_DEFINITIONS } from '../hooks/useAppLogic';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
    const navigate = useNavigate();
    // Initialize state with hero, continue, and dynamic categories
    const [data, setData] = useState(() => {
        const initialState = {
            hero: [],
            continue: [],
            // Keep original trending/popular for safety or legacy if needed,
            // but we will primarily use dynamic keys.
            trending: { results: [], page: 1, total_pages: 1 }
        };
        // Initialize state for each new category
        CATEGORY_DEFINITIONS.forEach(cat => {
            initialState[cat.key] = { results: [], page: 1, total_pages: 1 };
        });
        return initialState;
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const continueItems = getStorageData('continue_watching');
        setData(prev => ({ ...prev, continue: continueItems }));
    }, []);

    const loadData = async (key, endpoint, page) => {
        // Prevent race conditions or excessive loading if needed, but for simple UI keep it simple
        const res = await fetchTMDB(endpoint + (endpoint.includes('?') ? '&' : '?') + `page=${page}`);

        if (res && res.results) {
            setData(prev => ({
                ...prev,
                [key]: {
                    results: page === 1 ? res.results : [...prev[key].results, ...res.results],
                    page: page,
                    total_pages: res.total_pages || 1
                }
            }));
            // Special case: Populate Hero from the first category loaded (or trending) if empty
            if (key === 'trending' && page === 1) {
                setData(prev => ({ ...prev, hero: res.results.slice(0, 6) }));
            }
        }
    };

    useEffect(() => {
        // Load Hero/Trending
        loadData('trending', '/trending/all/day', 1);

        // Load all defined categories
        CATEGORY_DEFINITIONS.forEach(cat => {
            loadData(cat.key, cat.endpoint, 1);
        });
    }, []);

    const openDetail = (movie) => {
        const type = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
        navigate(`/watch/${type}/${movie.id}`);
    };

    const openPlayer = (movie, s, e) => {
        const type = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
        navigate(`/play/${type}/${movie.id}?s=${s}&e=${e}`);
    };

    return (
        <div style={{ background: 'var(--bg-primary)', paddingBottom: '80px', minHeight: '100vh' }}>
            <HeroCarousel
                movies={data.hero}
                onPlay={(m) => openPlayer(m, 1, 1)}
                onDetails={openDetail}
            />
            <div style={{ paddingTop: '24px' }}>
                {data.continue.length > 0 && (
                    <Row
                        title="Kaldığın Yerden Devam Et"
                        data={data.continue}
                        onSelect={(m) => setTimeout(() => openPlayer(m, m.season || 1, m.episode || 1), 50)}
                        layout="landscape"
                    />
                )}

                {/* Original Trending Row (kept as general "Trending") */}
                <Row
                    title="Gündemdekiler"
                    data={data.trending.results}
                    onSelect={openDetail}
                    onLoadMore={() => loadData('trending', '/trending/all/day', data.trending.page + 1)}
                    hasMore={data.trending.page < data.trending.total_pages}
                />

                {/* Render All 16 Categories Dynamic Rows */}
                {CATEGORY_DEFINITIONS.map(cat => (
                    <Row
                        key={cat.key}
                        title={cat.title}
                        data={data[cat.key]?.results || []}
                        onSelect={openDetail}
                        onLoadMore={() => loadData(cat.key, cat.endpoint, (data[cat.key]?.page || 1) + 1)}
                        hasMore={data[cat.key]?.page < data[cat.key]?.total_pages}
                    />
                ))}
            </div>
        </div>
    );
};

export default HomePage;
