import React, { useState, useEffect } from 'react';
import { Row } from '../components/HomeWidgets';
import { fetchTMDB } from '../hooks/useAppLogic';
import { useNavigate } from 'react-router-dom';

const GENRE_TRANSLATIONS = {
    trending: 'Trend Olanlar',
    popularMovies: 'Popüler Filmler',
    popularTV: 'Popüler Diziler',
    actionMovies: 'Aksiyon Filmleri',
    comedyMovies: 'Komedi Filmleri',
    horrorMovies: 'Korku Filmleri',
    romanticMovies: 'Romantik Filmler',
    scifiMovies: 'Bilim Kurgu Filmleri',
    crimeTV: 'Suç Dizileri',
    comedyTV: 'Komedi Dizileri',
    dramaTV: 'Dram Dizileri',
    scifiTV: 'Bilim Kurgu Dizileri'
};

const CategoryPage = ({ type = 'movie' }) => {
    const navigate = useNavigate();
    const [data, setData] = useState({
        // Movies
        popularMovies: { results: [], page: 1, total_pages: 1 },
        actionMovies: { results: [], page: 1, total_pages: 1 },
        comedyMovies: { results: [], page: 1, total_pages: 1 },
        horrorMovies: { results: [], page: 1, total_pages: 1 },
        romanticMovies: { results: [], page: 1, total_pages: 1 },
        scifiMovies: { results: [], page: 1, total_pages: 1 },
        // TV
        popularTV: { results: [], page: 1, total_pages: 1 },
        crimeTV: { results: [], page: 1, total_pages: 1 },
        comedyTV: { results: [], page: 1, total_pages: 1 },
        dramaTV: { results: [], page: 1, total_pages: 1 },
        scifiTV: { results: [], page: 1, total_pages: 1 }
    });
    const [loading, setLoading] = useState(false);

    const loadData = async (key, endpoint, page) => {
        setLoading(true);
        const res = await fetchTMDB(endpoint + (endpoint.includes('?') ? '&' : '?') + `page=${page}`);
        setLoading(false);
        if (res && res.results) {
            setData(prev => ({
                ...prev,
                [key]: {
                    results: page === 1 ? res.results : [...prev[key].results, ...res.results],
                    page: page,
                    total_pages: res.total_pages || 1
                }
            }));
        }
    };

    useEffect(() => {
        if (type === 'movie') {
            loadData('popularMovies', '/movie/popular', 1);
            loadData('actionMovies', '/discover/movie?with_genres=28', 1);
            loadData('comedyMovies', '/discover/movie?with_genres=35', 1);
            loadData('horrorMovies', '/discover/movie?with_genres=27', 1);
            loadData('romanticMovies', '/discover/movie?with_genres=10749', 1);
            loadData('scifiMovies', '/discover/movie?with_genres=878', 1);
        } else {
            loadData('popularTV', '/tv/popular', 1);
            loadData('crimeTV', '/discover/tv?with_genres=80', 1);
            loadData('comedyTV', '/discover/tv?with_genres=35', 1);
            loadData('dramaTV', '/discover/tv?with_genres=18', 1);
            loadData('scifiTV', '/discover/tv?with_genres=10765', 1);
        }
    }, [type]);

    const openDetail = (movie) => {
        // Force media type based on page category if missing
        const mediaType = movie.media_type || (type === 'tv' ? 'tv' : 'movie');
        navigate(`/watch/${mediaType}/${movie.id}`);
    };

    return (
        <div style={{ paddingBottom: '80px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
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

            {type === 'movie' ? (
                <>
                    <Row
                        title={GENRE_TRANSLATIONS.popularMovies}
                        data={data.popularMovies.results}
                        onSelect={openDetail}
                        onLoadMore={() => loadData('popularMovies', '/movie/popular', data.popularMovies.page + 1)}
                        hasMore={data.popularMovies.page < data.popularMovies.total_pages}
                    />
                    {['actionMovies', 'comedyMovies', 'horrorMovies', 'romanticMovies', 'scifiMovies'].map(k => (
                        <Row key={k} title={GENRE_TRANSLATIONS[k]} data={data[k].results} onSelect={openDetail} />
                    ))}
                </>
            ) : (
                <>
                    <Row
                        title={GENRE_TRANSLATIONS.popularTV}
                        data={data.popularTV.results}
                        onSelect={openDetail}
                        onLoadMore={() => loadData('popularTV', '/tv/popular', data.popularTV.page + 1)}
                        hasMore={data.popularTV.page < data.popularTV.total_pages}
                    />
                    {['crimeTV', 'comedyTV', 'dramaTV', 'scifiTV'].map(k => (
                        <Row key={k} title={GENRE_TRANSLATIONS[k]} data={data[k].results} onSelect={openDetail} />
                    ))}
                </>
            )}
        </div>
    );
};

export default CategoryPage;
