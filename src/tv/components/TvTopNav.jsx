import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getStoredAvatar } from '../../config/avatars';
import { ProfileModal } from '../../components/ProfileModal';
import { friendsService } from '../../utils/friendsService';
import { motion, AnimatePresence } from 'framer-motion';
import { WatchlistsModal } from '../../components/WatchlistsModal';

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

    const [notifications, setNotifications] = React.useState([]);
    const [showNotif, setShowNotif] = React.useState(false);
    const [showWatchlists, setShowWatchlists] = React.useState(false);
    const unreadCount = notifications.filter(n => !n.isRead).length;

    React.useEffect(() => {
        friendsService.getNotifications().then(res => setNotifications(res.notifications || [])).catch(() => {});
    }, []);

    const handleMarkRead = async () => {
        await friendsService.markNotificationsRead();
        setNotifications(prev => prev.map(n => ({...n, isRead: true})));
    };


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
                
                <div className="noxis-mobile-notif-bell" onClick={() => setShowWatchlists(true)} style={{ position: "relative", marginRight: "15px", cursor: "pointer" }}><i className="fas fa-list-ul" style={{ fontSize: "20px", color: "#fff" }} /></div>
                <div className="noxis-mobile-notif-bell" onClick={() => { setShowNotif(!showNotif); if(unreadCount>0) handleMarkRead(); }} style={{ position: "relative", marginRight: "15px", cursor: "pointer" }}>
                    <i className="fas fa-bell" style={{ fontSize: "20px", color: "#fff" }} />
                    {unreadCount > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "#e50914", color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "10px", fontWeight: "bold" }}>{unreadCount}</span>}
                </div>
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

                <button
                    type="button"
                    onClick={onLogout}
                    style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer', marginLeft: '10px' }}
                    aria-label="Çıkış Yap"
                >
                    <i className="fas fa-sign-out-alt" />
                </button>
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
                    
                    <div className="noxis-desktop-notif-bell" onClick={() => setShowWatchlists(true)} style={{ position: "relative", marginRight: "20px", cursor: "pointer", display: "flex", alignItems: "center" }}><i className="fas fa-list-ul" style={{ fontSize: "22px", color: "rgba(255,255,255,0.8)", transition: "color 0.2s" }} /></div>
                    <div className="noxis-desktop-notif-bell" onClick={() => { setShowNotif(!showNotif); if(unreadCount>0) handleMarkRead(); }} style={{ position: "relative", marginRight: "20px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <i className="fas fa-bell" style={{ fontSize: "22px", color: "rgba(255,255,255,0.8)", transition: "color 0.2s" }} />
                        {unreadCount > 0 && <span style={{ position: "absolute", top: "-5px", right: "-10px", background: "#e50914", color: "#fff", fontSize: "11px", padding: "2px 6px", borderRadius: "10px", fontWeight: "bold" }}>{unreadCount}</span>}
                    </div>
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
        
            <AnimatePresence>
                {showNotif && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }}
                        style={{ position: 'fixed', top: '70px', right: '20px', width: '340px', background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', zIndex: 10000, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
                    >
                        <div style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold' }}>Bildirimler</div>
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {notifications.length === 0 ? (
                                <div style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Bildirim yok.</div>
                            ) : (
                                notifications.map(n => (
                                    <div key={n._id} style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '15px', alignItems: 'flex-start', background: n.isRead ? 'transparent' : 'rgba(229,9,20,0.05)' }}>
                                        {n.data?.posterPath && <img src={`https://image.tmdb.org/t/p/w92${n.data.posterPath}`} style={{ width: '40px', borderRadius: '4px' }} />}
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: '0 0 5px 0', fontSize: '13px', lineHeight: '1.4' }}>
                                                <strong style={{ color: '#e50914' }}>{n.sender?.username}</strong> sana <strong>{n.data?.title}</strong> izlemeni önerdi.
                                            </p>
                                            {n.data?.message && <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>"{n.data.message}"</p>}
                                            <button onClick={() => navigate(`/${n.data?.mediaType}/${n.data?.tmdbId}`)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Hemen Aç</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <WatchlistsModal isOpen={showWatchlists} onClose={() => setShowWatchlists(false)} user={user} />
        </>
    );
};
