import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStoredAvatar, getAvatarData } from '../config/avatars';
import { getMonthlyAnalytics, getAnnualWrappedData } from '../utils/analytics';
import { syncFromBackend } from '../utils/watchHistory';
import { AvatarSelectorModal } from './AvatarSelectorModal';
import { NoxisWrappedModal } from './NoxisWrappedModal';
import { MonthlyReportCard } from './MonthlyReportCard';
import { friendsService } from '../utils/friendsService';
import { FriendProfileModal } from './FriendProfileModal';
import { AVATARS } from '../config/avatars';

export const ProfileModal = ({ isOpen, onClose, username = 'Kullanıcı' }) => {
    // Existing State
    const [avatar, setAvatar] = useState(() => getStoredAvatar());
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [showWrappedModal, setShowWrappedModal] = useState(false);
    const [selectedWrappedYear, setSelectedWrappedYear] = useState(() => new Date().getFullYear());
    const [serverProfile, setServerProfile] = useState(null);

    const monthlyReports = useMemo(() => {
        return getMonthlyAnalytics(serverProfile?.watchHistory || null);
    }, [serverProfile]);

    const wrappedStats = useMemo(() => {
        return getAnnualWrappedData(selectedWrappedYear, serverProfile?.watchHistory || null);
    }, [selectedWrappedYear, serverProfile]);

    // New State for tabs and social
    const [activeTab, setActiveTab] = useState('stats');
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState({ incoming: [], outgoing: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [bio, setBio] = useState('');
    const [visibility, setVisibility] = useState('public');
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [friendActionLoading, setFriendActionLoading] = useState('');

    useEffect(() => {
        if (isOpen) {
            syncFromBackend();
            friendsService.getUserProfile(username)
                .then(data => {
                    if (data.profile) {
                        setServerProfile(data.profile);
                        setBio(data.profile.bio || '');
                        setVisibility(data.profile.profileVisibility || 'public');
                        if (data.profile.avatarId) {
                            const avatarData = getAvatarData(data.profile.avatarId);
                            if (avatarData) setAvatar(avatarData);
                        }
                    }
                })
                .catch(() => {});
            loadFriends();
        }
    }, [isOpen, username]);

    const loadFriends = () => {
        friendsService.getFriendsList().then(data => setFriends(data.friends)).catch(() => {});
        friendsService.getPendingRequests().then(data => setPendingRequests(data)).catch(() => {});
    };

    useEffect(() => {
        if (searchQuery.length < 2) { setSearchResults([]); return; }
        const timer = setTimeout(() => {
            setSearching(true);
            friendsService.searchUsers(searchQuery)
                .then(data => setSearchResults(data.users))
                .catch(() => {})
                .finally(() => setSearching(false));
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    if (!isOpen) return null;

    const levelData = serverProfile?.levelData || wrappedStats.userLevelData || {
        level: 1,
        totalXP: 0,
        currentLevelXP: 0,
        nextLevelXP: 250,
        progressPercent: 0,
        levelInfo: { name: 'Sinema Kaşifi', icon: '🍿', color: '#10b981' },
        badges: []
    };

    const insights = wrappedStats.insights || {
        hasData: false,
        totalHours: 0,
        movieCount: 0,
        episodeCount: 0,
        completionRate: 0,
        mostActiveHour: '—',
        mostActiveDay: '—',
        genreDiversityScore: 0,
        avgSessionMinutes: 0
    };

    const timeAgo = (d) => {
        if (!d) return '—';
        const diff = Date.now() - new Date(d).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Az önce';
        if (mins < 60) return `${mins} dk önce`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} saat önce`;
        return `${Math.floor(hours / 24)} gün önce`;
    };

    // Nov 30 Release Lock Check
    const now = new Date();
    const currentYear = now.getFullYear();
    const nov30Date = new Date(currentYear, 10, 30, 0, 0, 0); // 30 Nov
    const isCurrentYearUnlocked = now >= nov30Date;

    return (
        <AnimatePresence>
            <div className="noxis-modal-overlay" onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 20 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="noxis-profile-modal"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header: User Avatar & Level Progress */}
                    <div className="noxis-profile-header">
                        <div className="noxis-profile-user-group">
                            <div
                                className="noxis-profile-avatar-wrapper"
                                onClick={() => setShowAvatarModal(true)}
                                title="Profil Resmi Değiştir"
                                style={{ background: avatar.gradient || 'linear-gradient(135deg, #e50914, #ff3b47)' }}
                            >
                                {avatar.url ? (
                                    <img
                                        src={avatar.url}
                                        alt={avatar.name}
                                        referrerPolicy="no-referrer"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : avatar.icon ? (
                                    <i className={avatar.icon} style={{ fontSize: '24px', color: '#fff' }} />
                                ) : (
                                    <span>{username.charAt(0).toUpperCase()}</span>
                                )}
                                <div className="noxis-avatar-edit-overlay">
                                    <i className="fas fa-camera" />
                                </div>
                            </div>

                            <div className="noxis-profile-user-meta">
                                <div className="noxis-profile-name-row">
                                    <h2 className="noxis-profile-name">{username}</h2>
                                    <span className="noxis-level-tag" style={{ borderColor: levelData.levelInfo.color }}>
                                        {levelData.levelInfo.icon} Level {levelData.level}
                                    </span>
                                </div>
                                <span className="noxis-profile-avatar-name">{avatar.name}</span>

                                {/* XP Level Bar */}
                                <div className="noxis-xp-bar-container">
                                    <div className="noxis-xp-bar-info">
                                        <span className="noxis-xp-title">{levelData.levelInfo.name}</span>
                                        <span className="noxis-xp-num">{levelData.currentLevelXP} / {levelData.nextLevelXP} XP</span>
                                    </div>
                                    <div className="noxis-xp-track">
                                        <div
                                            className="noxis-xp-fill"
                                            style={{
                                                width: `${levelData.progressPercent}%`,
                                                background: levelData.levelInfo.color
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button type="button" className="noxis-modal-close" onClick={onClose}>
                            <i className="fas fa-times" />
                        </button>
                    </div>

                    {/* NEW: Tab Bar */}
                    <div className="noxis-profile-tabs">
                        <button className={`noxis-profile-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
                            <i className="fas fa-chart-bar" /> İstatistiklerim
                        </button>
                        <button className={`noxis-profile-tab ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => { setActiveTab('friends'); loadFriends(); }}>
                            <i className="fas fa-users" /> Arkadaşlarım
                            {pendingRequests.incoming.length > 0 && <span className="noxis-tab-badge">{pendingRequests.incoming.length}</span>}
                        </button>
                        <button className={`noxis-profile-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                            <i className="fas fa-cog" /> Ayarlar
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'stats' && (
                        <>
                            {/* Banner Action: Annual Wrapped (Only visible after 30 Nov) */}
                            {isCurrentYearUnlocked && (
                                <div className="noxis-profile-wrapped-banner">
                                    <div>
                                        <span className="noxis-wrapped-pill">
                                            ✨ YILLIK RESMİ ÖZET
                                        </span>
                                        <h3>{currentYear} Noxis Wrapped</h3>
                                        <p>
                                            Bu yıl izlediğin saatler, favori türlerin ve sinema unvanın hazır!
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        className="noxis-btn-launch-wrapped"
                                        onClick={() => {
                                            setSelectedWrappedYear(currentYear);
                                            setShowWrappedModal(true);
                                        }}
                                    >
                                        <i className="fas fa-play" /> Özetimi İzle
                                    </button>
                                </div>
                            )}

                            {/* Section: Achievements & Badges */}
                            <div className="noxis-profile-section" style={{ marginBottom: '32px' }}>
                                <div className="noxis-section-title-group">
                                    <h3><i className="fas fa-award" /> Sinema Başarımlarım ({levelData.badges.filter(b => b.unlocked).length} / {levelData.badges.length})</h3>
                                    <p>Film ve dizi izledikçe kilitleri açılan 12 özel başarım rozeti</p>
                                </div>

                                <div className="noxis-badges-grid">
                                    {levelData.badges.map((badge) => (
                                        <div
                                            key={badge.id}
                                            className={`noxis-badge-card ${badge.unlocked ? 'unlocked' : 'locked'}`}
                                            title={badge.unlocked ? `${badge.title}: ${badge.desc}` : `Kilitli: ${badge.desc}`}
                                        >
                                            <div className="noxis-badge-icon">
                                                {badge.icon}
                                            </div>
                                            <div className="noxis-badge-info">
                                                <strong>{badge.title}</strong>
                                                <small>{badge.unlocked ? badge.desc : 'Henüz Kazanılmadı'}</small>
                                            </div>
                                            {badge.unlocked && <span className="noxis-badge-check"><i className="fas fa-check" /></span>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section: Deep Watch Insights */}
                            <div className="noxis-profile-section" style={{ marginBottom: '32px' }}>
                                <div className="noxis-section-title-group">
                                    <h3><i className="fas fa-microscope" /> Derin İzleme Analizlerim</h3>
                                    <p>İzleme alışkanlıklarınıza dayalı kişiselleştirilmiş analitik veriler</p>
                                </div>

                                <div className="noxis-insights-grid">
                                    <div className="noxis-insight-card">
                                        <div className="noxis-insight-icon"><i className="fas fa-clock" /></div>
                                        <div className="noxis-insight-data">
                                            <span className="noxis-insight-label">Zirve İzleme Saatin</span>
                                            <strong className="noxis-insight-val">{insights.mostActiveHour}</strong>
                                            <small>{insights.hasLateNightWatch ? 'Gece kuşu modundasın' : 'Düzeyli izleme dilimi'}</small>
                                        </div>
                                    </div>

                                    <div className="noxis-insight-card">
                                        <div className="noxis-insight-icon"><i className="fas fa-calendar-day" /></div>
                                        <div className="noxis-insight-data">
                                            <span className="noxis-insight-label">En Aktif İzleme Günün</span>
                                            <strong className="noxis-insight-val">{insights.mostActiveDay}</strong>
                                            <small>Haftanın en çok içerik tükettiğin günü</small>
                                        </div>
                                    </div>

                                    <div className="noxis-insight-card">
                                        <div className="noxis-insight-icon"><i className="fas fa-bullseye" /></div>
                                        <div className="noxis-insight-data">
                                            <span className="noxis-insight-label">Tamamlama Oranın</span>
                                            <strong className="noxis-insight-val">%{insights.completionRate}</strong>
                                            <small>Başladığın içeriklerin bitirilme yüzdesi</small>
                                        </div>
                                    </div>

                                    <div className="noxis-insight-card">
                                        <div className="noxis-insight-icon"><i className="fas fa-compass" /></div>
                                        <div className="noxis-insight-data">
                                            <span className="noxis-insight-label">Tür Çeşitlilik Skoru</span>
                                            <strong className="noxis-insight-val">%{insights.genreDiversityScore}</strong>
                                            <small>{insights.uniqueGenresCount} farklı tür keşfedildi</small>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Monthly Analytics */}
                            <div className="noxis-profile-section">
                                <div className="noxis-section-title-group">
                                    <h3><i className="fas fa-calendar-alt" /> Aylık İstatistik Raporlarım</h3>
                                    <p>Her ayın 1'inde hesabınıza kilitlenen özel izleme raporları</p>
                                </div>

                                {monthlyReports.length > 0 ? (
                                    <div className="noxis-monthly-reports-list">
                                        {monthlyReports.map((report) => (
                                            <MonthlyReportCard key={report.yearMonth} report={report} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="noxis-monthly-empty">
                                        <i className="fas fa-chart-line" />
                                        <h4>Henüz Aylık Raporunuz Bulunmuyor</h4>
                                        <p>Film veya dizi izledikçe aylık izleme raporlarınız burada otomatik listelenecektir.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'friends' && (
                        <div className="noxis-friends-tab">
                            {/* Search bar */}
                            <div className="noxis-friend-search-box">
                                <i className="fas fa-search" />
                                <input
                                    type="text"
                                    placeholder="Kullanıcı adı ile ara..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Search results */}
                            {searchQuery.length >= 2 && (
                                <div className="noxis-search-results">
                                    {searching ? <p>Aranıyor...</p> : searchResults.length === 0 ? <p>Kullanıcı bulunamadı</p> : (
                                        searchResults.map(u => (
                                            <div key={u.username} className="noxis-friend-row">
                                                <div className="noxis-friend-row-avatar" onClick={() => setSelectedFriend(u.username)}>
                                                    <span className={`noxis-friend-status-dot ${u.isOnline ? 'online' : 'offline'}`} />
                                                </div>
                                                <div className="noxis-friend-row-info" onClick={() => setSelectedFriend(u.username)}>
                                                    <strong>{u.username}</strong>
                                                    {u.bio && <small>{u.bio}</small>}
                                                </div>
                                                {u.friendshipStatus === 'none' && (
                                                    <button onClick={async () => {
                                                        setFriendActionLoading(u.username);
                                                        try { await friendsService.sendRequest(u.username); setSearchQuery(''); loadFriends(); } catch(e) {}
                                                        setFriendActionLoading('');
                                                    }} disabled={friendActionLoading === u.username}>
                                                        <i className="fas fa-user-plus" />
                                                    </button>
                                                )}
                                                {u.friendshipStatus === 'accepted' && <span className="noxis-friend-check"><i className="fas fa-check" /></span>}
                                                {u.friendshipStatus.startsWith('pending') && <span className="noxis-friend-pending-icon"><i className="fas fa-clock" /></span>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Pending incoming requests */}
                            {pendingRequests.incoming.length > 0 && (
                                <div className="noxis-pending-section">
                                    <h4><i className="fas fa-inbox" /> Gelen İstekler ({pendingRequests.incoming.length})</h4>
                                    {pendingRequests.incoming.map(req => (
                                        <div key={req.requestId} className="noxis-friend-row">
                                            <div className="noxis-friend-row-info" onClick={() => setSelectedFriend(req.username)}>
                                                <strong>{req.username}</strong>
                                            </div>
                                            <div className="noxis-request-actions">
                                                <button className="accept" onClick={async () => {
                                                    await friendsService.acceptRequest(req.requestId); loadFriends();
                                                }}><i className="fas fa-check" /></button>
                                                <button className="reject" onClick={async () => {
                                                    await friendsService.rejectRequest(req.requestId); loadFriends();
                                                }}><i className="fas fa-times" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Friend list */}
                            <div className="noxis-friends-list-section">
                                <h4><i className="fas fa-user-friends" /> Arkadaşlarım ({friends.length})</h4>
                                {friends.length === 0 ? (
                                    <div className="noxis-friends-empty">
                                        <i className="fas fa-user-plus" />
                                        <p>Henüz arkadaşınız yok. Yukarıdan kullanıcı arayarak arkadaş ekleyebilirsiniz.</p>
                                    </div>
                                ) : (
                                    friends.map(f => (
                                        <div key={f.username} className="noxis-friend-row" onClick={() => setSelectedFriend(f.username)}>
                                            <div className="noxis-friend-row-avatar">
                                                <span className={`noxis-friend-status-dot ${f.isOnline ? 'online' : 'offline'}`} />
                                            </div>
                                            <div className="noxis-friend-row-info">
                                                <strong>{f.username}</strong>
                                                {f.isOnline && f.currentlyWatching?.title ? (
                                                    <small className="noxis-watching-text">🎬 {f.currentlyWatching.title}</small>
                                                ) : f.isOnline ? (
                                                    <small className="noxis-online-text">Çevrimiçi</small>
                                                ) : (
                                                    <small>Son görülme: {f.lastSeen ? timeAgo(f.lastSeen) : '—'}</small>
                                                )}
                                            </div>
                                            <i className="fas fa-chevron-right" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }} />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="noxis-settings-tab">
                            <div className="noxis-setting-group">
                                <label>Kullanıcı Adı</label>
                                <div className="noxis-username-display">
                                    <span>{username}</span>
                                    <button onClick={() => { navigator.clipboard.writeText(username); }}>
                                        <i className="fas fa-copy" /> Kopyala
                                    </button>
                                </div>
                            </div>

                            <div className="noxis-setting-group">
                                <label>Hakkımda <small>({bio.length}/120)</small></label>
                                <textarea
                                    value={bio}
                                    onChange={e => setBio(e.target.value.slice(0, 120))}
                                    placeholder="Kendinizi kısaca tanıtın..."
                                    maxLength={120}
                                    rows={2}
                                />
                            </div>

                            <div className="noxis-setting-group">
                                <label>Profil Gizliliği</label>
                                <div className="noxis-visibility-options">
                                    {[{ v: 'public', icon: 'fas fa-globe', label: 'Herkese Açık' },
                                      { v: 'friends', icon: 'fas fa-user-friends', label: 'Sadece Arkadaşlar' },
                                      { v: 'private', icon: 'fas fa-lock', label: 'Gizli' }].map(opt => (
                                        <button
                                            key={opt.v}
                                            className={`noxis-visibility-btn ${visibility === opt.v ? 'active' : ''}`}
                                            onClick={() => setVisibility(opt.v)}
                                        >
                                            <i className={opt.icon} /> {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                className="noxis-btn-save-settings"
                                onClick={async () => {
                                    try {
                                        await friendsService.updateProfile({ bio, profileVisibility: visibility });
                                        // Show success feedback
                                    } catch(e) {}
                                }}
                            >
                                <i className="fas fa-save" /> Kaydet
                            </button>
                        </div>
                    )}

                    {/* Sub Modals */}
                    <AvatarSelectorModal
                        isOpen={showAvatarModal}
                        onClose={() => setShowAvatarModal(false)}
                        onAvatarChanged={(newAvatar) => setAvatar(newAvatar)}
                    />

                    <NoxisWrappedModal
                        isOpen={showWrappedModal}
                        onClose={() => setShowWrappedModal(false)}
                        year={selectedWrappedYear}
                        username={username}
                    />

                    {/* FriendProfileModal */}
                    <FriendProfileModal
                        isOpen={!!selectedFriend}
                        onClose={() => { setSelectedFriend(null); loadFriends(); }}
                        username={selectedFriend}
                    />
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
