import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { useTvRemote } from './hooks/useTvRemote';
import { TvTopNav } from './components/TvTopNav';
import { TvErrorBoundary } from './components/TvErrorBoundary';
import TvHomePage from './pages/TvHomePage';
import TvSearchPage from './pages/TvSearchPage';
import TvCategoryPage from './pages/TvCategoryPage';
import TvDetailPage from './pages/TvDetailPage';
import TvAuthPage from './pages/TvAuthPage';

import { syncFromBackend } from '../utils/watchHistory';

import './tv-base.css';
import './tv.css';

const TvPlayerPage = lazy(() => import('./pages/TvPlayerPage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));
const DesktopDownloadsPage = lazy(() => import('../pages/DesktopDownloadsPage'));
const PartyRoom = lazy(() => import('../scenes/party/PartyRoom'));

const API_URL = getApiBaseUrl();
const AUTH_TOKEN_KEY = 'noxis_auth_token';
const AUTH_USER_KEY = 'noxis_user';
const AUTH_VERIFIED_AT_KEY = 'noxis_auth_verified_at';
const VERIFY_INTERVAL_MS = 5 * 60 * 1000;
const OFFLINE_AUTH_GRACE_MS = 24 * 60 * 60 * 1000;

const scheduleIdle = (callback, timeout = 5000) => {
    if (typeof window === 'undefined') return undefined;
    if ('requestIdleCallback' in window) {
        const id = window.requestIdleCallback(callback, { timeout });
        return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(callback, timeout);
    return () => window.clearTimeout(id);
};

const TvLoading = ({ label = 'Noxis hazırlanıyor' }) => (
    <div className="tv-loading-shell" role="status" aria-live="polite">
        <i className="fas fa-circle-notch fa-spin" />
        <span>{label}</span>
    </div>
);

const ProtectedRoute = ({ authStatus, children }) => {
    if (authStatus === 'checking') return <TvLoading label="Oturum doğrulanıyor" />;
    return authStatus === 'authenticated' ? children : <Navigate to="/auth" replace />;
};

const TvApp = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const locationRef = useRef(location);
    locationRef.current = location;
    const lastVerifiedAtRef = useRef(Number(localStorage.getItem(AUTH_VERIFIED_AT_KEY)) || 0);
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
        } catch {
            return null;
        }
    });
    const [authStatus, setAuthStatus] = useState(() => (
        localStorage.getItem(AUTH_TOKEN_KEY) ? 'checking' : 'anonymous'
    ));
    const [authRevision, setAuthRevision] = useState(0);
    const isAuthenticated = authStatus === 'authenticated';
    const isAuthPage = location.pathname === '/auth';
    const isPlayerOpen = location.pathname.startsWith('/play');
    const isFullscreen = isAuthPage || isPlayerOpen || location.pathname.startsWith('/watch') || location.pathname.startsWith('/party');

    useTvRemote({ enabled: !isPlayerOpen });

    useEffect(() => {
        document.documentElement.classList.add('noxis-webos-root');
        document.body.classList.add('tv-mode');
        return () => {
            document.documentElement.classList.remove('noxis-webos-root');
            document.body.classList.remove('tv-mode');
        };
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return undefined;
        syncFromBackend();
        return scheduleIdle(() => import('./pages/TvPlayerPage'), 5000);
    }, [isAuthenticated]);

    useEffect(() => {
        const requestVerification = () => setAuthRevision((value) => value + 1);
        const verifyAfterLongPause = () => {
            if (Date.now() - lastVerifiedAtRef.current >= VERIFY_INTERVAL_MS) requestVerification();
        };
        window.addEventListener('noxis-auth-changed', requestVerification);
        window.addEventListener('focus', verifyAfterLongPause);
        return () => {
            window.removeEventListener('noxis-auth-changed', requestVerification);
            window.removeEventListener('focus', verifyAfterLongPause);
        };
    }, []);

    useEffect(() => {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (!token) {
            setAuthStatus('anonymous');
            setUser(null);
            return undefined;
        }

        let cancelled = false;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 12000);
        if (authStatus !== 'authenticated') setAuthStatus('checking');

        const verify = async () => {
            try {
                const response = await fetch(`${API_URL}/api/auth/verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ token }),
                    signal: controller.signal
                });
                const data = await response.json().catch(() => ({}));
                if (cancelled) return;

                if (response.ok && data.success) {
                    lastVerifiedAtRef.current = Date.now();
                    localStorage.setItem(AUTH_VERIFIED_AT_KEY, String(lastVerifiedAtRef.current));
                    setAuthStatus('authenticated');
                    setUser(data.user || null);
                    if (data.user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
                    if (locationRef.current.pathname === '/auth') navigate('/', { replace: true });
                    return;
                }

                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem(AUTH_TOKEN_KEY);
                    localStorage.removeItem(AUTH_USER_KEY);
                    localStorage.removeItem(AUTH_VERIFIED_AT_KEY);
                    setAuthStatus('anonymous');
                    setUser(null);
                    if (locationRef.current.pathname !== '/auth') navigate('/auth', { replace: true });
                    return;
                }

                const hasRecentVerification = Date.now() - lastVerifiedAtRef.current < OFFLINE_AUTH_GRACE_MS;
                setAuthStatus(hasRecentVerification ? 'authenticated' : 'anonymous');
                if (!hasRecentVerification && locationRef.current.pathname !== '/auth') {
                    navigate('/auth', { replace: true });
                }
            } catch (error) {
                if (!cancelled) {
                    console.warn('[Noxis TV] Session verify deferred', error);
                    const hasRecentVerification = Date.now() - lastVerifiedAtRef.current < OFFLINE_AUTH_GRACE_MS;
                    setAuthStatus(hasRecentVerification ? 'authenticated' : 'anonymous');
                    if (!hasRecentVerification && locationRef.current.pathname !== '/auth') {
                        navigate('/auth', { replace: true });
                    }
                }
            } finally {
                window.clearTimeout(timeout);
            }
        };

        verify();
        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [authRevision, navigate]);

    const handleLogout = useCallback(() => {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (token) {
            fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ token })
            }).catch(() => {});
        }
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_VERIFIED_AT_KEY);
        setAuthStatus('anonymous');
        setUser(null);
        navigate('/auth', { replace: true });
    }, [navigate]);

    return (
        <div className={`tv-web-shell ${isFullscreen ? 'tv-web-shell-fullscreen' : ''}`}>
            {isAuthenticated && !isFullscreen && <TvTopNav onLogout={handleLogout} user={user} />}

            <main className="tv-web-content">
                <TvErrorBoundary
                    resetKey={`${location.pathname}${location.search}`}
                    onReset={() => navigate('/', { replace: true })}
                >
                    <Suspense fallback={<TvLoading label="Noxis yükleniyor..." />}>
                        <Routes location={location}>
                            <Route path="/auth" element={<TvAuthPage />} />
                            <Route path="/" element={<ProtectedRoute authStatus={authStatus}><TvHomePage /></ProtectedRoute>} />
                            <Route path="/search" element={<ProtectedRoute authStatus={authStatus}><TvSearchPage /></ProtectedRoute>} />
                            <Route path="/movies" element={<ProtectedRoute authStatus={authStatus}><TvCategoryPage type="movie" /></ProtectedRoute>} />
                            <Route path="/series" element={<ProtectedRoute authStatus={authStatus}><TvCategoryPage type="tv" /></ProtectedRoute>} />
                            <Route path="/watch/:type/:id" element={<ProtectedRoute authStatus={authStatus}><TvDetailPage /></ProtectedRoute>} />
                            <Route path="/play/:type/:id" element={<ProtectedRoute authStatus={authStatus}><TvPlayerPage /></ProtectedRoute>} />
                            <Route path="/admin" element={<ProtectedRoute authStatus={authStatus}><AdminPage /></ProtectedRoute>} />
                            <Route path="/downloads" element={<ProtectedRoute authStatus={authStatus}><DesktopDownloadsPage /></ProtectedRoute>} />
                            <Route path="/party" element={<ProtectedRoute authStatus={authStatus}><PartyRoom /></ProtectedRoute>} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Suspense>
                </TvErrorBoundary>
            </main>
        </div>
    );
};

export default TvApp;
