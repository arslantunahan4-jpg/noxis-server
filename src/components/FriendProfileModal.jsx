import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { friendsService } from '../utils/friendsService';
import { AVATARS } from '../config/avatars';

export const FriendProfileModal = ({ isOpen, onClose, username }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (isOpen && username) {
            setLoading(true);
            setError(null);
            friendsService.getUserProfile(username)
                .then(data => {
                    setProfile(data.profile);
                    setLoading(false);
                })
                .catch(err => {
                    setError(err.message);
                    setLoading(false);
                });
        }
    }, [isOpen, username]);

    if (!isOpen) return null;

    const getAvatarData = (avatarId) => {
        if (!avatarId) return AVATARS[0] || null;
        if (typeof avatarId === 'string' && (avatarId.startsWith('/') || avatarId.startsWith('http'))) {
            return { url: avatarId, name: 'Avatar', gradient: 'linear-gradient(135deg, #e50914, #ff3b47)' };
        }
        return AVATARS?.find(a => a.id === avatarId || a.url?.includes(avatarId)) || AVATARS[0] || null;
    };

    const avatar = getAvatarData(profile?.avatarId);
    const bgGradient = avatar?.gradient || 'linear-gradient(135deg, #e50914, #ff3b47)';

    const handleFriendAction = async (action) => {
        setActionLoading(true);
        try {
            if (action === 'add') await friendsService.sendRequest(username);
            else if (action === 'remove') await friendsService.removeFriend(username);
            // Refresh profile
            const data = await friendsService.getUserProfile(username);
            setProfile(data.profile);
        } catch (err) {
            setError(err.message);
        }
        setActionLoading(false);
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' }) : '';

    const timeAgo = (d) => {
        if (!d) return '';
        const diff = Date.now() - new Date(d).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Az önce';
        if (mins < 60) return `${mins} dk önce`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} saat önce`;
        const days = Math.floor(hours / 24);
        return `${days} gün önce`;
    };

    return (
        <AnimatePresence>
            <div className="noxis-modal-overlay" onClick={onClose} style={{ zIndex: 10001 }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 20 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="noxis-profile-modal noxis-friend-profile-modal"
                    onClick={(e) => e.stopPropagation()}
                    style={{ maxWidth: '480px' }}
                >
                    <button type="button" className="noxis-modal-close" onClick={onClose}>
                        <i className="fas fa-times" />
                    </button>

                    {loading ? (
                        <div style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                            <i className="fas fa-spinner fa-spin" style={{ fontSize: '28px' }} />
                            <p style={{ marginTop: '12px' }}>Profil yükleniyor...</p>
                        </div>
                    ) : error ? (
                        <div style={{ padding: '60px 0', textAlign: 'center', color: '#ff4757' }}>
                            <i className="fas fa-exclamation-circle" style={{ fontSize: '28px' }} />
                            <p style={{ marginTop: '12px' }}>{error}</p>
                        </div>
                    ) : profile ? (
                        <>
                            {/* Profile Header */}
                            <div className="noxis-friend-profile-header">
                                <div className="noxis-friend-avatar" style={{ background: bgGradient }}>
                                    {avatar?.url ? (
                                        <img src={avatar.url} alt={profile.username} referrerPolicy="no-referrer" />
                                    ) : (
                                        <span>{profile.username.charAt(0).toUpperCase()}</span>
                                    )}
                                    <span className={`noxis-friend-status-dot ${profile.isOnline ? 'online' : 'offline'}`} />
                                </div>
                                <h2>{profile.username}</h2>
                                {profile.levelData?.levelInfo && (
                                    <div className="noxis-friend-level-row">
                                        <span className="noxis-level-badge-tag" style={{ borderColor: profile.levelData.levelInfo.color }}>
                                            {profile.levelData.levelInfo.icon} Level {profile.levelData.level} • {profile.levelData.levelInfo.name}
                                        </span>
                                    </div>
                                )}
                                {profile.bio && <p className="noxis-friend-bio">{profile.bio}</p>}
                                
                                {profile.levelData && (
                                    <div className="noxis-friend-xp-bar-wrapper">
                                        <div className="noxis-friend-xp-labels">
                                            <span>XP İlerlemesi</span>
                                            <span>{profile.levelData.currentLevelXP} / {profile.levelData.nextLevelXP} XP</span>
                                        </div>
                                        <div className="noxis-friend-xp-track">
                                            <div className="noxis-friend-xp-fill" style={{ width: `${profile.levelData.progressPercent}%` }} />
                                        </div>
                                    </div>
                                )}

                                <div className="noxis-friend-meta-row">
                                    <span><i className="fas fa-users" /> {profile.friendCount} arkadaş</span>
                                    <span><i className="fas fa-calendar" /> {formatDate(profile.memberSince)}</span>
                                    {!profile.isOnline && profile.lastSeen && (
                                        <span><i className="fas fa-clock" /> {timeAgo(profile.lastSeen)}</span>
                                    )}
                                </div>
                            </div>

                            {/* Currently Watching */}
                            {profile.currentlyWatching?.title && (
                                <div className="noxis-friend-watching-card">
                                    {profile.currentlyWatching.poster && (
                                        <img src={`https://image.tmdb.org/t/p/w92${profile.currentlyWatching.poster}`} alt="" />
                                    )}
                                    <div>
                                        <span className="noxis-watching-live-badge">🔴 CANLI İZLİYOR</span>
                                        <strong>{profile.currentlyWatching.title}</strong>
                                        {profile.currentlyWatching.season && (
                                            <small>S{profile.currentlyWatching.season}E{profile.currentlyWatching.episode}</small>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Stats */}
                            {profile.stats && (
                                <div className="noxis-friend-stats-grid">
                                    <div className="noxis-friend-stat">
                                        <strong>{profile.stats.totalHours}</strong>
                                        <span>Saat</span>
                                    </div>
                                    <div className="noxis-friend-stat">
                                        <strong>{profile.stats.movieCount}</strong>
                                        <span>Film</span>
                                    </div>
                                    <div className="noxis-friend-stat">
                                        <strong>{profile.stats.episodeCount}</strong>
                                        <span>Bölüm</span>
                                    </div>
                                    <div className="noxis-friend-stat">
                                        <strong>{profile.stats.totalWatched}</strong>
                                        <span>Toplam</span>
                                    </div>
                                </div>
                            )}

                            {/* Badges / Başarımlar */}
                            {profile.levelData?.badges?.length > 0 && (
                                <div className="noxis-friend-badges-section">
                                    <h4><i className="fas fa-medal" /> Kazanılan Başarımlar</h4>
                                    <div className="noxis-friend-badges-grid">
                                        {profile.levelData.badges.map((b, i) => (
                                            <div key={i} className="noxis-friend-badge-card" title={b.desc}>
                                                <span className="noxis-badge-icon">{b.icon}</span>
                                                <strong>{b.name}</strong>
                                                <small>{b.desc}</small>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent Watched Items (WITHOUT completion percentage) */}
                            {profile.recentWatched?.length > 0 && (
                                <div className="noxis-friend-recent-section">
                                    <h4><i className="fas fa-history" /> Son İzledikleri</h4>
                                    <div className="noxis-friend-recent-list">
                                        {profile.recentWatched.map((item, idx) => (
                                            <div key={idx} className="noxis-friend-recent-item">
                                                {item.poster_path ? (
                                                    <img
                                                        src={item.poster_path.startsWith('/') ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : item.poster_path}
                                                        alt={item.title}
                                                    />
                                                ) : (
                                                    <div className="noxis-recent-no-poster"><i className="fas fa-film" /></div>
                                                )}
                                                <div className="noxis-friend-recent-info">
                                                    <strong>{item.title}</strong>
                                                    <span>
                                                        {item.season ? `S${item.season}E${item.episode}` : 'Film'}
                                                        {item.updatedAt && ` • ${timeAgo(item.updatedAt)}`}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Privacy notice */}
                            {!profile.stats && profile.profileVisibility !== 'public' && (
                                <div className="noxis-friend-private-notice">
                                    <i className="fas fa-lock" />
                                    <p>{profile.profileVisibility === 'private'
                                        ? 'Bu profil gizli'
                                        : 'İstatistikleri görmek için arkadaş olmalısınız'}</p>
                                </div>
                            )}

                            {/* Friend Action Button */}
                            <div className="noxis-friend-actions">
                                {profile.friendshipStatus === 'none' && (
                                    <button
                                        className="noxis-btn-friend-add"
                                        onClick={() => handleFriendAction('add')}
                                        disabled={actionLoading}
                                    >
                                        <i className="fas fa-user-plus" /> Arkadaş Ekle
                                    </button>
                                )}
                                {profile.friendshipStatus === 'pending_sent' && (
                                    <button className="noxis-btn-friend-pending" disabled>
                                        <i className="fas fa-clock" /> İstek Gönderildi
                                    </button>
                                )}
                                {profile.friendshipStatus === 'pending_received' && (
                                    <button
                                        className="noxis-btn-friend-add"
                                        onClick={async () => {
                                            // Need requestId - fetch from pending requests
                                            try {
                                                const reqs = await friendsService.getPendingRequests();
                                                const req = reqs.incoming.find(r => r.username === username);
                                                if (req) {
                                                    await friendsService.acceptRequest(req.requestId);
                                                    const data = await friendsService.getUserProfile(username);
                                                    setProfile(data.profile);
                                                }
                                            } catch(e) { setError(e.message); }
                                        }}
                                        disabled={actionLoading}
                                    >
                                        <i className="fas fa-check" /> İsteği Kabul Et
                                    </button>
                                )}
                                {profile.friendshipStatus === 'accepted' && (
                                    <button
                                        className="noxis-btn-friend-remove"
                                        onClick={() => {
                                            if (window.confirm(`${username} arkadaşlıktan çıkarılsın mı?`)) {
                                                handleFriendAction('remove');
                                            }
                                        }}
                                        disabled={actionLoading}
                                    >
                                        <i className="fas fa-user-minus" /> Arkadaşlıktan Çıkar
                                    </button>
                                )}
                            </div>
                        </>
                    ) : null}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
