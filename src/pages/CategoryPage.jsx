import React, { useState, useEffect } from 'react';
import { Row } from '../components/HomeWidgets';
import { fetchTMDB, MOVIE_CATEGORY_DEFINITIONS, TV_CATEGORY_DEFINITIONS } from '../hooks/useAppLogic';
import { useLocation, useNavigate } from 'react-router-dom';

const CategoryPage = ({ type = 'movie' }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Select definitions based on type
    const definitions = type === 'movie' ? MOVIE_CATEGORY_DEFINITIONS : TV_CATEGORY_DEFINITIONS;
    const popularKey = type === 'movie' ? 'popularMovies' : 'popularTV';
    const popularEndpoint = type === 'movie' ? '/movie/popular' : '/tv/popular';
    const popularTitle = type === 'movie' ? 'Popüler Filmler' : 'Popüler Diziler';

    const [data, setData] = useState(() => {
        const initialState = {
             [popularKey]: { results: [], page: 1, total_pages: 1 }
        };
        definitions.forEach(cat => {
            initialState[cat.key] = { results: [], page: 1, total_pages: 1 };
        });
        return initialState;
    });

    const loadData = async (key, endpoint, page) => {
        const res = await fetchTMDB(endpoint + (endpoint.includes('?') ? '&' : '?') + `page=${page}`);
        if (res && res.results) {
            setData(prev => ({
                ...prev,
                [key]: {
                    results: page === 1 ? res.results : [...(prev[key]?.results || []), ...res.results],
                    page: page,
                    total_pages: res.total_pages || 1
                }
            }));
        }
    };

    useEffect(() => {
        // Load Popular
        loadData(popularKey, popularEndpoint, 1);

        // Load Categories
        definitions.forEach(cat => {
            loadData(cat.key, cat.endpoint, 1);
        });
    }, [type]); 

    const openDetail = (movie) => {
        const mediaType = movie.media_type || (type === 'tv' ? 'tv' : 'movie');
        navigate(`/watch/${mediaType}/${movie.id}`, {
            state: { from: `${location.pathname}${location.search}` }
        });
    };

    return (
        <div style={{ paddingBottom: '80px', minHeight: '100dvh', background: 'var(--bg-primary)' }}>
            <div style={{ padding: '24px 16px 16px 16px' }}>
                <h1 style={{
                    fontSize: '32px',
                    fontWeight: '800',
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    {type === 'movie' ? 'Filmler' : 'Diziler'}
                </h1>
            </div>

            <Row
                title={popularTitle}
                data={data[popularKey]?.results || []}
                onSelect={openDetail}
                onLoadMore={() => loadData(popularKey, popularEndpoint, (data[popularKey]?.page || 1) + 1)}
                hasMore={data[popularKey]?.page < data[popularKey]?.total_pages}
            />

            {definitions.map(cat => (
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
    );
};

export default CategoryPage;
