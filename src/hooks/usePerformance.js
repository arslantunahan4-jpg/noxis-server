/**
 * PERFORMANCE HOOKS - Noxis Optimization Layer
 *
 * Bu modül düşük-orta segment cihazlarda performansı artırmak için
 * kritik optimizasyon hook'larını içerir.
 *
 * İçerik:
 * - useThrottledCallback: CPU yoğun fonksiyonları throttle eder
 * - useNetworkQuality: Ağ kalitesine göre ayar yapar
 * - useDeviceCapability: Cihaz kapasitesini algılar
 * - useMemoizedStyles: Stil objelerini önbelleğe alır
 * - useVisibilityOptimization: Sayfa görünür değilken işlemleri durdurur
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ============================================================
// THROTTLE HOOK - CPU Yoğun İşlemler İçin
// ============================================================
/**
 * Bir callback'i belirli aralıklarla çalışacak şekilde throttle eder.
 * Video oynatma sırasında onTimeUpdate gibi fonksiyonlar için kritik.
 *
 * @param {Function} callback - Throttle edilecek fonksiyon
 * @param {number} delay - Minimum çağrı aralığı (ms)
 * @param {Array} deps - useCallback bağımlılıkları
 * @returns {Function} Throttle edilmiş fonksiyon
 *
 * @example
 * const throttledUpdate = useThrottledCallback(
 *   () => setProgress(video.currentTime),
 *   250, // 250ms = saniyede max 4 çağrı (60fps yerine)
 *   [video]
 * );
 */
export const useThrottledCallback = (callback, delay, deps = []) => {
    const lastCall = useRef(0);
    const lastArgs = useRef(null);
    const timeoutRef = useRef(null);
    const callbackRef = useRef(callback);

    // Always keep the latest callback
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return useCallback((...args) => {
        const now = Date.now();
        lastArgs.current = args;

        if (now - lastCall.current >= delay) {
            lastCall.current = now;
            callbackRef.current(...args);
        } else {
            // Trailing call - son değeri garantile
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                lastCall.current = Date.now();
                callbackRef.current(...lastArgs.current);
            }, delay - (now - lastCall.current));
        }
    }, [delay, ...deps]);
};


// ============================================================
// NETWORK QUALITY HOOK - Ağ Kalitesi Algılama
// ============================================================
/**
 * Kullanıcının ağ kalitesini algılar ve önerilen video kalitesini döner.
 * 2G/3G ağlarda otomatik olarak düşük kaliteye geçer.
 *
 * @returns {{
 *   quality: 'auto' | '360p' | '480p' | '720p' | '1080p',
 *   effectiveType: string,
 *   downlink: number,
 *   saveData: boolean,
 *   isSlowNetwork: boolean,
 *   rtt: number
 * }}
 *
 * @example
 * const { quality, isSlowNetwork } = useNetworkQuality();
 * if (isSlowNetwork) {
 *   // Animasyonları devre dışı bırak
 *   // Görsel kalitesini düşür
 * }
 */
export const useNetworkQuality = () => {
    const [networkInfo, setNetworkInfo] = useState({
        quality: 'auto',
        effectiveType: '4g',
        downlink: 10,
        saveData: false,
        isSlowNetwork: false,
        rtt: 50
    });

    useEffect(() => {
        const connection = navigator.connection ||
                          navigator.mozConnection ||
                          navigator.webkitConnection;

        if (!connection) {
            // API desteklenmiyor - varsayılan değerler kullan
            return;
        }

        const updateNetworkInfo = () => {
            const effectiveType = connection.effectiveType || '4g';
            const downlink = connection.downlink || 10; // Mbps
            const saveData = connection.saveData || false;
            const rtt = connection.rtt || 50; // Round-trip time in ms

            // Kalite belirleme mantığı
            let quality = 'auto';
            let isSlowNetwork = false;

            if (saveData) {
                // Kullanıcı veri tasarrufu modunda
                quality = '360p';
                isSlowNetwork = true;
            } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
                quality = '360p';
                isSlowNetwork = true;
            } else if (effectiveType === '3g' || downlink < 1.5) {
                quality = '480p';
                isSlowNetwork = true;
            } else if (effectiveType === '4g' && downlink < 5) {
                quality = '720p';
                isSlowNetwork = false;
            } else {
                quality = 'auto';
                isSlowNetwork = false;
            }

            // RTT çok yüksekse (>500ms) kaliteyi düşür
            if (rtt > 500 && quality === 'auto') {
                quality = '720p';
                isSlowNetwork = true;
            }

            setNetworkInfo({
                quality,
                effectiveType,
                downlink,
                saveData,
                isSlowNetwork,
                rtt
            });
        };

        // İlk değerlendirme
        updateNetworkInfo();

        // Ağ değişikliklerini dinle
        connection.addEventListener('change', updateNetworkInfo);

        return () => {
            connection.removeEventListener('change', updateNetworkInfo);
        };
    }, []);

    return networkInfo;
};


// ============================================================
// DEVICE CAPABILITY HOOK - Cihaz Kapasitesi Algılama
// ============================================================
/**
 * Cihazın donanım kapasitesini algılar.
 * Düşük RAM, yavaş CPU durumlarında optimizasyonları aktive eder.
 *
 * @returns {{
 *   isLowEnd: boolean,
 *   deviceMemory: number,
 *   hardwareConcurrency: number,
 *   shouldReduceMotion: boolean,
 *   performanceTier: 'low' | 'medium' | 'high'
 * }}
 */
export const useDeviceCapability = () => {
    const [capability, setCapability] = useState({
        isLowEnd: false,
        deviceMemory: 4,
        hardwareConcurrency: 4,
        shouldReduceMotion: false,
        performanceTier: 'high'
    });

    useEffect(() => {
        // Device Memory API (Chrome, Edge)
        const deviceMemory = navigator.deviceMemory || 4; // GB

        // CPU çekirdek sayısı
        const hardwareConcurrency = navigator.hardwareConcurrency || 4;

        // Kullanıcı animasyon tercihi (prefers-reduced-motion)
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const shouldReduceMotion = motionQuery.matches;

        // Performans seviyesi belirleme
        let performanceTier = 'high';
        let isLowEnd = false;

        if (deviceMemory <= 2 || hardwareConcurrency <= 2) {
            performanceTier = 'low';
            isLowEnd = true;
        } else if (deviceMemory <= 4 || hardwareConcurrency <= 4) {
            performanceTier = 'medium';
        }

        // Android WebView için ek kontrol
        const isAndroidWebView = /Android/.test(navigator.userAgent) &&
                                  /wv|WebView/.test(navigator.userAgent);
        if (isAndroidWebView && deviceMemory <= 3) {
            performanceTier = 'low';
            isLowEnd = true;
        }

        setCapability({
            isLowEnd,
            deviceMemory,
            hardwareConcurrency,
            shouldReduceMotion,
            performanceTier
        });

        // Motion preference değişikliğini dinle
        const handleMotionChange = (e) => {
            setCapability(prev => ({
                ...prev,
                shouldReduceMotion: e.matches
            }));
        };
        motionQuery.addEventListener('change', handleMotionChange);

        return () => {
            motionQuery.removeEventListener('change', handleMotionChange);
        };
    }, []);

    return capability;
};


// ============================================================
// VISIBILITY OPTIMIZATION HOOK - Sayfa Görünürlük Optimizasyonu
// ============================================================
/**
 * Sayfa arka plandayken ağır işlemleri durdurur.
 * Video oynatıcı, animasyonlar vb. için CPU tasarrufu sağlar.
 *
 * @returns {{
 *   isVisible: boolean,
 *   wasHidden: boolean
 * }}
 */
export const useVisibilityOptimization = () => {
    const [visibility, setVisibility] = useState({
        isVisible: true,
        wasHidden: false
    });

    useEffect(() => {
        const handleVisibilityChange = () => {
            const isVisible = document.visibilityState === 'visible';
            setVisibility(prev => ({
                isVisible,
                wasHidden: !isVisible ? true : prev.wasHidden
            }));
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return visibility;
};


// ============================================================
// MEMORY PRESSURE HOOK - Bellek Baskısı Algılama
// ============================================================
/**
 * Bellek kullanımını izler ve düşük bellek durumunda uyarı verir.
 * Cache temizleme, görsel kalite düşürme gibi aksiyonları tetikler.
 *
 * @param {number} checkInterval - Kontrol aralığı (ms), varsayılan 30000
 * @returns {{
 *   isUnderPressure: boolean,
 *   usedHeapMB: number,
 *   totalHeapMB: number,
 *   usagePercent: number
 * }}
 */
export const useMemoryPressure = (checkInterval = 30000) => {
    const [memoryState, setMemoryState] = useState({
        isUnderPressure: false,
        usedHeapMB: 0,
        totalHeapMB: 0,
        usagePercent: 0
    });

    useEffect(() => {
        // Performance.memory API sadece Chrome'da mevcut
        if (!performance.memory) {
            return;
        }

        const checkMemory = () => {
            const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
            const usedHeapMB = Math.round(usedJSHeapSize / 1024 / 1024);
            const totalHeapMB = Math.round(jsHeapSizeLimit / 1024 / 1024);
            const usagePercent = Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100);

            // %80 üzeri kullanımda baskı altında
            const isUnderPressure = usagePercent > 80;

            setMemoryState({
                isUnderPressure,
                usedHeapMB,
                totalHeapMB,
                usagePercent
            });

            // Kritik bellek durumunda console uyarısı
            if (usagePercent > 90) {
                console.warn(`[Performance] Kritik bellek kullanımı: ${usagePercent}% (${usedHeapMB}MB / ${totalHeapMB}MB)`);
            }
        };

        // İlk kontrol
        checkMemory();

        // Periyodik kontrol
        const intervalId = setInterval(checkMemory, checkInterval);

        return () => {
            clearInterval(intervalId);
        };
    }, [checkInterval]);

    return memoryState;
};


// ============================================================
// MEMOIZED PLAYER STYLES - Video Oynatıcı Stilleri
// ============================================================
/**
 * GlassPlayer için tüm stilleri memoize eder.
 * Her render'da yeni obje oluşturmayı önler → React diffing optimize.
 *
 * @returns {Object} Tüm player stilleri
 */
export const usePlayerStyles = () => {
    const device = useDeviceCapability();
    const isLowEnd = device.isLowEnd || device.performanceTier === 'low';

    return useMemo(() => ({
        container: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh', background: '#000', zIndex: 9999, overflow: 'hidden' },
        embeddedContainer: { position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' },
        videoWrapper: { width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        video: { width: '100%', height: '100%' },
        controlsContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))', zIndex: 20, boxSizing: 'border-box' },
        controlsGlass: {
            background: isLowEnd ? 'rgba(16, 16, 20, 0.95)' : 'rgba(16, 16, 20, 0.65)',
            backdropFilter: isLowEnd ? 'none' : 'blur(20px)',
            WebkitBackdropFilter: isLowEnd ? 'none' : 'blur(20px)',
            padding: '12px 16px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        },
        button: {
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            width: '40px',
            height: '40px',
            minWidth: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            outline: 'none',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0
        },
        progressWrapper: { height: '24px', position: 'relative', cursor: 'pointer', marginBottom: '10px', display: 'flex', alignItems: 'center' },
        progressRail: { width: '100%', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', position: 'relative', overflow: 'visible', transition: 'height 0.2s' },
        progressBar: { height: '100%', background: 'linear-gradient(90deg, #E50914, #ff4f58)', borderRadius: '4px', boxShadow: '0 0 12px rgba(229, 9, 20, 0.6)' },
        bufferBar: { height: '100%', background: 'rgba(255,255,255,0.3)', borderRadius: '4px', position: 'absolute', top: 0, left: 0 },
        scrubber: {
            width: '16px',
            height: '16px',
            background: '#fff',
            borderRadius: '50%',
            position: 'absolute',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 15px rgba(255,255,255,0.8)',
            zIndex: 5,
            pointerEvents: 'none'
        },
        bottomBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'nowrap' },
        leftControls: { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 },
        rightControls: { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 },
        timeDisplay: { color: 'rgba(255,255,255,0.9)', fontSize: '12px', marginLeft: '8px', fontFamily: '"Inter", sans-serif', fontWeight: 500, letterSpacing: '0.3px', whiteSpace: 'nowrap', flexShrink: 0 },
        volumeContainer: { position: 'relative', display: 'flex', alignItems: 'center' },
        volumeSliderContainer: {
            width: '0',
            height: '4px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '2px',
            marginLeft: '8px',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.3s ease',
            overflow: 'visible'
        },
        volumeFill: {
            height: '100%',
            background: '#fff',
            borderRadius: '2px',
            position: 'absolute',
            left: 0,
            top: 0
        },
        menu: {
            position: 'absolute',
            bottom: '60px',
            right: 0,
            background: isLowEnd ? 'rgba(20, 20, 20, 0.98)' : 'rgba(20, 20, 20, 0.95)',
            backdropFilter: isLowEnd ? 'none' : 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '8px',
            minWidth: '220px',
            maxHeight: '350px',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            transformOrigin: 'bottom right'
        },
        menuItem: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.9)',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '13px',
            borderRadius: '10px',
            transition: 'background 0.2s',
            fontWeight: 500
        },
        activeItem: { background: 'rgba(255,255,255,0.1)', color: '#fff' },
        topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: '180px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)', zIndex: 10, padding: '32px', paddingTop: 'max(32px, env(safe-area-inset-top))', paddingLeft: 'max(32px, env(safe-area-inset-left))', paddingRight: 'max(32px, env(safe-area-inset-right))', boxSizing: 'border-box' },
        gradientOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.9) 100%)', pointerEvents: 'none', zIndex: 1 },
        centerAnimation: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255,255,255,0.1)', backdropFilter: isLowEnd ? 'none' : 'blur(10px)', padding: '24px', borderRadius: '50%', zIndex: 5, border: '1px solid rgba(255,255,255,0.2)' },
        movieTitle: { color: '#fff', margin: 0, fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', textShadow: '0 4px 8px rgba(0,0,0,0.6)' }
    }), [isLowEnd]);
};


// ============================================================
// HLS CONFIG HOOK - Optimize HLS Ayarları
// ============================================================
/**
 * Cihaz ve ağ durumuna göre optimize HLS.js konfigürasyonu döner.
 *
 * @returns {Object} HLS.js config objesi
 */
export const useOptimizedHlsConfig = () => {
    const network = useNetworkQuality();
    const device = useDeviceCapability();

    return useMemo(() => {
        const baseConfig = {
            enableWorker: true,
            lowLatencyMode: false, // VOD için false
            backBufferLength: 30, // Arkada 30sn buffer tut
            manifestLoadingTimeOut: 20000,
            manifestLoadingMaxRetry: 6,
            manifestLoadingRetryDelay: 1000,
            levelLoadingTimeOut: 20000,
            levelLoadingMaxRetry: 6,
            levelLoadingRetryDelay: 1000,
            fragLoadingTimeOut: 30000,
            fragLoadingMaxRetry: 10,
            fragLoadingRetryDelay: 1000,
            startFragPrefetch: true,
        };

        if (device.isLowEnd || network.isSlowNetwork) {
            // Düşük segment cihazlar için optimize ayarlar
            return {
                ...baseConfig,
                maxBufferLength: 30,        // Max 30sn ileri buffer
                maxMaxBufferLength: 60,     // Asla 60sn'yi geçme
                maxBufferSize: 30 * 1000 * 1000, // 30MB max buffer
                maxBufferHole: 0.8,         // Buffer boşluk toleransı (artırıldı)
                highBufferWatchdogPeriod: 2,
                // Düşük kaliteye hızlı geçiş
                abrEwmaDefaultEstimate: network.isSlowNetwork ? 500000 : 1000000, // bit/s
                abrBandWidthFactor: 0.8,
                abrBandWidthUpFactor: 0.5,
                startLevel: network.isSlowNetwork ? 0 : -1, // Yavaş ağda en düşük kaliteden başla
            };
        }

        // Normal/yüksek performanslı cihazlar için
        return {
            ...baseConfig,
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            maxBufferSize: 60 * 1000 * 1000, // 60MB
            startLevel: -1, // Auto
            maxBufferHole: 0.5,
        };
    }, [device.isLowEnd, network.isSlowNetwork]);
};


// ============================================================
// ANIMATION CONFIG - Animasyon Optimizasyonu
// ============================================================
/**
 * Cihaz kapasitesine göre Framer Motion animasyon ayarlarını döner.
 * Düşük performanslı cihazlarda animasyonları basitleştirir/devre dışı bırakır.
 *
 * @returns {Object} Framer Motion transition config
 */
export const useOptimizedAnimations = () => {
    const device = useDeviceCapability();
    const network = useNetworkQuality();

    return useMemo(() => {
        // Animasyonları tamamen devre dışı bırak
        if (device.shouldReduceMotion || device.performanceTier === 'low') {
            return {
                skipAnimation: true,
                transition: { duration: 0 },
                variants: {
                    hidden: { opacity: 0 },
                    visible: { opacity: 1 }
                }
            };
        }

        // Orta seviye - basitleştirilmiş animasyonlar
        if (device.performanceTier === 'medium' || network.isSlowNetwork) {
            return {
                skipAnimation: false,
                transition: {
                    duration: 0.15,
                    ease: 'easeOut'
                },
                variants: {
                    hidden: { opacity: 0 },
                    visible: { opacity: 1 }
                }
            };
        }

        // Yüksek performans - tam animasyonlar
        return {
            skipAnimation: false,
            transition: {
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1] // cubic-bezier
            },
            variants: {
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
            }
        };
    }, [device.shouldReduceMotion, device.performanceTier, network.isSlowNetwork]);
};


// ============================================================
// EXPORT DEFAULT - Tüm Hook'ları Tek Noktadan Kullanım
// ============================================================
export default {
    useThrottledCallback,
    useNetworkQuality,
    useDeviceCapability,
    useVisibilityOptimization,
    useMemoryPressure,
    usePlayerStyles,
    useOptimizedHlsConfig,
    useOptimizedAnimations
};
