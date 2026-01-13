import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTMDB } from '../hooks/useAppLogic';
import { DetailModal } from '../components/Modals';

const DetailPage = () => {
    const { type, id } = useParams();
    const navigate = useNavigate();
    const [movie, setMovie] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDetail = async () => {
            setLoading(true);
            const endpoint = `/${type}/${id}?append_to_response=credits,similar,videos,external_ids&include_video_language=tr,en`;
            const data = await fetchTMDB(endpoint);
            if (data) {
                // Ensure media_type is set for consistency
                setMovie({ ...data, media_type: type });
            }
            setLoading(false);
        };
        if (type && id) {
            loadDetail();
        }
    }, [type, id]);

    const handleClose = () => {
        navigate(-1);
    };

    const handlePlay = (m, s, e) => {
        navigate(`/play/${type}/${id}?s=${s}&e=${e}`);
    };

    const handleOpenDetail = (m) => {
        const newType = m.media_type || (m.first_air_date ? 'tv' : 'movie');
        navigate(`/watch/${newType}/${m.id}`);
    };

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
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
            isPage={true} // Hint to component that it's acting as a page
        />
    );
};

export default DetailPage;
