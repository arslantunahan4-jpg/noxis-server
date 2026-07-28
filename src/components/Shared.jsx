import React, { memo, useState, useRef, useEffect } from 'react';
import { isWatched } from '../hooks/useAppLogic';
import { useNavigate } from 'react-router-dom';

// PERFORMANCE: TMDB görsel boyutları optimize edildi
// w342: Poster kartları için (eskiden w500 - %32 tasarruf)
// w780: Backdrop'lar için (eskiden w1280 - %39 tasarruf)
// Mobil cihazlarda daha da küçük boyutlar kullanılabilir
export const BASE_IMG = "https://image.tmdb.org/t/p/w185";      // Küçük kartlar için
export const POSTER_IMG = "https://image.tmdb.org/t/p/w342";    // Poster kartları
export const BACKDROP_IMG = "https://image.tmdb.org/t/p/w780";  // Backdrop görselleri
export const ORIGINAL_IMG = "https://image.tmdb.org/t/p/w1280"; // Sadece detay sayfası için

// PERFORMANCE: Responsive görsel URL'leri - cihaz genişliğine göre otomatik seçim
export const getResponsivePosterUrl = (path, width = window.innerWidth) => {
    if (!path) return null;
    // Mobil: w185, Tablet: w342, Desktop: w500
    const size = width < 480 ? 'w185' : width < 1024 ? 'w342' : 'w500';
    return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const getResponsiveBackdropUrl = (path, width = window.innerWidth) => {
    if (!path) return null;
    // Mobil: w300, Tablet: w780, Desktop: w1280
    const size = width < 480 ? 'w300' : width < 1024 ? 'w780' : 'w1280';
    return `https://image.tmdb.org/t/p/${size}${path}`;
};

const MAX_CACHE_SIZE = 100;
const loadedImageUrls = new Map();

const addToCache = (src) => {
    if (!src) return;
    if (loadedImageUrls.size >= MAX_CACHE_SIZE) {
        const firstKey = loadedImageUrls.keys().next().value;
        loadedImageUrls.delete(firstKey);
    }
    loadedImageUrls.set(src, true);
};

const visibilityCallbacks = new Map();
const globalObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach(entry => {
            const callback = visibilityCallbacks.get(entry.target);
            if (callback) callback(entry.isIntersecting);
        });
    },
    { rootMargin: '800px 0px 800px 0px', threshold: 0.01 }
);

export const SmartImage = memo(({ src, alt, style, className }) => {
    const isCached = loadedImageUrls.has(src);
    const [loaded, setLoaded] = useState(isCached);
    const [error, setError] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        visibilityCallbacks.set(el, setIsVisible);
        globalObserver.observe(el);

        return () => {
            globalObserver.unobserve(el);
            visibilityCallbacks.delete(el);
        };
    }, []);

    useEffect(() => {
        setLoaded(loadedImageUrls.has(src));
        setError(false);
    }, [src]);

    const handleLoad = () => {
        setLoaded(true);
        addToCache(src);
    };

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                ...style,
                position: 'relative',
                backgroundColor: '#0a0a0a',
                overflow: 'hidden'
            }}
        >
            {(!loaded || !isVisible) && !error && (
                <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />
            )}

            {error && (
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.3)', fontSize: '2rem'
                }}>
                    <i className="fas fa-film"></i>
                </div>
            )}

            {isVisible && !error && (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    onLoad={handleLoad}
                    onError={() => setError(true)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: loaded ? 1 : 0,
                        transition: isCached ? 'none' : 'opacity 0.4s ease-out',
                    }}
                />
            )}
        </div>
    );
});

const NAV_ITEMS = [
    { id: 'Ana Sayfa', icon: 'fas fa-home', label: 'Ana Sayfa', path: '/' },
    { id: 'Filmler', icon: 'fas fa-film', label: 'Filmler', path: '/movies' },
    { id: 'Diziler', icon: 'fas fa-tv', label: 'Diziler', path: '/series' },
    { id: 'Ara', icon: 'fas fa-search', label: 'Ara', path: '/search' }
];

export const NavBar = memo(({ activeTab, onLogout, className, style, user }) => {
    const navigate = useNavigate();

    const navItems = React.useMemo(() => {
        const items = [...NAV_ITEMS];
        if (user?.role === 'admin') items.push({ id: 'Admin', icon: 'fas fa-user-shield', label: 'Admin', path: '/admin' });
        if (window.NoxisDesktop || window.NoxisAppBridge || window.AndroidBridge) {
            items.push({ id: 'Downloads', icon: 'fas fa-download', label: 'İndirilenler', isBridgeCall: true });
        }
        return items;
    }, [user?.role]);

    const handleNav = (item) => {
        if (item.isBridgeCall) {
            if (window.NoxisDesktop) return navigate('/downloads');
            const bridge = window.NoxisAppBridge || window.AndroidBridge;
            if (bridge) bridge.openDownloads();
            return;
        }
        navigate(item.path);
    };

    return (
        <header className={`tv-top-nav ${className || ''}`} style={style}>
            <button type="button" className="focusable tv-brand" onClick={() => navigate('/')} aria-label="Noxis ana sayfa">
                <img src="/noxis-logo.svg" alt="" />
                <span>NOXIS</span>
            </button>
            <nav className="tv-nav-tabs" aria-label="Navigasyon">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`focusable tv-nav-tab ${activeTab === item.id ? 'active' : ''}`}
                        onClick={() => handleNav(item)}
                    >
                        <i className={item.icon} aria-hidden="true" />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
            <div className="tv-nav-profile">
                {user?.username && <span className="tv-nav-user">{user.username}</span>}
                {onLogout ? (
                    <button type="button" onClick={onLogout} className="focusable tv-nav-icon" title="Çıkış Yap" aria-label="Oturumu kapat">
                        <i className="fas fa-sign-out-alt" />
                    </button>
                ) : (
                    <button type="button" onClick={() => navigate('/auth')} className="focusable tv-nav-icon" title="Giriş Yap" aria-label="Giriş Yap">
                        <i className="fas fa-user" />
                    </button>
                )}
            </div>
        </header>
    );
});

export const MobileNav = memo(({ activeTab, onLogout, user }) => {
    const navigate = useNavigate();
    const navItems = React.useMemo(() => {
        const items = [...NAV_ITEMS];
        if (user?.role === 'admin') {
            items.push({ id: 'Admin', icon: 'fas fa-user-shield', label: 'Admin', path: '/admin' });
        }
        if (window.NoxisDesktop || window.NoxisAppBridge || window.AndroidBridge) {
            items.push({ id: 'Downloads', icon: 'fas fa-download', label: 'İndirilenler', isBridgeCall: true });
        }
        return items;
    }, [user?.role]);

    const handleNav = (item) => {
        if (item.isBridgeCall) {
            if (window.NoxisDesktop) {
                navigate('/downloads');
                return;
            }
            const bridge = window.NoxisAppBridge || window.AndroidBridge;
            if (bridge) bridge.openDownloads();
            return;
        }
        navigate(item.path);
    };

    return (
        <nav className="mobile-nav">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => handleNav(item)}
                    className={`mobile-nav-btn ${activeTab === item.id ? 'active' : ''}`}
                >
                    <i className={item.icon}></i>
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    );
});

const formatEpisodeMeta = (season, episode) => {
    if (!season || !episode) return null;
    return `${season}. Sezon • ${episode}. Bölüm`;
};

export const Card = memo(({
    movie,
    onSelect,
    layout = 'portrait',
    progress = 0,
    rowKey = 'row',
    index = 0,
    onFocusItem,
    isSpotlight = false
}) => {
    const isLandscape = layout === 'landscape';
    const imgPath = isLandscape
        ? (movie.backdrop_path || movie.poster_path)
        : (movie.poster_path || movie.backdrop_path);
    const watched = isWatched(movie.id, movie.season, movie.episode);
    const hasValidImage = imgPath && imgPath !== 'null' && imgPath !== 'undefined';
    const episodeMeta = formatEpisodeMeta(movie.season, movie.episode);
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const title = movie.title || movie.name || 'İçerik';
    const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    const rating = Number(movie.vote_average || 0).toFixed(1);

    return (
        <button
            tabIndex="0"
            onClick={() => onSelect(movie)}
            onFocus={() => onFocusItem?.(movie, index)}
            onMouseEnter={() => onFocusItem?.(movie, index)}
            className={`focusable tv-card tv-card-${isLandscape ? 'landscape' : 'portrait'} ${isSpotlight ? 'tv-card-active' : ''}`}
            data-focus-id={`${rowKey}-${movie.id}-${index}`}
            data-tv-focus-index={index}
        >
            {watched && (
                <div className="watched-badge">
                    <i className="fas fa-check"></i>
                    <span>İzlendi</span>
                </div>
            )}
            {progress > 0 && !watched && (
                <div className="continue-progress">
                    <div className="continue-progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
            )}
            <span className="tv-card-media">
            {hasValidImage ? (
                <SmartImage
                    src={isLandscape ? "https://image.tmdb.org/t/p/w780" + imgPath : POSTER_IMG + imgPath}
                    alt={title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)',
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: '2.5rem'
                }}>
                    <i className="fas fa-film"></i>
                </div>
            )}
            </span>
            <span className="tv-card-shade" />
            <span className="tv-card-focus-layer"><i className="fas fa-play" /></span>
            <span className="tv-card-copy">
                <span className="tv-card-title">
                    {title}
                </span>
                <span className="tv-card-meta">
                    {year && <span>{year}</span>}
                    <span>{mediaType === 'tv' ? 'Dizi' : 'Film'}</span>
                    {Number(movie.vote_average) > 0 && <span><i className="fas fa-star" /> {rating}</span>}
                    {episodeMeta && <span>{episodeMeta}</span>}
                </span>
            </span>
        </button>
    );
});

export const SkeletonRow = () => (
    <div className="row-wrapper" style={{ marginBottom: '3rem' }}>
        <div
            className="skeleton"
            style={{
                width: '18rem',
                height: '1.8rem',
                marginBottom: '1.2rem',
                borderRadius: '8px'
            }}
        />
        <div className="row-scroll-container" style={{ overflow: 'hidden' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div
                    key={i}
                    className="skeleton card-portrait"
                    style={{ flexShrink: 0 }}
                />
            ))}
        </div>
    </div>
);
