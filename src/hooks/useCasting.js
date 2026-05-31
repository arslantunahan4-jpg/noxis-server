import { useEffect, useRef, useState, useCallback } from 'react';

const loadCastScript = () => {
    return new Promise((resolve) => {
        if (window.cast?.framework) {
            resolve(true);
            return;
        }

        if (window.__castScriptLoading) {
            const checkLoaded = setInterval(() => {
                if (window.cast?.framework) {
                    clearInterval(checkLoaded);
                    resolve(true);
                }
            }, 100);
            return;
        }

        window.__castScriptLoading = true;

        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
        script.async = true;

        window['__onGCastApiAvailable'] = (isAvailable) => {
            window.__castScriptLoading = false;
            resolve(isAvailable);
        };

        script.onerror = () => {
            window.__castScriptLoading = false;
            resolve(false);
        };

        document.head.appendChild(script);
    });
};

const useChromecast = (options = {}) => {
    const [isCastAvailable, setIsCastAvailable] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isCasting, setIsCasting] = useState(false);
    const [receiverName, setReceiverName] = useState(null);
    const [isChecking, setIsChecking] = useState(true);
    const [error, setError] = useState(null);

    const castContextRef = useRef(null);
    const remotePlayerRef = useRef(null);
    const remotePlayerControllerRef = useRef(null);

    useEffect(() => {
        let timeoutId;
        
        const initializeCast = async () => {
            try {
                setIsChecking(true);
                const isAvailable = await loadCastScript();
                
                if (!isAvailable || !window.cast?.framework) {
                    setError('Cast API yüklenemedi');
                    setIsChecking(false);
                    return;
                }

                const castContext = window.cast.framework.CastContext.getInstance();
                castContextRef.current = castContext;

                castContext.setOptions({
                    receiverApplicationId: window.chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
                    autoJoinPolicy: window.chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED || 'origin_scoped',
                });

                const remotePlayer = new window.cast.framework.RemotePlayer();
                remotePlayerRef.current = remotePlayer;

                const remotePlayerController = new window.cast.framework.RemotePlayerController(remotePlayer);
                remotePlayerControllerRef.current = remotePlayerController;

                castContext.addEventListener(
                    window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
                    (event) => {
                        const state = event.castState;
                        const available = state !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE;
                        setIsCastAvailable(available);
                        setIsConnected(state === window.cast.framework.CastState.CONNECTED);
                        setIsChecking(false);

                        if (state === window.cast.framework.CastState.CONNECTED) {
                            const session = castContext.getCurrentSession();
                            if (session) {
                                setReceiverName(session.getCastDevice()?.friendlyName || 'Cast Device');
                            }
                        } else {
                            setReceiverName(null);
                        }

                        options.onCastStateChanged?.(state);
                    }
                );

                remotePlayerController.addEventListener(
                    window.cast.framework.RemotePlayerEventType.IS_MEDIA_LOADED_CHANGED,
                    () => {
                        setIsCasting(remotePlayer.isMediaLoaded);
                        options.onMediaLoaded?.();
                    }
                );

                const initialState = castContext.getCastState();
                setIsCastAvailable(initialState !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE);
                setIsChecking(false);

            } catch (e) {
                setIsChecking(false);
            }
        };

        // 5 second timeout - stop checking after that
        timeoutId = setTimeout(() => {
            setIsChecking(false);
        }, 5000);

        initializeCast();
        
        return () => {
            clearTimeout(timeoutId);
        };
    }, []);

    const loadMedia = useCallback(async (mediaUrl, metadata = {}) => {
        if (!castContextRef.current) {
            throw new Error('Cast not initialized');
        }

        const session = castContextRef.current.getCurrentSession();
        if (!session) {
            throw new Error('No active cast session');
        }

        const mediaInfo = new window.chrome.cast.media.MediaInfo(mediaUrl, 'application/x-mpegURL');
        mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();

        if (metadata.title) mediaInfo.metadata.title = metadata.title;
        if (metadata.subtitle) mediaInfo.metadata.subtitle = metadata.subtitle;
        if (metadata.images && metadata.images.length > 0) {
            mediaInfo.metadata.images = metadata.images.map(url =>
                new window.chrome.cast.Image(url)
            );
        }

        const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
        request.currentTime = metadata.currentTime || 0;
        request.autoplay = true;

        await session.loadMedia(request);
    }, []);

    const play = useCallback(() => {
        remotePlayerControllerRef.current?.playOrPause();
    }, []);

    const pause = useCallback(() => {
        remotePlayerControllerRef.current?.playOrPause();
    }, []);

    const seek = useCallback((time) => {
        if (remotePlayerRef.current) {
            remotePlayerRef.current.currentTime = time;
            remotePlayerControllerRef.current?.seek();
        }
    }, []);

    const stop = useCallback(() => {
        castContextRef.current?.endCurrentSession(true);
    }, []);

    const showCastDialog = useCallback(() => {
        castContextRef.current?.requestSession();
    }, []);

    return {
        isCastAvailable,
        isConnected,
        isCasting,
        receiverName,
        isChecking,
        error,
        loadMedia,
        play,
        pause,
        seek,
        stop,
        showCastDialog,
    };
};

const useAirPlay = (videoRef) => {
    const [isAirPlayAvailable, setIsAirPlayAvailable] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const video = videoRef?.current;
        if (!video) return;

        const hasAirPlay = !!(
            window.WebKitPlaybackTargetAvailabilityEvent ||
            video.webkitCurrentPlaybackTargetIsWireless !== undefined ||
            video.webkitShowPlaybackTargetPicker
        );

        if (!hasAirPlay) {
            return;
        }

        const handleAvailabilityChange = (event) => {
            setIsAirPlayAvailable(event.availability === 'available');
        };

        const handleConnectionChange = () => {
            setIsConnected(!!video.webkitCurrentPlaybackTargetIsWireless);
        };

        video.addEventListener('webkitplaybacktargetavailabilitychanged', handleAvailabilityChange);
        video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleConnectionChange);

        return () => {
            video.removeEventListener('webkitplaybacktargetavailabilitychanged', handleAvailabilityChange);
            video.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleConnectionChange);
        };
    }, [videoRef]);

    const showAirPlayPicker = useCallback(() => {
        const video = videoRef?.current;
        if (video?.webkitShowPlaybackTargetPicker) {
            video.webkitShowPlaybackTargetPicker();
        }
    }, [videoRef]);

    return {
        isAirPlayAvailable,
        isConnected,
        showAirPlayPicker,
    };
};

const useRemotePlayback = (videoRef) => {
    const [isAvailable, setIsAvailable] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionState, setConnectionState] = useState('disconnected');
    const watchIdRef = useRef(null);

    useEffect(() => {
        const video = videoRef?.current;
        if (!video?.remote) return;

        video.remote.watchAvailability((available) => {
            setIsAvailable(available);
        }).then((id) => {
            watchIdRef.current = id;
        }).catch(() => {
            setIsAvailable(false);
        });

        const handleConnect = () => {
            setConnectionState(video.remote.state);
            setIsConnected(video.remote.state === 'connected');
        };

        const handleDisconnect = () => {
            setConnectionState('disconnected');
            setIsConnected(false);
        };

        const handleConnecting = () => {
            setConnectionState('connecting');
        };

        video.remote.addEventListener('connect', handleConnect);
        video.remote.addEventListener('disconnect', handleDisconnect);
        video.remote.addEventListener('connecting', handleConnecting);

        return () => {
            if (watchIdRef.current !== null && video.remote) {
                video.remote.cancelWatchAvailability(watchIdRef.current).catch(() => {});
            }
            video.remote?.removeEventListener('connect', handleConnect);
            video.remote?.removeEventListener('disconnect', handleDisconnect);
            video.remote?.removeEventListener('connecting', handleConnecting);
        };
    }, [videoRef]);

    const showPicker = useCallback(async () => {
        const video = videoRef?.current;
        if (!video?.remote) return;

        try {
            await video.remote.prompt();
        } catch (error) {
            if (error.name !== 'NotAllowedError') {
                console.warn('Remote playback prompt failed:', error);
            }
        }
    }, [videoRef]);

    return {
        isAvailable,
        isConnected,
        connectionState,
        showPicker,
    };
};

export const useCasting = (videoRef, options = {}) => {
    const chromecast = useChromecast(options);
    const airplay = useAirPlay(videoRef);
    const remotePlayback = useRemotePlayback(videoRef);

    const canCast = chromecast.isCastAvailable || airplay.isAirPlayAvailable || remotePlayback.isAvailable;
    const isCasting = chromecast.isConnected || airplay.isConnected || remotePlayback.isConnected;
    const isChecking = chromecast.isChecking;

    const activeCastType = chromecast.isConnected ? 'chromecast' :
        airplay.isConnected ? 'airplay' :
            remotePlayback.isConnected ? 'remote' : null;

    const receiverName = chromecast.receiverName ||
        (airplay.isConnected ? 'AirPlay' : null) ||
        (remotePlayback.isConnected ? 'TV' : null);

    const showCastPicker = useCallback(() => {
        if (remotePlayback.isAvailable) {
            remotePlayback.showPicker();
        } else if (chromecast.isCastAvailable) {
            chromecast.showCastDialog();
        } else if (airplay.isAirPlayAvailable) {
            airplay.showAirPlayPicker();
        }
    }, [chromecast, airplay, remotePlayback]);

    const stopCasting = useCallback(() => {
        if (chromecast.isConnected) {
            chromecast.stop();
        }
    }, [chromecast]);

    return {
        canCast,
        isCasting,
        isChecking,
        activeCastType,
        receiverName,
        showCastPicker,
        stopCasting,
        chromecast,
        airplay,
        remotePlayback,
    };
};

export default useCasting;
