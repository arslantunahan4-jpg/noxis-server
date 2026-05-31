import React, { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { GlassPlayer } from '../../components/player/GlassPlayer';
import { fetchTMDB } from '../../hooks/useAppLogic';
import { usePartySocket } from '../../hooks/usePartySocket';
import { useStreamResolver } from '../../hooks/useStreamResolver';
import { API_URL } from '../../config/party';
import { buildVidmodyExternalAudioTracks } from '../../utils/vidmody';
import '../../components/player/PartyRoom.css';

// Lazy load VoiceSidebar for better initial load performance
const VoiceSidebar = lazy(() => import('../../components/player/VoiceSidebar').then(module => ({ default: module.VoiceSidebar })));

// Error Fallback Component
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="party-error-screen">
    <i className="fas fa-exclamation-triangle" />
    <h2>Bir Hata Oluştu</h2>
    <p>{error.message}</p>
    <button onClick={resetErrorBoundary}>Tekrar Dene</button>
  </div>
);

const PartyRoom = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    // URL Params with validation
    const roomCode = searchParams.get('code');
    const tmdbId = searchParams.get('id');
    const type = searchParams.get('type') || 'movie';
    const season = parseInt(searchParams.get('s')) || 1;
    const episode = parseInt(searchParams.get('e')) || 1;

    // Incoming Stream URL from Navigation State (Seamless Transition)
    const incomingStreamUrl = location.state?.streamUrl;

    // State
    const [movie, setMovie] = useState(null);
    const [username, setUsername] = useState(null); 
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    // Video Stream Resolution
    const { 
        streamUrl: resolvedStreamUrl, 
        subtitles, 
        audios,
        audioSwitchStrategy,
        workingAudio,
        loading: streamLoading, 
        error: streamError 
    } = useStreamResolver(
        !incomingStreamUrl ? tmdbId : null, 
        type, season, episode
    );

    const activeStreamUrl = incomingStreamUrl || resolvedStreamUrl;
    
    const audioTracks = buildVidmodyExternalAudioTracks(audios, {
        audioSwitchStrategy,
        workingAudio
    });

    // Ref for syncing
    const videoRef = useRef(null);
    
    // Initialize Party Sync Logic
    const party = usePartySocket(videoRef, tmdbId, username);

    // Verify Auth
    useEffect(() => {
        const verifyUser = async () => {
            const token = localStorage.getItem('noxis_auth_token');
            if (!token) {
                setUsername(`Guest_${Math.floor(Math.random() * 1000)}`);
                return;
            }

            try {
                const targetUrl = `${API_URL}/api/auth/verify`;
                
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ token })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.user?.username) {
                        setUsername(data.user.username);
                    } else {
                        throw new Error("Invalid user data");
                    }
                } else {
                    throw new Error("Verify failed");
                }
            } catch (e) {
                console.error("Auth Verify Error:", e);
                // Fallback to local storage
                const storedUser = localStorage.getItem('noxis_user');
                if (storedUser) {
                    try {
                        const u = JSON.parse(storedUser);
                        setUsername(u.username);
                    } catch (err) {
                        setUsername(`Guest_${Math.floor(Math.random() * 1000)}`);
                    }
                } else {
                    setUsername(`Guest_${Math.floor(Math.random() * 1000)}`);
                }
            }
        };

        verifyUser();
    }, []);

    // Load Movie Metadata
    useEffect(() => {
        if (!tmdbId) return;
        const loadMovie = async () => {
            const data = await fetchTMDB(`/${type}/${tmdbId}`);
            if (data) {
                setMovie({ ...data, media_type: type });
            }
        };
        loadMovie();
    }, [tmdbId, type]);

    // Join room
    useEffect(() => {
        if (roomCode && party.joinRoom) {
            party.joinRoom(roomCode)
                .catch((err) => {
                    console.error('Join room error:', err);
                    party.addToast(`❌ ${err.message || 'Odaya katılınamadı'}`);
                });
        }
        return () => {
            if (party.leaveRoom) party.leaveRoom();
        };
    }, [roomCode]);

    const handleLeave = () => {
        party.leaveRoom();
        navigate(-1);
    };

    // Loading State
    const isLoading = !movie || !roomCode || username === null || (!activeStreamUrl && streamLoading);

    if (isLoading) {
        return (
            <div className="party-loading-screen">
                <i className="fas fa-circle-notch fa-spin" />
                <div>{streamLoading && !activeStreamUrl ? 'Video Kaynağı Bulunuyor...' : 'Party Odası Hazırlanıyor...'}</div>
            </div>
        );
    }

    if (!activeStreamUrl && streamError) {
        return (
            <div className="party-error-screen">
                <i className="fas fa-exclamation-triangle" />
                <h2>Video Yüklenemedi</h2>
                <p>{streamError}</p>
                <button onClick={handleLeave}>Geri Dön</button>
            </div>
        );
    }

    return (
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            <div className="party-room">
                {/* Main Video Area */}
                <div className="party-video-area">
                    <GlassPlayer
                        streamUrl={activeStreamUrl} 
                        subtitles={subtitles}
                        movieTitle={movie.title || movie.name}
                        imdbId={movie.imdb_id || movie.external_ids?.imdb_id}
                        tmdbId={movie.id}
                        mediaType={type}
                        season={season}
                        episode={episode}
                        poster={movie.poster_path}
                        backdrop={movie.backdrop_path}
                        onClose={handleLeave}
                        isEmbedded={true}
                        externalVideoRef={videoRef} 
                        partyInstance={party}
                        externalAudioTracks={audioTracks}
                    />
                </div>

                {/* Sidebar */}
                <aside className={`party-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                    <button 
                        className="sidebar-toggle"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        aria-label={isSidebarOpen ? 'Kapat' : 'Aç'}
                    >
                        <i className={`fas ${isSidebarOpen ? 'fa-chevron-right' : 'fa-users'}`} />
                    </button>

                    {isSidebarOpen && (
                        <div className="sidebar-content">
                            <header className="sidebar-header">
                                <h2>Party Room</h2>
                                <div 
                                    className="room-code" 
                                    onClick={() => navigator.clipboard.writeText(roomCode)}
                                    title="Kodu kopyala"
                                >
                                    {roomCode}
                                </div>
                                <small style={{ display: 'block', textAlign: 'center', color: '#888', marginTop: '4px' }}>
                                    Kodu arkadaşına gönder
                                </small>
                                <div className={`sync-status ${party.isHost ? 'host' : 'viewer'}`}>
                                    {party.isHost ? 'Yönetici (Host)' : 'İzleyici'} - {party.syncStatus || 'Bağlandı'}
                                </div>
                            </header>

                            {username && (
                                <Suspense fallback={<div className="voice-loading" style={{padding: '20px', textAlign: 'center'}}>Yükleniyor...</div>}>
                                    <VoiceSidebar 
                                        roomCode={roomCode}
                                        username={username}
                                        onLeave={handleLeave}
                                    />
                                </Suspense>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </ErrorBoundary>
    );
};

export default PartyRoom;
