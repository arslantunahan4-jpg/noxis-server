import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { friendsService } from '../utils/friendsService';
import { useNavigate } from 'react-router-dom';

export const WatchlistsModal = ({ isOpen, onClose, user }) => {
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedList, setSelectedList] = useState(null);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    
    // Invite state
    const [friends, setFriends] = useState([]);
    const [showInviteUI, setShowInviteUI] = useState(false);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    // Create form
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) fetchLists();
    }, [isOpen]);

    const fetchLists = async () => {
        setLoading(true);
        try {
            const data = await friendsService.getWatchlists();
            setLists(data.watchlists || []);
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    const handleCreate = async () => {
        if(!newTitle.trim()) return;
        try {
            await friendsService.createWatchlist({ title: newTitle, description: newDesc });
            setNewTitle(''); setNewDesc(''); setIsCreating(false);
            fetchLists();
        } catch(e) { console.error(e); }
    };

    const handleAiSuggest = async (listId) => {
        setAiLoading(true);
        try {
            const data = await friendsService.getAiSuggestions(listId);
            setAiSuggestions(data.suggestions || []);
        } catch(e) { console.error(e); }
        setAiLoading(false);
    };

    const handleAddAiSuggestion = async (item) => {
        try {
            const payload = {
                tmdbId: String(item.id),
                mediaType: item.media_type,
                title: item.title || item.name,
                posterPath: item.poster_path,
                backdropPath: item.backdrop_path
            };
            await friendsService.addToWatchlist(selectedList._id, payload);
            
            // Remove from suggestions and reload lists
            setAiSuggestions(prev => prev.filter(s => s.id !== item.id));
            const data = await friendsService.getWatchlists();
            setLists(data.watchlists || []);
            // Update selected list reference
            setSelectedList(data.watchlists.find(l => l._id === selectedList._id));
        } catch(e) { console.error(e); }
    };

    const handleInviteFriend = async (friendId) => {
        setInviteLoading(true);
        try {
            await friendsService.inviteToWatchlist(selectedList._id, friendId);
            const data = await friendsService.getWatchlists();
            setLists(data.watchlists || []);
            setSelectedList(data.watchlists.find(l => l._id === selectedList._id));
        } catch(e) { console.error(e); }
        setInviteLoading(false);
    };

    const handleDeleteList = async () => {
        if (!deleteConfirm) {
            setDeleteConfirm(true);
            setTimeout(() => setDeleteConfirm(false), 3000);
            return;
        }
        try {
            await friendsService.deleteWatchlist(selectedList._id);
            const data = await friendsService.getWatchlists();
            setLists(data.watchlists || []);
            setSelectedList(null);
            setDeleteConfirm(false);
        } catch(e) { console.error(e); }
    };

    const handleRemoveItem = async (e, itemId) => {
        e.stopPropagation();
        try {
            await friendsService.removeFromWatchlist(selectedList._id, itemId);
            const data = await friendsService.getWatchlists();
            setLists(data.watchlists || []);
            setSelectedList(data.watchlists.find(l => l._id === selectedList._id));
        } catch(e) { console.error(e); }
    };

    const toggleInviteUI = async () => {
        if (!showInviteUI) {
            try {
                const data = await friendsService.getFriendsList();
                setFriends(data.friends || []);
            } catch(e) { console.error(e); }
        }
        setShowInviteUI(!showInviteUI);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 11000 }}
                    />
                    
                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        style={{ 
                            position: 'fixed', top: 0, right: 0, width: '450px', maxWidth: '100vw', height: '100vh', 
                            background: 'rgba(15,15,15,0.95)', borderLeft: '1px solid rgba(255,255,255,0.1)', 
                            zIndex: 11001, display: 'flex', flexDirection: 'column', overflow: 'hidden'
                        }}
                    >
                        {/* Header */}
                        <div className="watchlists-drawer-header" style={{ padding: '30px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>
                                {selectedList ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setSelectedList(null)}>
                                        <i className="fas fa-arrow-left" style={{ fontSize: '18px', color: '#e50914' }} /> {selectedList.title}
                                    </span>
                                ) : 'Ortak Listeler'}
                            </h2>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                {selectedList && selectedList.owner._id === user?.id && (
                                    <button onClick={handleDeleteList} style={{ background: deleteConfirm ? '#e50914' : 'transparent', border: 'none', color: deleteConfirm ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: deleteConfirm ? '14px' : '20px', padding: deleteConfirm ? '5px 10px' : '0', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }} title="Listeyi Sil">
                                        {deleteConfirm ? 'Sil' : <i className="fas fa-trash" />}
                                    </button>
                                )}
                                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}><i className="fas fa-times" /></button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="watchlists-drawer-content" style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
                            {loading ? (
                                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', marginTop: '50px' }}><i className="fas fa-spinner fa-spin" style={{ fontSize: '24px' }} /></div>
                            ) : selectedList ? (
                                /* --- LIST DETAIL VIEW --- */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '16px' }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>{selectedList.description || 'Açıklama yok.'}</p>
                                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                {selectedList.collaborators.map(c => (
                                                    <div key={c._id} title={c.username} style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#e50914', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                                        {c.username.charAt(0).toUpperCase()}
                                                    </div>
                                                ))}
                                                {selectedList.owner._id === user?.id && (
                                                    <button onClick={toggleInviteUI} style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.3)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Arkadaş Ekle">
                                                        <i className="fas fa-plus" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Invite UI */}
                                    <AnimatePresence>
                                        {showInviteUI && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                <h4 style={{ margin: 0, fontSize: '14px' }}>Arkadaş Davet Et</h4>
                                                {friends.length === 0 ? (
                                                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Listene ekleyeceğin arkadaşın yok.</p>
                                                ) : (
                                                    friends.filter(f => !selectedList.collaborators.some(c => c._id === f._id)).length === 0 ? (
                                                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Tüm arkadaşların zaten bu listede!</p>
                                                    ) : (
                                                        friends.filter(f => !selectedList.collaborators.some(c => c._id === f._id)).map(friend => (
                                                            <div key={friend._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                                                                <span style={{ fontSize: '13px' }}>{friend.username}</span>
                                                                <button onClick={() => handleInviteFriend(friend._id)} disabled={inviteLoading} style={{ background: '#e50914', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                                                    {inviteLoading ? <i className="fas fa-spinner fa-spin" /> : 'Davet Et'}
                                                                </button>
                                                            </div>
                                                        ))
                                                    )
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>


                                    {/* Items */}
                                    <h3 style={{ margin: '10px 0 0 0', fontSize: '18px' }}>İçerikler ({selectedList.items.length})</h3>
                                    {selectedList.items.length === 0 ? (
                                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Liste henüz boş.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {selectedList.items.map(item => (
                                                <div key={item._id} onClick={() => { onClose(); navigate(`/watch/${item.mediaType}/${item.tmdbId}`); }} style={{ display: 'flex', gap: '15px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', cursor: 'pointer', alignItems: 'center' }}>
                                                    {item.posterPath ? (
                                                        <img src={`https://image.tmdb.org/t/p/w92${item.posterPath}`} style={{ width: '50px', borderRadius: '8px' }} />
                                                    ) : <div style={{ width: '50px', height: '75px', background: '#333', borderRadius: '8px' }} />}
                                                    <div style={{ flex: 1 }}>
                                                        <h4 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>{item.title}</h4>
                                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                            {item.mediaType === 'tv' ? 'Dizi' : 'Film'}
                                                        </span>
                                                    </div>
                                                    <button onClick={(e) => handleRemoveItem(e, item._id)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', padding: '5px', cursor: 'pointer', fontSize: '16px' }} title="Listeden Çıkar" onMouseOver={e => e.currentTarget.style.color = '#e50914'} onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
                                                        <i className="fas fa-times" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* AI Suggest Section */}
                                    <div style={{
                                        marginTop: '24px',
                                        padding: '22px',
                                        background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.12) 0%, rgba(138, 43, 226, 0.08) 50%, rgba(0, 212, 255, 0.05) 100%)',
                                        borderRadius: '20px',
                                        border: '1px solid rgba(229, 9, 20, 0.25)',
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                                        backdropFilter: 'blur(10px)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                                                <i className="fas fa-brain" style={{ color: '#00d4ff', filter: 'drop-shadow(0 0 8px rgba(0,212,255,0.6))' }} />
                                                Ortak Zevk AI Öneri Motoru
                                            </h4>
                                            {aiSuggestions.length > 0 && (
                                                <button
                                                    onClick={() => handleAiSuggest(selectedList._id)}
                                                    disabled={aiLoading}
                                                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '5px 10px', borderRadius: '100px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                >
                                                    <i className={`fas fa-sync-alt ${aiLoading ? 'fa-spin' : ''}`} /> Yenile
                                                </button>
                                            )}
                                        </div>

                                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                                            Listenizdeki mevcut tüm yapımlar ve grubun ortak tür ağırlıkları nöral yapay zeka matrisiyle analiz edildi.
                                        </p>

                                        {!aiSuggestions.length && !aiLoading ? (
                                            <button
                                                onClick={() => handleAiSuggest(selectedList._id)}
                                                style={{
                                                    width: '100%',
                                                    padding: '14px',
                                                    background: 'linear-gradient(135deg, #e50914 0%, #b20710 100%)',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    fontWeight: 800,
                                                    fontSize: '14px',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 4px 15px rgba(229, 9, 20, 0.4)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                <i className="fas fa-sparkles" /> Grubumuz İçin Ortak Önerileri Getir
                                            </button>
                                        ) : aiLoading ? (
                                            <div style={{ textAlign: 'center', padding: '30px', color: '#00d4ff' }}>
                                                <i className="fas fa-brain fa-spin fa-2x" style={{ marginBottom: '10px' }} />
                                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'rgba(255,255,255,0.8)' }}>Ortak Zevk Matrisi Analiz Ediliyor...</div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {aiSuggestions.map(s => (
                                                    <div
                                                        key={s.id}
                                                        style={{
                                                            display: 'flex',
                                                            gap: '12px',
                                                            padding: '12px',
                                                            background: 'rgba(0, 0, 0, 0.45)',
                                                            borderRadius: '14px',
                                                            alignItems: 'center',
                                                            border: '1px solid rgba(255,255,255,0.06)',
                                                            transition: 'transform 0.2s, background 0.2s'
                                                        }}
                                                    >
                                                        {s.poster_path ? (
                                                            <img
                                                                src={`https://image.tmdb.org/t/p/w92${s.poster_path}`}
                                                                style={{ width: '48px', height: '70px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}
                                                                alt=""
                                                            />
                                                        ) : (
                                                            <div style={{ width: '48px', height: '70px', background: '#222', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <i className="fas fa-film" style={{ color: '#555' }} />
                                                            </div>
                                                        )}

                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                                <span style={{
                                                                    fontSize: '10px',
                                                                    fontWeight: 800,
                                                                    padding: '2px 6px',
                                                                    borderRadius: '100px',
                                                                    background: 'linear-gradient(135deg, #00c853 0%, #00e676 100%)',
                                                                    color: '#000'
                                                                }}>
                                                                    %{s.matchPercentage || 95} GRUP UYUMU
                                                                </span>
                                                                {s.vote_average > 0 && (
                                                                    <span style={{ fontSize: '11px', color: '#ffb300', fontWeight: 'bold' }}>
                                                                        <i className="fas fa-star" style={{ fontSize: '10px' }} /> {s.vote_average?.toFixed(1)}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <h5 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {s.title || s.name}
                                                            </h5>

                                                            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                <i className="fas fa-lightbulb" style={{ color: '#ffb300', marginRight: '4px' }} />
                                                                {s.reason || 'Ortak İzleme Zevkinize Uyumlu'}
                                                            </p>
                                                        </div>

                                                        <button
                                                            onClick={() => handleAddAiSuggestion(s)}
                                                            style={{
                                                                background: 'linear-gradient(135deg, #e50914 0%, #b20710 100%)',
                                                                border: 'none',
                                                                color: '#fff',
                                                                padding: '8px 14px',
                                                                borderRadius: '100px',
                                                                fontSize: '12px',
                                                                cursor: 'pointer',
                                                                fontWeight: 800,
                                                                boxShadow: '0 3px 10px rgba(229, 9, 20, 0.4)',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            + Ekle
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* --- MAIN LISTS VIEW --- */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {!isCreating ? (
                                        <button onClick={() => setIsCreating(true)} style={{ width: '100%', padding: '16px', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.3)', borderRadius: '16px', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                            <i className="fas fa-plus" /> Yeni Ortak Liste
                                        </button>
                                    ) : (
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <input type="text" placeholder="Liste Adı" value={newTitle} onChange={e => setNewTitle(e.target.value)} style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }} />
                                            <input type="text" placeholder="Kısa Açıklama" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }} />
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => setIsCreating(false)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '10px', cursor: 'pointer' }}>İptal</button>
                                                <button onClick={handleCreate} style={{ flex: 1, padding: '12px', background: '#e50914', border: 'none', color: '#fff', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Oluştur</button>
                                            </div>
                                        </div>
                                    )}

                                    {lists.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)' }}>
                                            <i className="fas fa-list fa-3x" style={{ marginBottom: '15px', opacity: 0.5 }} />
                                            <p>Hiç ortak listen yok.</p>
                                        </div>
                                    ) : (
                                        lists.map(list => (
                                            <div key={list._id} onClick={() => setSelectedList(list)} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '20px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{list.title}</h3>
                                                <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{list.description || 'Ortak İzleme Listesi'}</p>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '100px' }}>
                                                        <i className="fas fa-film" /> {list.items.length} İçerik
                                                    </span>
                                                    <div style={{ display: 'flex' }}>
                                                        {list.collaborators.slice(0, 3).map((c, i) => (
                                                            <div key={c._id} style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e50914', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', marginLeft: i > 0 ? '-10px' : '0', border: '2px solid #111' }}>
                                                                {c.username.charAt(0).toUpperCase()}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
