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

    const featured = data[popularKey]?.results?.[0];
    const featuredImage = featured?.backdrop_path || featured?.poster_path
        ? `https://image.tmdb.org/t/p/w1280${featured.backdrop_path || featured.poster_path}`
        : '';

    return (
        <div className="tv-screen tv-category-page">
            <section className="tv-category-hero">
                <div className="tv-category-bg" style={{ backgroundImage: featuredImage ? `url("${featuredImage}")` : undefined }} />
                <div className="tv-category-fade" />
                <div className="tv-category-copy">
                    <span className="tv-kicker">Noxis koleksiyonu</span>
                    <h1>{type === 'movie' ? 'Filmler' : 'Diziler'}</h1>
                    <p>{type === 'movie'
                        ? 'Büyük perdeden kalan his, tek bir yerde.'
                        : 'Yeni bölümler, güçlü hikâyeler ve uzun geceler.'}</p>
                    {featured && (
                        <button type="button" className="focusable tv-action tv-action-primary" onClick={() => openDetail(featured)}>
                            <i className="fas fa-play" />
                            <span>{featured.title || featured.name}</span>
                        </button>
                    )}
                </div>
            </section>

            <div className="tv-rail-stack tv-category-rails">
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
        </div>
    );
};

export default CategoryPage;
