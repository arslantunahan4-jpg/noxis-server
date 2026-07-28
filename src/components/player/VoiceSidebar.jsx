import React from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useConnectionState,
  ConnectionState
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { VOICE_CONFIG, I18N } from '../../config/party';
import { getStoredAvatar } from '../../config/avatars';

// --- Sub Components ---

const UserItem = ({ participant }) => {
    const { isSpeaking, isMicrophoneEnabled, identity } = participant;
    const avatar = getStoredAvatar();
    
    return (
        <div style={{
            display: 'flex', alignItems: 'center', padding: '10px',
            borderRadius: '8px', marginBottom: '4px',
            background: isSpeaking ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
            border: isSpeaking ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid transparent',
            transition: 'all 0.2s'
        }}>
            <div style={{
                position: 'relative', width: '36px', height: '36px', marginRight: '12px',
                borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                background: avatar.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: isSpeaking ? '2px solid #4CAF50' : '2px solid rgba(255,255,255,0.2)'
            }}>
                {avatar.url ? (
                    <img src={avatar.url} alt={identity} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : avatar.icon ? (
                    <i className={avatar.icon} style={{ fontSize: '16px', color: '#fff' }} />
                ) : (
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>{(identity || 'U').charAt(0).toUpperCase()}</span>
                )}
                {!isMicrophoneEnabled && (
                    <div style={{
                        position: 'absolute', bottom: -2, right: -2,
                        background: '#f44336', borderRadius: '50%', padding: '3px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2
                    }}>
                        <i className="fas fa-microphone-slash" style={{ fontSize: '8px', color: 'white' }}></i>
                    </div>
                )}
            </div>
            
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ 
                    fontSize: '14px', fontWeight: '600', color: isSpeaking ? '#4CAF50' : '#ddd',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                    {identity}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                    {isSpeaking ? 'Konuşuyor...' : (isMicrophoneEnabled ? 'Çevrimiçi' : 'Sessiz')}
                </div>
            </div>
        </div>
    );
};

const ParticipantList = () => {
    const participants = useParticipants();
    const sorted = [...participants].sort((a, b) => {
        if (a.isSpeaking === b.isSpeaking) return a.identity.localeCompare(b.identity);
        return a.isSpeaking ? -1 : 1;
    });

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            <div style={{ 
                fontSize: '12px', fontWeight: '700', color: '#888', 
                marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' 
            }}>
                Katılımcılar — {participants.length}
            </div>
            {sorted.map(p => <UserItem key={p.sid} participant={p} />)}
        </div>
    );
};

const UserControls = ({ onLeave, toggleAudioMode, audioMode, isMobile }) => {
    const { localParticipant } = useLocalParticipant();
    const avatar = getStoredAvatar();
    
    // Derived state from LiveKit participant
    const isMicEnabled = localParticipant?.isMicrophoneEnabled;

    const toggleMic = async () => {
        if (!localParticipant) return;
        
        if (isMobile && audioMode === 'cinema') {
            const success = await toggleAudioMode();
            if (success) {
                // Wait a tick for tracks to be published
                setTimeout(async () => {
                    await localParticipant.setMicrophoneEnabled(true);
                }, 100);
            }
            return;
        }

        try {
            const current = localParticipant.isMicrophoneEnabled;
            await localParticipant.setMicrophoneEnabled(!current);
        } catch (e) {
            console.error("Mic Error:", e);
        }
    };

    return (
        <div style={{
            background: '#18181b', padding: '12px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', flexDirection: 'column', gap: '12px'
        }}>
            {isMobile && (
                <button 
                    onClick={toggleAudioMode}
                    style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: audioMode === 'cinema' ? 'rgba(33, 150, 243, 0.1)' : 'rgba(76, 175, 80, 0.1)',
                        color: audioMode === 'cinema' ? '#64b5f6' : '#81c784',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    {audioMode === 'cinema' ? (
                        <>
                            <i className="fas fa-film"></i>
                            {I18N.tr.cinemaMode}
                        </>
                    ) : (
                        <>
                            <i className="fas fa-microphone"></i>
                            {I18N.tr.voiceMode}
                        </>
                    )}
                </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                        background: avatar.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1.5px solid rgba(255,255,255,0.3)'
                    }}>
                        {avatar.url ? (
                            <img src={avatar.url} alt="Me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : avatar.icon ? (
                            <i className={avatar.icon} style={{ fontSize: '14px', color: '#fff' }} />
                        ) : (
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#fff' }}>{(localParticipant?.identity || 'B').charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>
                        {localParticipant?.identity || 'Ben'}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={toggleMic}
                        disabled={isMobile && audioMode === 'cinema'}
                        style={{
                            background: !isMicEnabled ? '#f44336' : 'rgba(255,255,255,0.1)',
                            opacity: (isMobile && audioMode === 'cinema') ? 0.5 : 1,
                            border: 'none', borderRadius: '8px',
                            width: '32px', height: '32px', cursor: (isMobile && audioMode === 'cinema') ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', transition: 'all 0.2s'
                        }}
                        title={!isMicEnabled ? "Sesi Aç" : "Sessize Al"}
                    >
                        <i className={`fas ${!isMicEnabled ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                    </button>
                    <button 
                        onClick={onLeave}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none', borderRadius: '8px',
                            width: '32px', height: '32px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#ff4b4b', transition: 'all 0.2s'
                        }}
                        title="Bağlantıyı Kes"
                    >
                        <i className="fas fa-phone-slash"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

const ConnectionStatusUI = () => {
    const state = useConnectionState();
    
    if (state === ConnectionState.Connecting || state === ConnectionState.Reconnecting) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                Bağlanıyor...
            </div>
        );
    }
    return null;
};

// --- Main Layout ---

export const VoiceSidebar = ({ roomCode, username, onLeave }) => {
    const { 
        token, 
        wsUrl, 
        hasJoined, 
        isConnecting, 
        error, 
        requestPermission, 
        toggleAudioMode,
        audioMode,
        isMobile
    } = useVoiceChat(roomCode, username);

    // FIX: Check error first!
    if (error && !token) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#ff6b6b' }}>
                <i className="fas fa-exclamation-triangle" style={{ fontSize: '24px', marginBottom: '10px' }}></i>
                <div>{error}</div>
                <button 
                    onClick={() => window.location.reload()} 
                    style={{ marginTop: '10px', padding: '8px 16px', background: '#333', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Tekrar Dene
                </button>
            </div>
        );
    }

    if (!token || !wsUrl) {
        return (
            <div style={{ padding: '20px', color: '#888', textAlign: 'center' }}>
                Ses sunucusuna bağlanılıyor...
            </div>
        );
    }

    // Join Screen
    if (!hasJoined) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ width: '64px', height: '64px', background: 'rgba(76, 175, 80, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <i className="fas fa-microphone-alt" style={{ fontSize: '24px', color: '#4CAF50' }}></i>
                </div>
                <h3 style={{ margin: '0 0 8px 0', color: 'white' }}>Sesli Sohbet</h3>
                <p style={{ margin: '0 0 24px 0', color: '#888', textAlign: 'center', fontSize: '13px' }}>
                    {isMobile 
                        ? 'Mobilde yüksek kaliteli film sesi için Sinema Modu önerilir.' 
                        : 'Konuşmak için sohbete katılın.'}
                </p>
                
                {error && (
                    <div style={{ 
                        background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)',
                        borderRadius: '8px', padding: '12px', marginBottom: '20px',
                        color: '#ff8a80', fontSize: '12px', textAlign: 'center'
                    }}>
                        <i className="fas fa-exclamation-circle" style={{ marginRight: '6px' }}></i>
                        {error}
                    </div>
                )}

                <button 
                    onClick={() => requestPermission(false)}
                    disabled={isConnecting}
                    style={{
                        background: '#4CAF50', color: 'white', border: 'none',
                        padding: '12px 24px', borderRadius: '8px', fontWeight: '600',
                        cursor: isConnecting ? 'wait' : 'pointer', width: '100%', fontSize: '14px',
                        boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                        transition: 'transform 0.1s',
                        opacity: isConnecting ? 0.7 : 1
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    {isConnecting ? 'Bağlanıyor...' : (isMobile && audioMode === 'cinema' ? 'Sadece Dinle (Sinema Modu)' : 'Sohbete Katıl')}
                </button>
            </div>
        );
    }

    return (
        <LiveKitRoom
            video={false}
            audio={true}
            token={token}
            serverUrl={wsUrl}
            data-lk-theme="default"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            connect={true}
            options={VOICE_CONFIG.audioDefaults}
            onError={(err) => console.error("LiveKit Error:", err)}
        >
            <RoomAudioRenderer />
            
            <div style={{
                padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.2)', marginBottom: '4px'
            }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fas fa-hashtag" style={{ color: '#888' }}></i>
                    Genel Sohbet
                </h3>
                <div style={{ fontSize: '12px', color: '#4CAF50', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4CAF50' }}></span>
                    Ses Bağlantısı Aktif
                </div>
            </div>

            <ConnectionStatusUI />
            <ParticipantList />
            <UserControls 
                roomCode={roomCode} 
                onLeave={onLeave} 
                toggleAudioMode={toggleAudioMode}
                audioMode={audioMode}
                isMobile={isMobile}
            />
        </LiveKitRoom>
    );
};
