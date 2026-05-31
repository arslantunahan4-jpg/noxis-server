import React from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { VOICE_CONFIG, I18N } from '../../config/party';

// --- Sub Components ---

const ParticipantAvatar = ({ participant }) => {
    const { isSpeaking, isMicrophoneEnabled, identity } = participant;
    
    return (
        <div style={{
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            margin: '0 8px', transition: 'all 0.3s ease'
        }}>
            <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: isSpeaking ? '#4CAF50' : '#333',
                border: isSpeaking ? '3px solid #4CAF50' : '3px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: isSpeaking ? '0 0 15px rgba(76, 175, 80, 0.6)' : 'none',
                transition: 'all 0.2s'
            }}>
                <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${identity}`} 
                    alt={identity}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
            
            {!isMicrophoneEnabled && (
                <div style={{
                    position: 'absolute', top: '0', right: '0',
                    background: '#E50914', borderRadius: '50%',
                    width: '16px', height: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', color: 'white'
                }}>
                    <i className="fas fa-microphone-slash"></i>
                </div>
            )}
            
            <div style={{
                marginTop: '4px', fontSize: '12px',
                color: 'rgba(255,255,255,0.8)',
                maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
                {identity}
            </div>
        </div>
    );
};

const VoiceControls = ({ toggleAudioMode, audioMode, isMobile }) => {
    const { localParticipant } = useLocalParticipant();
    const isMicEnabled = localParticipant?.isMicrophoneEnabled;

    const toggleMic = async () => {
        if (!localParticipant) return;
        
        if (isMobile && audioMode === 'cinema') {
            toggleAudioMode();
            return;
        }

        const enabled = !localParticipant.isMicrophoneEnabled;
        await localParticipant.setMicrophoneEnabled(enabled);
    };

    return (
        <button 
            className="glass-btn"
            onClick={toggleMic}
            style={{
                background: !isMicEnabled ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: !isMicEnabled ? '1px solid #E50914' : '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%', width: '48px', height: '48px',
                color: 'white', fontSize: '20px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginRight: '16px',
                opacity: (isMobile && audioMode === 'cinema') ? 0.7 : 1
            }}
            title={isMobile && audioMode === 'cinema' ? "Konuşmak için bas" : (isMicEnabled ? "Sessize Al" : "Sesi Aç")}
        >
            <i className={`fas ${!isMicEnabled ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
        </button>
    );
};

const ActiveSpeakers = () => {
    const participants = useParticipants();
    
    const sorted = [...participants].sort((a, b) => {
        if (a.isSpeaking === b.isSpeaking) return 0;
        return a.isSpeaking ? -1 : 1;
    });

    return (
        <div style={{ display: 'flex', overflowX: 'auto', padding: '8px 0', maxWidth: '300px' }}>
            {sorted.map(p => (
                <ParticipantAvatar key={p.sid} participant={p} />
            ))}
        </div>
    );
};

// --- Main Layout ---

export const VoiceChat = ({ roomCode, username, onConnected }) => {
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

    if (!token || !wsUrl) return null;

    if (!hasJoined) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {error && (
                    <div style={{ 
                        color: '#ff6b6b', fontSize: '12px', 
                        maxWidth: '150px', textAlign: 'center'
                    }}>
                        <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                        {error}
                    </div>
                )}
                <button 
                    onClick={requestPermission}
                    className="glass-btn"
                    style={{
                        background: 'rgba(76, 175, 80, 0.2)',
                        border: '1px solid rgba(76, 175, 80, 0.4)',
                        borderRadius: '8px', padding: '8px 16px',
                        color: '#4CAF50', fontSize: '13px', fontWeight: '600',
                        cursor: isConnecting ? 'wait' : 'pointer', 
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                    disabled={isConnecting}
                >
                    {isConnecting ? (
                        <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                        <i className="fas fa-microphone"></i>
                    )}
                    {isConnecting ? '...' : 'Sese Katıl'}
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
            style={{ display: 'flex', alignItems: 'center' }}
            onConnected={onConnected}
            connect={true}
            options={VOICE_CONFIG.audioDefaults}
            onError={(err) => console.error("LiveKit Error:", err)}
        >
            <VoiceControls 
                toggleAudioMode={toggleAudioMode} 
                audioMode={audioMode} 
                isMobile={isMobile} 
            />
            <ActiveSpeakers />
            <RoomAudioRenderer />
        </LiveKitRoom>
    );
};
