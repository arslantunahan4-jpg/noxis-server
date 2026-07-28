import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getStoredAvatar } from '../../config/avatars';
import { ProfileModal } from '../../components/ProfileModal';

const NAV_ITEMS = [
    { id: 'home', label: 'Ana Sayfa', path: '/', icon: 'fas fa-home' },
    { id: 'movies', label: 'Filmler', path: '/movies', icon: 'fas fa-film' },
    { id: 'series', label: 'Diziler', path: '/series', icon: 'fas fa-tv' },
    { id: 'search', label: 'Ara', path: '/search', icon: 'fas fa-search' }
];

const isActive = (pathname, path) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
};

export const TvTopNav = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [avatar, setAvatar] = useState(() => getStoredAvatar());
    const [showProfileModal, setShowProfileModal] = useState(false);

    const username = user?.username || 'Misafir';
    const bgGradient = avatar?.gradient || 'linear-gradient(135deg, #e50914, #ff3b47)';

    return (
        <>
            <div className="tv-mobile-top-bar">
                <button
                    type="button"
                    className="tv-mobile-brand"
                    onClick={() => navigate('/')}
                    aria-label="Noxis ana sayfa"
                >
                    <img src="/noxis-logo.svg" alt="" />
                    <span>NOXIS</span>
                </button>
                <div
                    className="noxis-mobile-user-avatar"
                    onClick={() => setShowProfileModal(true)}
                    style={{ background: bgGradient }}
                >
                    {avatar?.url ? (
                        <img src={avatar.url} alt={username} referrerPolicy="no-referrer" />
                    ) : avatar?.icon ? (
                        <i className={avatar.icon} style={{ fontSize: '16px', color: '#fff' }} />
                    ) : (
                        <span>{username.charAt(0).toUpperCase()}</span>
                    )}
                </div>
            </div>

            <header className="tv-top-nav" data-tv-focus-group="tv-nav" data-tv-focus-axis="horizontal">
                <button
                    type="button"
                    className="focusable tv-brand"
                    data-focus-id="tv-nav-brand"
                    data-tv-focus-index="0"
                    onClick={() => navigate('/')}
                    aria-label="Noxis ana sayfa"
                >
                    <img src="/noxis-logo.svg" alt="" />
                    <span>NOXIS</span>
                </button>

                <nav className="tv-nav-tabs" aria-label="Navigasyon">
                    {NAV_ITEMS.map((item, index) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`focusable tv-nav-tab ${isActive(location.pathname, item.path) ? 'active' : ''}`}
                            data-focus-id={`tv-nav-${item.id}`}
                            data-tv-focus-index={index + 1}
                            onClick={() => {
                                if (location.pathname !== item.path) navigate(item.path);
                            }}
                        >
                            <i className={item.icon} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="tv-nav-profile">
                    <div
                        className="noxis-nav-avatar-btn"
                        onClick={() => setShowProfileModal(true)}
                        title="Profil & İstatistikler"
                        style={{ background: bgGradient }}
                    >
                        {avatar?.url ? (
                            <img src={avatar.url} alt={username} referrerPolicy="no-referrer" />
                        ) : avatar?.icon ? (
                            <i className={avatar.icon} style={{ fontSize: '18px', color: '#fff' }} />
                        ) : (
                            <span>{username.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    {user?.username && <span className="tv-nav-user">{user.username}</span>}
                    <button
                        type="button"
                        className="focusable tv-nav-icon"
                        data-focus-id="tv-nav-logout"
                        data-tv-focus-index={NAV_ITEMS.length + 1}
                        onClick={onLogout}
                        aria-label="Oturumu kapat"
                        title="Oturumu kapat"
                    >
                        <i className="fas fa-sign-out-alt" />
                        <span className="tv-mobile-logout-label">Çıkış</span>
                    </button>
                </div>
            </header>

            <ProfileModal
                isOpen={showProfileModal}
                onClose={() => {
                    setShowProfileModal(false);
                    setAvatar(getStoredAvatar());
                }}
                username={username}
            />
        </>
    );
};
