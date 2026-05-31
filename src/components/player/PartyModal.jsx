import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import './PartyModal.css';

const MODES = {
    MENU: 'menu',
    JOIN: 'join',
    CREATE: 'create'
};

const ERROR_MESSAGES = {
    createFailed: 'Oda oluşturulamadı. Lütfen tekrar deneyin.',
    joinFailed: 'Odaya katılınamadı. Kod hatalı veya oda kapanmış.',
};

export const PartyModal = ({ 
    isOpen, onClose, 
    roomCode, isHost, partyViewers, syncStatus,
    onCreateRoom, onJoinRoom, onLeaveRoom,
    currentStreamUrl
}) => {
    const [mode, setMode] = useState(MODES.MENU);
    const [joinCode, setJoinCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    
    const { type, id } = useParams();

    const goToParty = useCallback((code) => {
        const params = new URLSearchParams({
            code: code,
            id: id,
            type: type || 'movie',
            s: new URLSearchParams(window.location.search).get('s') || 1,
            e: new URLSearchParams(window.location.search).get('e') || 1
        });
        
        onClose(); 
        
        navigate(`/party?${params.toString()}`, {
            state: { streamUrl: currentStreamUrl }
        });
    }, [navigate, onClose, currentStreamUrl, type, id]);

    if (!isOpen) return null;

    const handleCreate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const code = await onCreateRoom();
            if (code) {
                goToParty(code);
            }
        } catch (err) {
            setError(ERROR_MESSAGES.createFailed);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async () => {
        if (joinCode.length === 6) {
            setIsLoading(true);
            setError(null);
            try {
                await onJoinRoom(joinCode);
                goToParty(joinCode);
            } catch (err) {
                console.error(err);
                setError(err.message || ERROR_MESSAGES.joinFailed);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && joinCode.length === 6) {
            handleJoin();
        }
    };

    return (
        <AnimatePresence>
            <motion.div 
                className="party-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                role="dialog"
                aria-modal="true"
                aria-labelledby="party-modal-title"
            >
                <motion.div
                    className="party-modal"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="party-modal-title" id="party-modal-title">
                        <i className="fas fa-users" style={{ color: '#E50914' }}></i>
                        Party Mode
                    </div>

                    {roomCode ? (
                        <div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ 
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '6px 12px', borderRadius: '20px',
                                    background: 'rgba(76, 175, 80, 0.2)', color: '#4CAF50',
                                    fontSize: '13px', fontWeight: '600', marginBottom: '24px'
                                }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4CAF50' }}></span>
                                    Aktif Parti
                                </div>
                                
                                <div style={{ marginBottom: '24px', fontSize: '14px', color: '#ccc' }}>
                                    Şu an <b>{roomCode}</b> odasındasın.
                                </div>

                                <button 
                                    className="party-btn party-btn-primary"
                                    style={{ marginBottom: '12px' }}
                                    onClick={() => goToParty(roomCode)}
                                >
                                    <i className="fas fa-external-link-alt"></i>
                                    Parti Odasına Git
                                </button>

                                <button 
                                    className="party-btn party-btn-secondary"
                                    style={{ color: '#ff4b4b' }}
                                    onClick={onLeaveRoom}
                                >
                                    <i className="fas fa-sign-out-alt"></i>
                                    Partiden Ayrıl
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {mode === MODES.MENU && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <button 
                                        className="party-btn party-btn-primary"
                                        onClick={handleCreate}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-plus-circle"></i>}
                                        {isLoading ? 'Oluşturuluyor...' : 'Oda Oluştur'}
                                    </button>
                                    <button 
                                        className="party-btn party-btn-secondary"
                                        onClick={() => setMode(MODES.JOIN)}
                                    >
                                        <i className="fas fa-sign-in-alt"></i>
                                        Odaya Katıl
                                    </button>
                                </div>
                            )}

                            {mode === MODES.JOIN && (
                                <div>
                                    <div style={{ marginBottom: '16px', color: '#ccc' }}>
                                        Arkadaşının verdiği 6 haneli kodu gir:
                                    </div>
                                    <input 
                                        className="party-input"
                                        maxLength={6}
                                        placeholder="ABC123"
                                        value={joinCode}
                                        onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError(null); }}
                                        onKeyDown={handleKeyDown}
                                        disabled={isLoading}
                                        aria-label="Parti Kodu"
                                    />
                                    
                                    {error && (
                                        <div className="party-error">
                                            <i className="fas fa-exclamation-circle" style={{ marginRight: '6px' }}></i>
                                            {error}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button 
                                            className="party-btn party-btn-secondary"
                                            style={{ flex: 1 }}
                                            onClick={() => setMode(MODES.MENU)}
                                            disabled={isLoading}
                                        >
                                            Geri
                                        </button>
                                        <button 
                                            className="party-btn party-btn-primary"
                                            style={{ flex: 1 }}
                                            onClick={handleJoin}
                                            disabled={joinCode.length !== 6 || isLoading}
                                        >
                                            {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Katıl'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
