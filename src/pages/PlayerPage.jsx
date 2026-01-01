import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Player } from '../components/Modals';
import { fetchTMDB } from '../hooks/useAppLogic';

const PlayerPage = () => {
    const { type, id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [movie, setMovie] = useState(null);
    
    const season = parseInt(searchParams.get('s')) || 1;
    const episode = parseInt(searchParams.get('e')) || 1;

    useEffect(() => {
        const loadMovieData = async () => {
             // We need basic movie info for the player (title, backdrop etc)
             const data = await fetchTMDB(`/${type}/${id}`);
             if (data) {
                 setMovie({ ...data, media_type: type });
             }
        };
        loadMovieData();
    }, [type, id]);

    const handleClose = () => {
        navigate(-1);
    };

    if (!movie) {
        return <div style={{ background: 'black', height: '100vh', width: '100vw' }} />;
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'black' }}>
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
