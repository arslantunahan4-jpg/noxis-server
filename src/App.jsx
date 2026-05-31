import React, { useState, Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { NavBar, MobileNav } from './components/Shared';
import IntroAnimation from './components/IntroAnimation';
import { getWatchHistory } from './utils/watchHistory';
import { getApiBaseUrl } from './utils/apiBaseUrl';
import './index.css';

const lazyRetry = (componentImport) =>
    lazy(async () => {
        try {
            return await componentImport();
        } catch (error) {
            console.error("Chunk load failed, reloading...", error);
            // Prevent infinite reload loop
            const pageReloaded = sessionStorage.getItem('page_reloaded');
            if (!pageReloaded) {
                sessionStorage.setItem('page_reloaded', 'true');
                window.location.reload();
            }
            throw error;
        }
    });

// Use lazyRetry wrapper
const HomePage = lazyRetry(() => import('./pages/HomePage'));
const SearchPage = lazyRetry(() => import('./pages/SearchPage'));
const DetailPage = lazyRetry(() => import('./pages/DetailPage'));
import PlayerPage from './pages/PlayerPage';
const CategoryPage = lazyRetry(() => import('./pages/CategoryPage'));
const AuthPage = lazyRetry(() => import('./pages/AuthPage'));
const AdminPage = lazyRetry(() => import('./pages/AdminPage'));
const PartyRoom = lazyRetry(() => import('./scenes/party/PartyRoom')); // New Party Page

import { useTVNavigation, useGamepadNavigation, useSmartMouse } from './hooks/useInputNavigation';

const API_URL = getApiBaseUrl();

const ProtectedRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('noxis_auth_token');
    if (!isAuthenticated) {
        return <AuthPage />;
    }
    return children;
};

const App = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('noxis_intro_seen'));
    const [activeTab, setActiveTab] = useState('Ana Sayfa');
    const [user, setUser] = useState(null);

    const isPlayerOpen = location.pathname.startsWith('/play');
    const isModalOpen = location.pathname.startsWith('/watch');
    const isPartyRoom = location.pathname.startsWith('/party');
    
    // Hide navigation on fullscreen player experiences (iOS Safari doesn't support Fullscreen API on divs)
    // Also hide on Detail page (/watch) as requested
    const isFullscreenRoute = isPlayerOpen || isPartyRoom || isModalOpen;
    
    const isAuthenticated = !!localStorage.getItem('noxis_auth_token');
    
    const isAuthPage = location.pathname === '/auth';

    const handleLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/auth';
    };

    useEffect(() => {
        const validateSession = async () => {
            const token = localStorage.getItem('noxis_auth_token');
            if (!token && !isAuthPage) {
                 window.location.href = '/auth';
                 return;
            }

            if (token) {
                try {
                    const res = await fetch(`${API_URL}/api/auth/verify`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify({ token: token })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success) {
                            setUser(data.user);
                        }
                    } else {
                        console.warn('Session invalid/expired - Force Logout');
                        handleLogout();
                    }
                } catch (e) {
                    console.error('Validation error', e);
                }
            }
        };
        validateSession();
    }, [isAuthPage]);

    useEffect(() => {
        const syncHistory = async () => {
            const token = localStorage.getItem('noxis_auth_token');
            if (token) {
                try {
                    const res = await fetch(`${API_URL}/api/get-history`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const cloudHistory = await res.json();
                        const localHistory = getWatchHistory();
                        
                        // Timestamp bazlı merge - her zaman en güncel olanı tut
                        const merged = { ...localHistory };
                        Object.keys(cloudHistory).forEach(key => {
                            const cloudItem = cloudHistory[key];
                            const localItem = merged[key];
                            if (!localItem || (cloudItem.updatedAt || 0) > (localItem.updatedAt || 0)) {
                                merged[key] = cloudItem;
                            }
                        });
                        localStorage.setItem('noxis_watch_history', JSON.stringify(merged));
                    }
                } catch (e) {
                    console.warn("History sync failed", e);
                }
            }
        };
        syncHistory();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tunnelUrl = params.get('t');
        if (tunnelUrl) {
            console.log('[App] New API URL detected:', tunnelUrl);
            localStorage.setItem('noxis_api_url', tunnelUrl);
            window.history.replaceState({}, '', location.pathname);
            window.location.reload(); 
        }
    }, [location.search, location.pathname]);

    // JavaScript Bridge for Android Native App Offline Player
    useEffect(() => {
        window.playOfflineVideo = (id, localVideoUrl, title, poster, backdrop, mediaType, season, episode) => {
            console.log('[NativeBridge] playOfflineVideo triggered:', id, title, localVideoUrl);
            const s = season || 1;
            const e = episode || 1;
            const type = mediaType || 'movie';
            
            // Redirect to player page with local parameters using React Router navigate (works flawlessly offline without refreshing!)
            navigate(`/play/${type}/${id}?s=${s}&e=${e}&local=true&url=${encodeURIComponent(localVideoUrl)}&title=${encodeURIComponent(title)}&poster=${encodeURIComponent(poster || '')}&backdrop=${encodeURIComponent(backdrop || '')}`);
        };

        return () => {
            window.playOfflineVideo = undefined;
        };
    }, []);

    useTVNavigation(isModalOpen, isPlayerOpen);
    useGamepadNavigation();
    useSmartMouse();

    useEffect(() => {
        const path = location.pathname;
        if (path === '/') setActiveTab('Ana Sayfa');
        else if (path === '/search') setActiveTab('Ara');
        else if (path.startsWith('/movies')) setActiveTab('Filmler');
        else if (path.startsWith('/series')) setActiveTab('Diziler');
        else if (path.startsWith('/admin')) setActiveTab('Admin'); // Fix: Add Admin tab handling
    }, [location.pathname]); // Optimization: Only depend on pathname

    const handleIntroComplete = () => {
        sessionStorage.setItem('noxis_intro_seen', 'true');
        setShowIntro(false);
    };

    return (
        <>
            {showIntro && !isAuthPage && isAuthenticated && <IntroAnimation onComplete={handleIntroComplete} />}

            <div className="app-container" style={{
                background: 'var(--bg-primary)',
                height: '100dvh',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {isAuthenticated && !isAuthPage && !isFullscreenRoute && <NavBar activeTab={activeTab} onLogout={handleLogout} user={user} />}
                {isAuthenticated && !isAuthPage && !isFullscreenRoute && <MobileNav activeTab={activeTab} onLogout={handleLogout} user={user} />}

                <div className="content-wrapper" style={{
                    flex: 1,
                    paddingTop: (isAuthenticated && !isAuthPage && !isFullscreenRoute) ? '60px' : '0', 
                    overflowY: 'auto', 
                    overflowX: 'hidden',
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch' 
                }}>
                    <Suspense fallback={
                        <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                            <i className="fas fa-circle-notch fa-spin fa-2x"></i>
                        </div>
                    }>
                        <AnimatePresence mode="wait">
                            <Routes location={location} key={location.pathname}>
                                <Route path="/auth" element={<AuthPage />} />

                                <Route path="/" element={
                                    isAuthenticated ? <PageWrapper><HomePage /></PageWrapper> : <AuthPage />
                                } />
                                <Route path="/search" element={<ProtectedRoute><PageWrapper><SearchPage /></PageWrapper></ProtectedRoute>} />
                                <Route path="/movies" element={<ProtectedRoute><PageWrapper><CategoryPage type="movie" /></PageWrapper></ProtectedRoute>} />
                                <Route path="/series" element={<ProtectedRoute><PageWrapper><CategoryPage type="tv" /></PageWrapper></ProtectedRoute>} />
                                <Route path="/watch/:type/:id" element={<ProtectedRoute><DetailPage /></ProtectedRoute>} />
                                <Route path="/play/:type/:id" element={<ProtectedRoute><PlayerPage /></ProtectedRoute>} />
                                <Route path="/party" element={<ProtectedRoute><PartyRoom /></ProtectedRoute>} />
                                <Route path="/admin/*" element={<ProtectedRoute><PageWrapper><AdminPage /></PageWrapper></ProtectedRoute>} />
                            </Routes>
                        </AnimatePresence>
                    </Suspense>
                </div>
            </div>
        </>
    );
};

const PageWrapper = ({ children }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        style={{ minHeight: '100%' }}
    >
        {children}
    </motion.div>
);

export default App;
