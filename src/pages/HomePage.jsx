import React, { useState, useEffect } from 'react';
import { HeroCarousel, Row } from '../components/HomeWidgets';
import { fetchTMDB } from '../hooks/useAppLogic';
import { useLocation, useNavigate } from 'react-router-dom';
import { getContinueWatching } from '../utils/watchHistory';
import { useSmartRecommendations } from '../hooks/useSmartRecommendations';

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
    const location = useLocation();
    const smartRecs = useSmartRecommendations();
    
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
        const refreshContinue = () => {
            const continueItems = getContinueWatching();
            setData(prev => ({ ...prev, continue: continueItems }));
        };

        refreshContinue();

        window.addEventListener('focus', refreshContinue);
        window.addEventListener('visibilitychange', refreshContinue);
        
        return () => {
            window.removeEventListener('focus', refreshContinue);
            window.removeEventListener('visibilitychange', refreshContinue);
        };
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
        const loadInitialData = async () => {
            const endpoints = [
                { key: 'trending', endpoint: '/trending/all/day' },
                { key: 'popularMovies', endpoint: '/movie/popular' },
                { key: 'popularTV', endpoint: '/tv/popular' },
                { key: 'actionMovies', endpoint: '/discover/movie?with_genres=28' },
                { key: 'comedyMovies', endpoint: '/discover/movie?with_genres=35' },
                { key: 'horrorMovies', endpoint: '/discover/movie?with_genres=27' },
                { key: 'romanticMovies', endpoint: '/discover/movie?with_genres=10749' },
                { key: 'scifiMovies', endpoint: '/discover/movie?with_genres=878' },
                { key: 'crimeTV', endpoint: '/discover/tv?with_genres=80' },
                { key: 'comedyTV', endpoint: '/discover/tv?with_genres=35' },
                { key: 'dramaTV', endpoint: '/discover/tv?with_genres=18' },
                { key: 'scifiTV', endpoint: '/discover/tv?with_genres=10765' }
            ];

            const results = await Promise.all(
                endpoints.map(({ endpoint }) => 
                    fetchTMDB(endpoint + (endpoint.includes('?') ? '&' : '?') + 'page=1')
                )
            );

            const newData = {};
            endpoints.forEach(({ key }, index) => {
                const res = results[index];
                if (res && res.results) {
                    newData[key] = {
                        results: res.results,
                        page: 1,
                        total_pages: res.total_pages || 1
                    };
                }
            });

            if (newData.trending) {
                newData.hero = newData.trending.results.slice(0, 6);
            }

            setData(prev => ({ ...prev, ...newData }));
        };

        loadInitialData();
    }, []);

    const openDetail = (movie) => {
        const type = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
        navigate(`/watch/${type}/${movie.id}`, {
            state: { from: `${location.pathname}${location.search}` }
        });
    };

    const openContinueWatch = (movie) => {
        const type = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
        const id = movie.id;
        const s = movie.season || 1;
        const e = movie.episode || 1;
        navigate(`/watch/${type}/${id}?autoplay=1&s=${s}&e=${e}`, {
            state: { from: `${location.pathname}${location.search}` }
        });
    };

    const openPlayer = (movie, s, e) => {
        const type = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
        const id = movie.id || movie.imdbId || movie.tmdbId;
        navigate(`/play/${type}/${id}?s=${s}&e=${e}`, {
            state: { from: `${location.pathname}${location.search}` }
        });
    };

    return (
        <div className="tv-screen tv-home-page">
            <HeroCarousel
                movies={data.hero}
                onPlay={(m) => openPlayer(m, 1, 1)}
                onDetails={openDetail}
            />
            <div className="tv-rail-stack">
                {data.continue.length > 0 && (
                    <Row
                        title="Kaldığın Yerden Devam Et"
                        data={data.continue}
                        onSelect={openContinueWatch}
                        layout="landscape"
                    />
                )}

                {!smartRecs.loading && (
                    <>
                        {smartRecs.topPicks?.data?.length > 0 && (
                            <Row 
                                title={smartRecs.topPicks.title} 
                                data={smartRecs.topPicks.data} 
                                onSelect={openDetail} 
                            />
                        )}
                        {smartRecs.becauseYouWatched?.data?.length > 0 && (
                            <Row 
                                title={smartRecs.becauseYouWatched.title} 
                                data={smartRecs.becauseYouWatched.data} 
                                onSelect={openDetail} 
                            />
                        )}
                        {smartRecs.genreBased?.data?.length > 0 && (
                            <Row 
                                title={smartRecs.genreBased.title} 
                                data={smartRecs.genreBased.data} 
                                onSelect={openDetail} 
                            />
                        )}
                    </>
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
