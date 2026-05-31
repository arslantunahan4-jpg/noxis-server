import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Player } from '../components/Modals';
import { fetchTMDB } from '../hooks/useAppLogic';

const PlayerPage = () => {
    const { type, id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [movie, setMovie] = useState(null);

    const isLocal = searchParams.get('local') === 'true';
    const localUrl = searchParams.get('url');
    const season = parseInt(searchParams.get('s')) || 1;
    const episode = parseInt(searchParams.get('e')) || 1;

    useEffect(() => {
        const loadMovieData = async () => {
            if (isLocal && localUrl) {
                // Construct a mock offline movie object using search parameters to bypass API failures when offline
                setMovie({
                    id: id,
                    title: decodeURIComponent(searchParams.get('title') || 'Çevrimdışı Video'),
                    media_type: type,
                    backdrop_path: searchParams.get('backdrop') ? decodeURIComponent(searchParams.get('backdrop') || '') : null,
                    poster_path: searchParams.get('poster') ? decodeURIComponent(searchParams.get('poster') || '') : null,
                    localUrl: decodeURIComponent(localUrl),
                    isLocal: true
                });
                return;
            }
            
            // We need basic movie info for the player (title, backdrop etc)
            const data = await fetchTMDB(`/${type}/${id}`);
            if (data) {
                setMovie({ ...data, media_type: type });
            }
        };
        loadMovieData();
    }, [type, id, isLocal, localUrl, searchParams]);

    const handleClose = () => {
        if (location.state?.from) {
            navigate(location.state.from, {
                replace: true,
                state: location.state?.detailFrom ? { from: location.state.detailFrom } : null
            });
        }
        else navigate(-1);
    };

    if (!movie) {
        return <div style={{ background: 'black', height: '100dvh', width: '100vw' }} />;
    }

    return (
        <div id="player-container" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'black', height: '100dvh', width: '100vw' }}>
            <Player
                movie={movie}
                initialSeason={season}
                initialEpisode={episode}
                onClose={handleClose}
            />
        </div>
    );
};

export default PlayerPage;
