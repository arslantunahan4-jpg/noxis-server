// src/hooks/useVoiceChat.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { VOICE_CONFIG, I18N } from '../config/party';

const isMobileDevice = () => {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const useVoiceChat = (roomCode, username, options = {}) => {
  const { lang = 'tr' } = options;
  
  // State
  const [state, setState] = useState({
    token: '',
    wsUrl: '',
    hasJoined: false,
    isConnecting: false,
    error: null,
    connectionState: 'disconnected', 
    audioMode: isMobileDevice() ? 'cinema' : 'voice',
    isMobile: isMobileDevice(),
  });

  const abortControllerRef = useRef(null);

  // Fetch token logic
  useEffect(() => {
    if (!roomCode || !username) return;

    const fetchToken = async () => {
      try {
        const authToken = localStorage.getItem('noxis_auth_token');
        
        // Use AbortController to cancel pending requests on unmount
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        const res = await fetch(VOICE_CONFIG.tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            roomName: `party_${roomCode}`,
            participantName: username
          }),
          signal: abortControllerRef.current.signal
        });

        if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);

        const data = await res.json();
        setState(prev => ({ 
          ...prev, 
          token: data.token,
          wsUrl: data.wsUrl || VOICE_CONFIG.wsUrl 
        }));
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Voice token error:', err);
        setState(prev => ({ 
          ...prev, 
          error: I18N[lang].connectError,
          connectionState: 'error' 
        }));
      }
    };

    fetchToken();
    
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [roomCode, username, lang]);

  // Reset join state when room changes
  useEffect(() => {
    setState(prev => ({ 
      ...prev, 
      hasJoined: false, 
      error: null,
      audioMode: isMobileDevice() ? 'cinema' : 'voice'
    }));
  }, [roomCode]);

  const toggleAudioMode = useCallback(async () => {
    if (!state.isMobile) return;

    const newMode = state.audioMode === 'cinema' ? 'voice' : 'cinema';
    
    
    setState(prev => ({ ...prev, audioMode: newMode }));
    
    
    
    if (newMode === 'voice') {
      
      return await requestPermission(true);
    } else {
      return true;
    }
  }, [state.audioMode, state.isMobile]);

  const requestPermission = useCallback(async (forceVoice = false) => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    // Check secure context
    if (!navigator.mediaDevices?.getUserMedia) {
      setState(prev => ({
        ...prev,
        error: I18N[lang].micError,
        isConnecting: false
      }));
      return false;
    }

    try {
      
      const shouldSkipMic = state.isMobile && state.audioMode === 'cinema' && !forceVoice;

      if (shouldSkipMic) {
        setState(prev => ({
          ...prev,
          hasJoined: true,
          isConnecting: false,
          connectionState: 'connected'
        }));
        return true;
      }

      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: VOICE_CONFIG.audioDefaults.audioCaptureDefaults
      });
      
      
      stream.getTracks().forEach(track => track.stop());

      setState(prev => ({
        ...prev,
        hasJoined: true,
        isConnecting: false,
        connectionState: 'connected'
      }));
      return true;
    } catch (err) {
      console.error('Mic permission error:', err);
      
      let errorMsg = err.message;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = I18N[lang].micDenied;
      } else if (err.name === 'NotFoundError') {
        errorMsg = I18N[lang].micNotFound;
      }

      setState(prev => ({
        ...prev,
        error: errorMsg,
        isConnecting: false,
        connectionState: 'error'
      }));
      return false;
    }
  }, [lang, state.isMobile, state.audioMode]);

  const leave = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasJoined: false,
      connectionState: 'disconnected'
    }));
  }, []);

  return {
    ...state,
    requestPermission,
    toggleAudioMode,
    leave,
    roomName: `party_${roomCode}`,
  };
};
