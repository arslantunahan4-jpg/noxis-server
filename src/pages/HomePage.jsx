import React, { useState, useEffect } from 'react';
import { HeroCarousel, Row } from '../components/HomeWidgets';
import { fetchTMDB, getStorageData } from '../hooks/useAppLogic';
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

const HomePage = () => {
    const navigate = useNavigate();
    const [data, setData] = useState({
        hero: [],
        continue: [],
        trending: { results: [], page: 1, total_pages: 1 },
        popularMovies: { results: [], page: 1, total_pages: 1 },
        popularTV: { results: [], page: 1, total_pages: 1 },
        actionMovies: { results: [], page: 1, total_pages: 1 },
        comedyMovies: { results: [], page: 1, total_pages: 1 },
        horrorMovies: { results: [], page: 1, total_pages: 1 },
        romanticMovies: { results: [], page: 1, total_pages: 1 },
        scifiMovies: { results: [], page: 1, total_pages: 1 },
        crimeTV: { results: [], page: 1, total_pages: 1 },
        comedyTV: { results: [], page: 1, total_pages: 1 },
        dramaTV: { results: [], page: 1, total_pages: 1 },
        scifiTV: { results: [], page: 1, total_pages: 1 }
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const continueItems = getStorageData('continue_watching');
        setData(prev => ({ ...prev, continue: continueItems }));
    }, []);

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
            if (key === 'trending' && page === 1) {
                setData(prev => ({ ...prev, hero: res.results.slice(0, 6) }));
            }
        }
    };

    useEffect(() => {
        loadData('trending', '/trending/all/day', 1);
        loadData('popularMovies', '/movie/popular', 1);
        loadData('popularTV', '/tv/popular', 1);
        loadData('actionMovies', '/discover/movie?with_genres=28', 1);
        loadData('comedyMovies', '/discover/movie?with_genres=35', 1);
        loadData('horrorMovies', '/discover/movie?with_genres=27', 1);
        loadData('romanticMovies', '/discover/movie?with_genres=10749', 1);
        loadData('scifiMovies', '/discover/movie?with_genres=878', 1);
        loadData('crimeTV', '/discover/tv?with_genres=80', 1);
        loadData('comedyTV', '/discover/tv?with_genres=35', 1);
        loadData('dramaTV', '/discover/tv?with_genres=18', 1);
        loadData('scifiTV', '/discover/tv?with_genres=10765', 1);
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
                <Row
                    title={GENRE_TRANSLATIONS.trending}
                    data={data.trending.results}
                    onSelect={openDetail}
                    onLoadMore={() => loadData('trending', '/trending/all/day', data.trending.page + 1)}
                    hasMore={data.trending.page < data.trending.total_pages}
                    isLoadingMore={loading}
                />
                <Row
                    title={GENRE_TRANSLATIONS.popularMovies}
                    data={data.popularMovies.results}
                    onSelect={openDetail}
                    onLoadMore={() => loadData('popularMovies', '/movie/popular', data.popularMovies.page + 1)}
                    hasMore={data.popularMovies.page < data.popularMovies.total_pages}
                />
                <Row
                    title={GENRE_TRANSLATIONS.popularTV}
                    data={data.popularTV.results}
                    onSelect={openDetail}
                    onLoadMore={() => loadData('popularTV', '/tv/popular', data.popularTV.page + 1)}
                    hasMore={data.popularTV.page < data.popularTV.total_pages}
                />
                
                {['actionMovies', 'comedyMovies', 'horrorMovies', 'romanticMovies', 'scifiMovies'].map(k => (
                    <Row key={k} title={GENRE_TRANSLATIONS[k]} data={data[k].results} onSelect={openDetail} />
                ))}
                 {['crimeTV', 'comedyTV', 'dramaTV', 'scifiTV'].map(k => (
                    <Row key={k} title={GENRE_TRANSLATIONS[k]} data={data[k].results} onSelect={openDetail} />
                ))}
            </div>
        </div>
    );
};

export default HomePage;
