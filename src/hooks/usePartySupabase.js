import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const usePartySupabase = (videoRef, imdbId) => {
    const [roomCode, setRoomCode] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const [partyViewers, setPartyViewers] = useState(1);
    const [syncStatus, setSyncStatus] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    // Channel needs to be kept in a ref to persist across renders without re-subscribing
    const channelRef = useRef(null);
    const isHostRef = useRef(false);

    // Initial Cleanup
    useEffect(() => {
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, []);

    const createRoom = async () => {
        const newCode = Math.floor(1000 + Math.random() * 9000).toString();
        await joinChannel(newCode, true);
        return newCode;
    };

    const joinRoom = async (code) => {
        if (!code || code.length !== 4) throw new Error("Invalid code");
        await joinChannel(code, false);
        return code;
    };

    const leaveRoom = async () => {
        if (channelRef.current) {
            await supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
        setRoomCode(null);
        setIsHost(false);
        setPartyViewers(1);
        setSyncStatus('');
    };

    const joinChannel = async (code, host) => {
        // Cleanup existing
        if (channelRef.current) await supabase.removeChannel(channelRef.current);

        setRoomCode(code);
        setIsHost(host);
        isHostRef.current = host;
        setSyncStatus(host ? 'Oda oluşturuldu' : 'Odaya katıldın');

        const channel = supabase.channel(`party_${code}`, {
            config: {
                presence: {
                    key: host ? 'host' : `viewer_${Math.random().toString(36).substr(2, 6)}`
                }
            }
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const total = Object.keys(state).length;
                setPartyViewers(total);

                // If we are a new viewer, request current state from host
                if (!host) {
                    channel.send({
                        type: 'broadcast',
                        event: 'request_state',
                        payload: {}
                    });
                }
            })
            .on('broadcast', { event: 'play_state' }, ({ payload }) => {
                if (!videoRef.current || isHostRef.current) return;

                handleRemoteUpdate(payload);
            })
            .on('broadcast', { event: 'request_state' }, () => {
                if (isHostRef.current && videoRef.current) {
                    broadcastState();
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    channel.track({
                        online_at: new Date().toISOString(),
                        isHost: host
                    });
                }
            });

        channelRef.current = channel;
    };

    const handleRemoteUpdate = (payload) => {
        if (!videoRef.current) return;
        setIsSyncing(true);

        const { currentTime, isPaused, timestamp } = payload;

        // Calculate network latency impact (optional enhancement)
        const now = Date.now();
        const latency = now - timestamp; // Simple latency calc if clocks synced (they aren't perfectly, but ok estimation)

        // Sync Time if drift > 2 seconds
        if (Math.abs(videoRef.current.currentTime - currentTime) > 2) {
            videoRef.current.currentTime = currentTime;
            setSyncStatus('Senkronize edildi');
        }

        // Sync Play/Pause
        if (isPaused && !videoRef.current.paused) {
            videoRef.current.pause();
            setSyncStatus('Duraklatıldı (Host)');
        } else if (!isPaused && videoRef.current.paused) {
            videoRef.current.play().catch(() => { });
            setSyncStatus('Oynatılıyor (Host)');
        }

        setTimeout(() => setIsSyncing(false), 500);
    };

    const broadcastState = useCallback(() => {
        if (!channelRef.current || !isHost || !videoRef.current || isSyncing) return;

        channelRef.current.send({
            type: 'broadcast',
            event: 'play_state',
            payload: {
                currentTime: videoRef.current.currentTime,
                isPaused: videoRef.current.paused,
                timestamp: Date.now()
            }
        });
    }, [isHost, isSyncing, videoRef]);

    return {
        roomCode,
        isHost,
        partyViewers,
        syncStatus,
        createRoom,
        joinRoom,
        leaveRoom,
        broadcastState
    };
};
