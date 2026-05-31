// src/config/party.js
import { getApiBaseUrl } from '../utils/apiBaseUrl';

export const API_URL = getApiBaseUrl();

export const SOCKET_CONFIG = (() => {
  // Always connect to the backend API server URL (e.g. api.noxis.tech)
  const url = API_URL; 

  return {
    url,
    options: {
      path: '/socket.io/', // Standard socket.io path that Nginx proxies
      transports: ['websocket', 'polling'], // Allow fallback
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: true,
      withCredentials: true
    }
  };
})();

// Party Room Settings
export const PARTY_CONFIG = {
  broadcastThrottleMs: 500,
  syncThresholds: {
    hardSeek: 2.0,      
    softSync: 0.25,     
    playbackRateAdjust: 0.05,  
  },
  roomCodeLength: 6,
  roomCodeChars: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  toasts: {
    duration: 3000,
    maxCount: 3
  }
};

// Voice Settings
export const VOICE_CONFIG = {
  wsUrl: import.meta.env.VITE_LIVEKIT_URL || '', 
  tokenEndpoint: `${API_URL}/api/livekit/token`,
  
  audioDefaults: {
    publishDefaults: {
      audioPreset: 'speech', 
      dtx: true,             
      red: true,             
    },
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    }
  },

  mobile: {
    lowBatteryThreshold: 0.2,
  }
};

// Internationalization for Party features
export const I18N = {
  tr: {
    host: 'Yönetici (Host)',
    viewer: 'İzleyici',
    syncHard: 'Senkronize (Atlama)',
    syncSoft: 'Hassas Senkron...',
    syncPerfect: 'Senkronize ✅',
    micError: 'Mikrofon hatası',
    micDenied: 'Mikrofon izni reddedildi',
    micNotFound: 'Mikrofon bulunamadı',
    connectError: 'Bağlantı hatası',
    cinemaMode: 'Sinema Modu (Sadece Dinle)',
    voiceMode: 'Sohbet Modu (Konuş)',
    switchingToVoice: 'Sohbet moduna geçiliyor...',
    switchingToCinema: 'Sinema moduna geçiliyor...',
    mobileWarning: 'Bluetooth kulaklık kullanırken konuşmak ses kalitesini düşürebilir.',
  },
  en: {
    host: 'Host',
    viewer: 'Viewer',
    syncHard: 'Syncing (Seek)',
    syncSoft: 'Fine-tuning...',
    syncPerfect: 'Synced ✅',
    micError: 'Microphone error',
    micDenied: 'Microphone permission denied',
    micNotFound: 'Microphone not found',
    connectError: 'Connection error',
    cinemaMode: 'Cinema Mode (Listen Only)',
    voiceMode: 'Voice Mode (Talk)',
    switchingToVoice: 'Switching to voice mode...',
    switchingToCinema: 'Switching to cinema mode...',
    mobileWarning: 'Talking while using Bluetooth headsets may lower audio quality.',
  }
};
