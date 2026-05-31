import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_CONFIG, PARTY_CONFIG, I18N } from '../config/party';

export const usePartySocket = (videoRef, imdbId, username, options = {}) => {
  const { lang = 'tr' } = options;

  const [state, setState] = useState({
    roomCode: null,
    isHost: false,
    partyViewers: 1,
    participants: [],
    syncStatus: '',
    isHostBuffering: false,
  });
  const [toasts, setToasts] = useState([]);

  const socketRef = useRef(null);
  const isHostRef = useRef(false);
  const lastBroadcastRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  const addToast = useCallback((msgKey, duration = PARTY_CONFIG.toasts.duration) => {
    const id = Date.now();
    const message = typeof msgKey === 'string' ? msgKey : (msgKey[lang] || msgKey.en || msgKey);

    setToasts(prev => {
      const newToasts = [...prev, { id, msg: message }];
      if (newToasts.length > PARTY_CONFIG.toasts.maxCount) {
        return newToasts.slice(newToasts.length - PARTY_CONFIG.toasts.maxCount);
      }
      return newToasts;
    });

    const timeout = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);

    return () => clearTimeout(timeout);
  }, [lang]);

  useEffect(() => {
    const socket = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    socketRef.current = socket;

    const handleConnect = () => {
      console.log('🔌 Socket Connected:', socket.id);
    };

    const handleDisconnect = (reason) => {
      console.log('🔌 Socket Disconnected:', reason);
      if (reason === 'io server disconnect') {
        reconnectTimeoutRef.current = setTimeout(() => socket.connect(), 1000);
      }
      addToast(I18N[lang].connectError);
    };

    const handleRoleUpdate = ({ isHost: hostStatus }) => {
      isHostRef.current = hostStatus;
      setState(prev => ({
        ...prev,
        isHost: hostStatus,
        syncStatus: hostStatus ? I18N[lang].host : I18N[lang].viewer
      }));
      addToast(hostStatus ? "Artık Yöneticisiniz 👑" : "İzleyici Modu");
    };

    const handleParticipantsUpdate = (users) => {
      setState(prev => ({
        ...prev,
        participants: users,
        partyViewers: users.length
      }));
    };

    const handleBufferStart = () => {
      setState(prev => ({ ...prev, isHostBuffering: true }));
      if (videoRef?.current) videoRef.current.pause();
    };

    const handleBufferEnd = () => {
      setState(prev => ({ ...prev, isHostBuffering: false }));
      if (videoRef?.current) {
        videoRef.current.play().catch(() => {});
      }
    };

    const handleSyncState = (syncState) => {
      if (isHostRef.current || !videoRef?.current) return;

      const { currentTime, isPaused, timestamp } = syncState;
      const now = Date.now();
      const latency = timestamp ? (now - timestamp) / 1000 : 0;
      const targetTime = currentTime + (isPaused ? 0 : latency);

      const video = videoRef.current;
      const drift = video.currentTime - targetTime;
      const { hardSeek, softSync, playbackRateAdjust } = PARTY_CONFIG.syncThresholds;

      if (isPaused && !video.paused) {
        video.pause();
      } else if (!isPaused && video.paused) {
        video.play().catch(() => {});
      }

      if (Math.abs(drift) > hardSeek) {
        video.currentTime = targetTime;
        setState(prev => ({ ...prev, syncStatus: I18N[lang].syncHard }));
      } else if (Math.abs(drift) > softSync) {
        const rate = drift > 0 ? 1 - playbackRateAdjust : 1 + playbackRateAdjust;
        video.playbackRate = rate;
        setState(prev => ({ ...prev, syncStatus: I18N[lang].syncSoft }));
      } else {
        if (video.playbackRate !== 1) video.playbackRate = 1;
        setState(prev => ({ ...prev, syncStatus: I18N[lang].syncPerfect }));
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('role_update', handleRoleUpdate);
    socket.on('participants_update', handleParticipantsUpdate);
    socket.on('toast', ({ msg }) => addToast(msg));
    socket.on('buffer_start', handleBufferStart);
    socket.on('buffer_end', handleBufferEnd);
    socket.on('sync_state', handleSyncState);

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('role_update', handleRoleUpdate);
      socket.off('participants_update', handleParticipantsUpdate);
      socket.off('buffer_start', handleBufferStart);
      socket.off('buffer_end', handleBufferEnd);
      socket.off('sync_state', handleSyncState);
      socket.off('toast');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addToast, lang]);

  const joinRoom = useCallback((code) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not initialized'));
        return;
      }
      
      // If socket not connected, wait for connection
      if (!socketRef.current.connected) {
        socketRef.current.connect();
        
        const connectHandler = () => {
          socketRef.current.off('connect', connectHandler);
          performJoin();
        };
        
        socketRef.current.on('connect', connectHandler);
        
        // Timeout if connection takes too long
        setTimeout(() => {
          socketRef.current.off('connect', connectHandler);
          if (!socketRef.current.connected) {
            reject(new Error('Connection timeout'));
          }
        }, 5000);
      } else {
        performJoin();
      }
      
      function performJoin() {
        const timeout = setTimeout(() => {
          reject(new Error('Join timeout'));
        }, 10000);

        socketRef.current.emit('join_room', {
          code,
          username: username || 'Misafir',
          userId: localStorage.getItem('noxis_user_id')
        }, (response) => {
          clearTimeout(timeout);
          if (response?.success) {
            setState(prev => ({ ...prev, roomCode: code }));
            resolve(code);
          } else {
            reject(new Error(response?.error || 'Failed to join room'));
          }
        });
      }
    });
  }, [username]);

  const broadcastState = useCallback((force = false) => {
    if (!socketRef.current || !isHostRef.current || !videoRef?.current) return;

    const now = Date.now();
    if (!force && now - lastBroadcastRef.current < PARTY_CONFIG.broadcastThrottleMs) return;

    lastBroadcastRef.current = now;

    socketRef.current.emit('update_state', {
      code: state.roomCode,
      state: {
        currentTime: videoRef.current.currentTime,
        isPaused: videoRef.current.paused,
        playbackRate: videoRef.current.playbackRate,
        timestamp: now
      }
    });
  }, [state.roomCode, videoRef]);

  const handleBufferStartAction = useCallback(() => {
    if (socketRef.current && isHostRef.current) {
      socketRef.current.emit('buffer_start', { code: state.roomCode });
    }
  }, [state.roomCode]);

  const handleBufferEndAction = useCallback(() => {
    if (socketRef.current && isHostRef.current) {
      socketRef.current.emit('buffer_end', { code: state.roomCode });
    }
  }, [state.roomCode]);

  const createRoom = useCallback(async () => {
    const chars = PARTY_CONFIG.roomCodeChars;
    let code = '';
    for (let i = 0; i < PARTY_CONFIG.roomCodeLength; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    await joinRoom(code);
    return code;
  }, [joinRoom]);

  const leaveRoom = useCallback(() => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit('leave_room', { code: state.roomCode });
    }
    setState(prev => ({ ...prev, roomCode: null, isHost: false, participants: [], partyViewers: 1 }));
  }, [state.roomCode]);

  return {
    ...state,
    toasts,
    addToast,
    joinRoom,
    broadcastState,
    handleBufferStart: handleBufferStartAction,
    handleBufferEnd: handleBufferEndAction,
    createRoom,
    leaveRoom,
  };
};
