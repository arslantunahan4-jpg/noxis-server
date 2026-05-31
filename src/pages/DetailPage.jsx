import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { fetchTMDB } from '../hooks/useAppLogic';
import { DetailModal } from '../components/Modals';

const DetailPage = () => {
    const { type, id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [movie, setMovie] = useState(null);
    const [loading, setLoading] = useState(true);
    const detailPath = `${location.pathname}${location.search}`;
    const returnPath = location.state?.from || null;

    const autoPlay = searchParams.get('autoplay') === '1';
    const autoSeason = parseInt(searchParams.get('s')) || 1;
    const autoEpisode = parseInt(searchParams.get('e')) || 1;

    useEffect(() => {
        if (autoPlay && type && id) {
            navigate(`/play/${type}/${id}?s=${autoSeason}&e=${autoEpisode}`, {
                replace: true,
                state: { from: returnPath }
            });
            return;
        }

        const loadDetail = async () => {
            setLoading(true);
            const endpoint = `/${type}/${id}?append_to_response=credits,similar,videos,external_ids&include_video_language=tr,en`;
            const data = await fetchTMDB(endpoint);
            if (data) {
                setMovie({ ...data, media_type: type });
            }
            setLoading(false);
        };
        
        if (type && id && !autoPlay) {
            loadDetail();
        }
    }, [type, id, autoPlay, autoSeason, autoEpisode, navigate]);

    const handleClose = () => {
        if (returnPath) navigate(returnPath);
        else navigate(-1);
    };

    const handlePlay = (m, s, e) => {
        navigate(`/play/${type}/${id}?s=${s}&e=${e}`, {
            state: {
                from: detailPath,
                detailFrom: returnPath
            }
        });
    };

    const handleOpenDetail = (m) => {
        const newType = m.media_type || (m.first_air_date ? 'tv' : 'movie');
        navigate(`/watch/${newType}/${m.id}`, {
            state: { from: detailPath }
        });
    };

    if (loading) {
        return (
            <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <i className="fas fa-spinner fa-spin fa-2x"></i>
            </div>
        );
    }

    if (!movie) {
        return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>İçerik bulunamadı</div>;
    }

    // Reuse the existing DetailModal UI but adapting it to be a full page wrapper effectively
    // Since DetailModal was designed as a modal, we pass a dummy onClose or handle navigation properly.
    return (
        <DetailModal
            movie={movie}
            onClose={handleClose}
            onPlay={handlePlay}
            onOpenDetail={handleOpenDetail}
            isPage={true}
            autoPlay={autoPlay}
            autoSeason={autoSeason}
            autoEpisode={autoEpisode}
        />
    );
};

export default DetailPage;
