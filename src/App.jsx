import React, { useState, Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { NavBar, MobileNav } from './components/Shared';
import IntroAnimation from './components/IntroAnimation';
import './index.css';

// Lazy Load Pages
const HomePage = lazy(() => import('./pages/HomePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const DetailPage = lazy(() => import('./pages/DetailPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));

import { useTVNavigation, useGamepadNavigation, useSmartMouse } from './hooks/useAppLogic';

const App = () => {
    const location = useLocation();
    const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('noxis_intro_seen'));
    const [activeTab, setActiveTab] = useState('Ana Sayfa'); // For Navbar highlighting

    // TV Navigation Hooks
    const isPlayerOpen = location.pathname.startsWith('/play');
    const isModalOpen = location.pathname.startsWith('/watch');

    // --- API URL OVERRIDE LOGIC ---
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tunnelUrl = params.get('t');
        if (tunnelUrl) {
            console.log('[App] New API URL detected:', tunnelUrl);
            localStorage.setItem('noxis_api_url', tunnelUrl);
            // Clean URL
            window.history.replaceState({}, '', location.pathname);
            // Reload to apply changes immediately if needed, or just let the components pick it up
            window.location.reload(); 
        }
    }, [location.search, location.pathname]);

    useTVNavigation(isModalOpen, isPlayerOpen);
    useGamepadNavigation();
    useSmartMouse(); // Hides cursor when inactive

    // Sync activeTab with location
    React.useEffect(() => {
        const path = location.pathname;
        if (path === '/') setActiveTab('Ana Sayfa');
        else if (path === '/search') setActiveTab('Ara');
        else if (path.startsWith('/movies')) setActiveTab('Filmler');
        else if (path.startsWith('/series')) setActiveTab('Diziler');
    }, [location]);

    const handleIntroComplete = () => {
        sessionStorage.setItem('noxis_intro_seen', 'true');
        setShowIntro(false);
    };

    const handleLogout = () => {
        // Implement logout logic if needed
        console.log("Logout triggered");
    };

    return (
        <>
            {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}

            <div className="app-container" style={{
                background: 'var(--bg-primary)',
                height: '100dvh', // Fixed height
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden' // Prevent double scrollbars
            }}>
                <NavBar activeTab={activeTab} onLogout={handleLogout} />
                <MobileNav activeTab={activeTab} onLogout={handleLogout} />

                <div className="content-wrapper" style={{
                    flex: 1,
                    paddingTop: '60px',
                    overflowY: 'auto', // Enable vertical scrolling
                    overflowX: 'hidden',
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch' // iOS momentum scrolling
                }}>
                    <Suspense fallback={
                        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                            <i className="fas fa-circle-notch fa-spin fa-2x"></i>
                        </div>
                    }>
                        <AnimatePresence mode="wait">
                            <Routes location={location} key={location.pathname}>
                                <Route path="/" element={<PageWrapper><HomePage /></PageWrapper>} />
                                <Route path="/search" element={<PageWrapper><SearchPage /></PageWrapper>} />
                                <Route path="/movies" element={<PageWrapper><CategoryPage type="movie" /></PageWrapper>} />
                                <Route path="/series" element={<PageWrapper><CategoryPage type="tv" /></PageWrapper>} />
                                <Route path="/watch/:type/:id" element={<DetailPage />} />
                                <Route path="/play/:type/:id" element={<PlayerPage />} />
                            </Routes>
                        </AnimatePresence>
                    </Suspense>
                </div>

                {/* Global Magnet Button Removed */}
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
        style={{ minHeight: '100%' }} // Ensure full height for scrolling
    >
        {children}
    </motion.div>
);

export default App;