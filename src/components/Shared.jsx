import React, { memo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { isWatched } from '../hooks/useAppLogic';
import { useNavigate } from 'react-router-dom';

export const BASE_IMG = "https://image.tmdb.org/t/p/w500";
export const POSTER_IMG = "https://image.tmdb.org/t/p/w780";
export const BACKDROP_IMG = "https://image.tmdb.org/t/p/w1280";
export const ORIGINAL_IMG = "https://image.tmdb.org/t/p/original";

// Global cache for loaded image URLs to prevent re-fetching/fading
// We limit this set size to prevent memory leaks on weak devices
const loadedImageUrls = new Set();
const MAX_CACHE_SIZE = 100;

export const SmartImage = memo(({ src, alt, style, className }) => {
    // Only check cache for initial "fade-in" logic, not for keeping it in DOM
    const isCached = loadedImageUrls.has(src);
    const [loaded, setLoaded] = useState(isCached);
    const [error, setError] = useState(false);
    const [isVisible, setIsVisible] = useState(false); // Controls <img> rendering
    const containerRef = useRef(null);

    useEffect(() => {
        setLoaded(loadedImageUrls.has(src));
        setError(false);
    }, [src]);

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // Buffer zone: unload if far away, load if close
                setIsVisible(entry.isIntersecting);
            });
        }, {
            rootMargin: '600px 0px 600px 0px' // Keep images loaded within ~2 screens height/width
        });

        observer.observe(containerRef.current);

        return () => {
            if (observer) observer.disconnect();
        };
    }, []);

    const handleLoad = () => {
        setLoaded(true);
        if (src) {
            loadedImageUrls.add(src);
            if (loadedImageUrls.size > MAX_CACHE_SIZE) {
                // Simple cache prune
                const it = loadedImageUrls.values();
                loadedImageUrls.delete(it.next().value);
            }
        }
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
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: '2rem'
                }}>
                    <i className="fas fa-film"></i>
                </div>
            )}
            {isVisible && (
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
                        transition: isCached ? 'none' : 'opacity 0.5s ease-out, transform 0.5s ease-out',
                        transform: loaded ? 'scale(1)' : 'scale(1.03)',
                        willChange: 'opacity, transform' // GPU Hint
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

export const NavBar = memo(({ activeTab, onLogout, className, style }) => {
    const navigate = useNavigate();
    const menuRef = useRef(null);
    const buttonsRef = useRef({});
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
    const [hoveredTab, setHoveredTab] = useState(null);

    useLayoutEffect(() => {
        const updateIndicator = (tabId) => {
            const button = buttonsRef.current[tabId];
            const menu = menuRef.current;
            if (button && menu) {
                const menuRect = menu.getBoundingClientRect();
                const buttonRect = button.getBoundingClientRect();
                setIndicatorStyle({
                    left: buttonRect.left - menuRect.left,
                    width: buttonRect.width,
                    opacity: 1
                });
            }
        };

        const targetTab = hoveredTab || activeTab;
        updateIndicator(targetTab);
    }, [activeTab, hoveredTab]);

    const getButtonScale = (itemId) => {
        const targetTab = hoveredTab || activeTab;
        if (itemId === targetTab) return 1.02;

        const targetIndex = NAV_ITEMS.findIndex(i => i.id === targetTab);
        const currentIndex = NAV_ITEMS.findIndex(i => i.id === itemId);
        const distance = Math.abs(targetIndex - currentIndex);

        if (distance === 1) return 0.97;
        return 0.94;
    };

    const getButtonOpacity = (itemId) => {
        const targetTab = hoveredTab || activeTab;
        if (itemId === targetTab) return 1;

        const targetIndex = NAV_ITEMS.findIndex(i => i.id === targetTab);
        const currentIndex = NAV_ITEMS.findIndex(i => i.id === itemId);
        const distance = Math.abs(targetIndex - currentIndex);

        if (distance === 1) return 0.7;
        return 0.5;
    };

    const handleNav = (item) => {
        navigate(item.path);
    };

    return (
        <nav
            className={`navbar-container ${className || ''}`}
            style={style}
        >
            <div className="nav-logo">
                <img src="/noxis-logo.svg" alt="Noxis" style={{ height: '28px', width: 'auto' }} />
            </div>

            <div className="nav-menu" ref={menuRef}>
                <div
                    className="nav-indicator"
                    style={{
                        position: 'absolute',
                        top: '4px',
                        bottom: '4px',
                        left: indicatorStyle.left,
                        width: indicatorStyle.width,
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.12) 100%)',
                        borderRadius: '18px',
                        border: '1px solid rgba(255,255,255,0.30)',
                        boxShadow: '0 0 20px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.25)',
                        transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                        opacity: indicatorStyle.opacity,
                        pointerEvents: 'none',
                        zIndex: 0,
                        overflow: 'hidden'
                    }}
                >
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '45%',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, transparent 100%)',
                        borderRadius: '18px 18px 50% 50%',
                        pointerEvents: 'none'
                    }} />
                </div>

                {NAV_ITEMS.map(item => (
                    <button
                        key={item.id}
                        ref={el => buttonsRef.current[item.id] = el}
                        tabIndex="0"
                        onClick={() => handleNav(item)}
                        onMouseEnter={() => setHoveredTab(item.id)}
                        onMouseLeave={() => setHoveredTab(null)}
                        className="focusable nav-btn"
                        style={{
                            transform: `scale(${getButtonScale(item.id)})`,
                            opacity: getButtonOpacity(item.id),
                            color: (hoveredTab === item.id || activeTab === item.id) ? 'white' : 'rgba(255,255,255,0.65)',
                            fontWeight: (hoveredTab === item.id || activeTab === item.id) ? 700 : 600,
                            zIndex: 1
                        }}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="nav-profile">
                {onLogout && (
                    <button
                        onClick={onLogout}
                        className="nav-logout-btn"
                        title="Çıkış Yap"
                    >
                        <i className="fas fa-power-off"></i>
                    </button>
                )}
            </div>
        </nav>
    );
});

export const MobileNav = memo(({ activeTab, onLogout }) => {
    const navigate = useNavigate();
    return (
        <nav className="mobile-nav">
            {NAV_ITEMS.map(item => (
                <button
                    key={item.id}
                    onClick={() => navigate(item.path)}
                    className={`mobile-nav-btn ${activeTab === item.id ? 'active' : ''}`}
                >
                    <i className={item.icon}></i>
                    <span>{item.label}</span>
                </button>
            ))}
            {onLogout && (
                <button
                    onClick={onLogout}
                    className="mobile-nav-btn mobile-logout-btn"
                    title="Çıkış Yap"
                >
                    <i className="fas fa-power-off"></i>
                    <span>Çıkış</span>
                </button>
            )}
        </nav>
    );
});

export const Card = memo(({ movie, onSelect, layout = 'portrait', progress = 0 }) => {
    const isLandscape = layout === 'landscape';
    const imgPath = isLandscape
        ? (movie.backdrop_path || movie.poster_path)
        : (movie.poster_path || movie.backdrop_path);
    const watched = isWatched(movie.id, movie.season, movie.episode);
    const hasValidImage = imgPath && imgPath !== 'null' && imgPath !== 'undefined';

    return (
        <button
            tabIndex="0"
            onClick={() => onSelect(movie)}
            className={`poster-card focusable ${isLandscape ? 'card-landscape' : 'card-portrait'}`}
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
            {hasValidImage ? (
                <SmartImage
                    src={isLandscape ? BACKDROP_IMG + imgPath : POSTER_IMG + imgPath}
                    alt={movie.title || movie.name}
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
            <div className="card-overlay">
                <span className="card-title">{movie.title || movie.name}</span>
            </div>
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
