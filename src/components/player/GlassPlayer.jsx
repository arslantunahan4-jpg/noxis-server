import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Hls from 'hls.js';

const HIDE_CONTROLS_DELAY = 3000;

const styles = {
    container: {
        position: 'fixed', inset: 0, background: '#000', zIndex: 9999,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        overflow: 'hidden', outline: 'none',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        touchAction: 'none'
    },
    videoWrapper: {
        width: '100%', height: '100%', position: 'relative',
        background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    video: { width: '100%', height: '100%', maxHeight: '100vh', objectFit: 'contain' },

    // Enhanced Gradients
    gradientOverlay: {
        position: 'absolute', bottom: 0, left: 0, width: '100%', height: '240px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
        pointerEvents: 'none', zIndex: 10
    },
    topGradient: {
        position: 'absolute', top: 0, left: 0, width: '100%', height: '140px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)',
        pointerEvents: 'none', zIndex: 10
    },

    controlsContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 32px 32px 32px', zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: '20px',
        pointerEvents: 'none'
    },
    controlsGlass: {
        width: '100%', maxWidth: '1100px', margin: '0 auto',
        pointerEvents: 'auto',
        display: 'flex', flexDirection: 'column', gap: '16px',
        background: 'rgba(20, 20, 20, 0.4)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)', // Safari
        padding: '20px 24px',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
    },

    bottomBar: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '20px'
    },
    leftControls: { display: 'flex', alignItems: 'center', gap: '24px' },
    rightControls: { display: 'flex', alignItems: 'center', gap: '24px' },

    button: {
        background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.95)',
        fontSize: '22px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '48px', height: '48px', borderRadius: '50%',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none',
    },

    progressWrapper: {
        width: '100%', height: '24px',
        display: 'flex', alignItems: 'center', cursor: 'pointer',
        position: 'relative', pointerEvents: 'auto',
        transition: 'height 0.2s ease', touchAction: 'none'
    },
    progressRail: {
        width: '100%', height: '4px',
        background: 'rgba(255, 255, 255, 0.15)',
        borderRadius: '2px', position: 'relative', overflow: 'hidden',
        transition: 'all 0.2s ease'
    },
    progressBar: {
        height: '100%', background: '#E50914',
        borderRadius: '2px', position: 'absolute', top: 0, left: 0, zIndex: 3,
        boxShadow: '0 0 15px rgba(229, 9, 20, 0.6)'
    },
    bufferBar: {
        height: '100%', background: 'rgba(255, 255, 255, 0.3)',
        borderRadius: '2px', position: 'absolute', top: 0, left: 0, zIndex: 2
    },
    scrubber: {
        position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
        width: '18px', height: '18px', borderRadius: '50%',
        background: '#E50914',
        border: '3px solid #fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        zIndex: 4, display: 'none'
    },

    timeDisplay: {
        color: 'rgba(255,255,255,0.7)', fontSize: '15px', fontWeight: '500',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px'
    },
    movieTitle: {
        position: 'absolute', top: '32px', left: '48px',
        fontSize: '32px', fontWeight: '700', color: 'rgba(255,255,255,0.95)',
        textShadow: '0 2px 20px rgba(0,0,0,0.6)',
        zIndex: 20, letterSpacing: '-0.5px'
    },

    volumeContainer: { display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' },

    // Modern Popover Menu
    menu: {
        position: 'absolute', bottom: '80px', right: '0',
        background: 'rgba(25, 25, 30, 0.85)',
        backdropFilter: 'blur(30px) saturate(180%)',
        borderRadius: '16px', padding: '8px',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', gap: '2px',
        minWidth: '180px', maxHeight: '350px', overflowY: 'auto',
        zIndex: 30, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        transformOrigin: 'bottom right'
    },
    menuItem: {
        padding: '12px 16px', color: 'rgba(255,255,255,0.8)',
        fontSize: '14px', textAlign: 'left',
        background: 'transparent', border: 'none',
        borderRadius: '10px', cursor: 'pointer',
        transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center'
    },
    activeItem: { background: 'rgba(255, 255, 255, 0.1)', color: 'white', fontWeight: '600' },

    // Center Ripple Animation
    centerAnimation: {
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 5, pointerEvents: 'none',
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
        borderRadius: '50%', padding: '30px',
        border: '1px solid rgba(255,255,255,0.1)'
    }
};

export const GlassPlayer = ({ streamUrl, subtitles = [], onClose, movieTitle }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const hlsRef = useRef(null);
    const controlsTimeout = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showSubMenu, setShowSubMenu] = useState(false);
    const [activeSubIndex, setActiveSubIndex] = useState(-1);
    const [hoverProgress, setHoverProgress] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [showCenterPlay, setShowCenterPlay] = useState(false); // For animation

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleInteraction = useCallback(() => {
        setShowControls(true);
        containerRef.current.style.cursor = 'auto';
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        if (videoRef.current && !videoRef.current.paused) {
            controlsTimeout.current = setTimeout(() => {
                if (containerRef.current) {
                    setShowControls(false);
                    setShowSubMenu(false);
                    containerRef.current.style.cursor = 'none';
                }
            }, HIDE_CONTROLS_DELAY);
        }
    }, []);

    const togglePlay = useCallback((e) => {
        if (e) e.stopPropagation();
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play().catch(console.error);
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                setIsPlaying(false);
            }
            setShowCenterPlay(true);
            setTimeout(() => setShowCenterPlay(false), 600);
            handleInteraction();
        }
    }, [handleInteraction]);

    const handleSeek = useCallback((e) => {
        if (!videoRef.current || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const percentage = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
        videoRef.current.currentTime = percentage * duration;
    }, [duration]);

    const switchSubtitle = (index) => {
        if (!videoRef.current) return;
        const tracks = videoRef.current.textTracks;
        for (let i = 0; i < tracks.length; i++) {
            tracks[i].mode = 'hidden';
        }
        if (index !== -1 && tracks[index]) {
            tracks[index].mode = 'showing';
            console.log(`[Subtitles] Altyazı açıldı: Index ${index}, Label: ${tracks[index].label}`);
        } else {
            console.log(`[Subtitles] Altyazı kapatıldı`);
        }
        setActiveSubIndex(index);
        setShowSubMenu(false);
    };

    const onTimeUpdate = () => {
        if (!videoRef.current) return;
        const vid = videoRef.current;
        setCurrentTime(vid.currentTime);
        setDuration(vid.duration || 0);
        setProgress((vid.currentTime / vid.duration) * 100 || 0);
        if (vid.buffered.length > 0) {
            for (let i = 0; i < vid.buffered.length; i++) {
                if (vid.buffered.start(i) <= vid.currentTime && vid.buffered.end(i) >= vid.currentTime) {
                    setBuffered((vid.buffered.end(i) / vid.duration) * 100);
                    break;
                }
            }
        }
    };

    const toggleFullscreen = useCallback(async (e) => {
        if (e) e.stopPropagation();
        if (!document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(console.error);
            setIsFullscreen(true);
        } else {
            await document.exitFullscreen();
            setIsFullscreen(false);
        }
        handleInteraction();
    }, [handleInteraction]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowRight':
                    if (videoRef.current) videoRef.current.currentTime += 10;
                    handleInteraction();
                    break;
                case 'ArrowLeft':
                    if (videoRef.current) videoRef.current.currentTime -= 10;
                    handleInteraction();
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
                case 'Escape':
                    onClose();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, toggleFullscreen, onClose, handleInteraction]);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            let url = streamUrl;
            if (!url) return;

            if (Hls.isSupported() && url.includes('.m3u8')) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(videoRef.current);
                hlsRef.current = hls;
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoRef.current.play().catch(() => { });
                    setIsPlaying(true);
                });
            } else {
                videoRef.current.src = url;
                videoRef.current.load();
                videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
                setIsPlaying(true);
            }
        };
        init();

        // Altyazı varsa otomatik etkinleştir (Türkçe öncelikli, yoksa İngilizce)
        if (subtitles.length > 0) {
            const trIndex = subtitles.findIndex(s => s.lang === 'tr' || s.lang === 'tur');
            const engIndex = subtitles.findIndex(s => s.lang === 'eng' || s.lang === 'en');

            let autoSubIndex = -1;
            if (trIndex !== -1) {
                autoSubIndex = trIndex;
                console.log('[Subtitles] 🇹🇷 Türkçe altyazı etkinleştirildi');
            } else if (engIndex !== -1) {
                autoSubIndex = engIndex;
                console.log('[Subtitles] 🇺🇸 İngilizce altyazı etkinleştirildi');
            } else {
                autoSubIndex = 0; // İlk bulunana geç
                console.log('[Subtitles] 📝 İlk mevcut altyazı etkinleştirildi');
            }

            setTimeout(() => switchSubtitle(autoSubIndex), 1000);
        } else {
            console.log('[Subtitles] ⚠️ Altyazı bulunamadı');
        }

        return () => {
            if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
            if (hlsRef.current) hlsRef.current.destroy();
            if (videoRef.current) {
                videoRef.current.src = "";
                videoRef.current.load(); // Forces connection close
            }
        };
    }, [streamUrl, subtitles]);

    return (
        <div ref={containerRef} style={styles.container} onMouseMove={handleInteraction} onClick={() => setShowSubMenu(false)}>
            <style>{`
                video::cue {
                    font-family: 'Netflix Sans', 'Inter', sans-serif;
                    /* Responsive Font Size: Minimum 16px, Preferred 2.5vw, Maximum 40px */
                    font-size: clamp(16px, 2.5vw, 40px);
                    color: #ffffff;
                    /* Netflix Style Shadow: Strong stroke effect for readability on any background */
                    text-shadow: #000000 0px 0px 7px;
                    background-color: transparent;
                    line-height: normal;
                }
                
                /* Mobile optimization */
                @media (max-width: 768px) {
                    video::cue { 
                        font-size: clamp(14px, 4.5vw, 24px); 
                        text-shadow: #000000 0px 0px 4px;
                    }
                }
                
                /* TV / Large Screen adjustments */
                @media (min-width: 1920px) {
                    video::cue { font-size: 3vw; }
                }

                .glass-btn:hover { background: rgba(255,255,255,0.15) !important; transform: scale(1.1); }
                .glass-btn:active { transform: scale(0.95); }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 14px; width: 14px; border-radius: 50%; background: #fff; margin-top: -5px; box-shadow: 0 0 10px rgba(255,255,255,0.5); cursor: pointer; transition: transform 0.1s; }
                input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.2); }
                input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; }
            `}</style>

            <div style={styles.videoWrapper} onClick={togglePlay} onDoubleClick={toggleFullscreen}>
                {isLoading && (
                    <div style={{ position: 'absolute', zIndex: 5 }}>
                        <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#E50914', borderRadius: '50%', width: '64px', height: '64px', animation: 'spin 0.8s linear infinite' }} />
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {/* Center Play/Pause Animation */}
                <AnimatePresence>
                    {showCenterPlay && (
                        <motion.div
                            style={styles.centerAnimation}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.5 }}
                            transition={{ duration: 0.3 }}
                        >
                            <i className={`fas ${isPlaying ? 'fa-play' : 'fa-pause'}`} style={{ color: 'white', fontSize: '40px' }} />
                        </motion.div>
                    )}
                </AnimatePresence>

                <video
                    ref={videoRef} style={styles.video}
                    onWaiting={() => setIsLoading(true)} onPlaying={() => { setIsLoading(false); setIsPlaying(true); }}
                    onTimeUpdate={onTimeUpdate} onEnded={onClose} muted={isMuted} crossOrigin="anonymous" playsInline autoPlay
                >
                    {subtitles.map((s, i) => (
                        <track
                            key={i}
                            kind="subtitles"
                            src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/subtitle-proxy?url=${encodeURIComponent(s.url)}`}
                            label={s.label}
                            srcLang={s.lang}
                        />
                    ))}
                </video>

                <AnimatePresence>
                    {showControls && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.topGradient}>
                        <h2 style={styles.movieTitle}>{movieTitle}</h2>
                    </motion.div>}
                </AnimatePresence>

                <AnimatePresence>
                    {showControls && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.gradientOverlay} />}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {showControls && (
                    <motion.div style={styles.controlsContainer} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
                        <div style={styles.controlsGlass} onClick={e => e.stopPropagation()}>

                            <div
                                style={{ ...styles.progressWrapper, height: hoverProgress ? '24px' : '16px' }}
                                onClick={handleSeek}
                                onMouseEnter={() => setHoverProgress(true)}
                                onMouseLeave={() => setHoverProgress(false)}
                            >
                                <div style={{ ...styles.progressRail, height: hoverProgress ? '6px' : '4px', background: hoverProgress ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)' }}>
                                    <div style={{ ...styles.bufferBar, width: `${buffered}%` }} />
                                    <div style={{ ...styles.progressBar, width: `${progress}%` }} />
                                </div>
                                <div style={{
                                    ...styles.scrubber,
                                    display: hoverProgress ? 'block' : 'none',
                                    left: `${progress}%`
                                }} />
                            </div>

                            <div style={styles.bottomBar}>
                                <div style={styles.leftControls}>
                                    <button className="glass-btn" style={styles.button} onClick={togglePlay}>
                                        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} style={{ fontSize: '26px' }} />
                                    </button>

                                    <div
                                        style={styles.volumeContainer}
                                        onMouseEnter={() => setShowVolumeSlider(true)}
                                        onMouseLeave={() => setShowVolumeSlider(false)}
                                    >
                                        <button className="glass-btn" style={{ ...styles.button, width: '40px' }} onClick={() => setIsMuted(!isMuted)}>
                                            <i className={`fas ${isMuted ? 'fa-volume-mute' : (volume > 0.5 ? 'fa-volume-up' : 'fa-volume-down')}`} style={{ fontSize: '24px' }} />
                                        </button>
                                        <motion.div
                                            initial={{ width: 0, opacity: 0 }}
                                            animate={{ width: showVolumeSlider ? 100 : 0, opacity: showVolumeSlider ? 1 : 0 }}
                                            style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}
                                        >
                                            <input
                                                type="range" min="0" max="1" step="0.05"
                                                value={isMuted ? 0 : volume}
                                                onChange={e => { setVolume(e.target.value); videoRef.current.volume = e.target.value; setIsMuted(e.target.value == 0) }}
                                                style={{ width: '90px', cursor: 'pointer' }}
                                            />
                                        </motion.div>
                                    </div>

                                    <div style={styles.timeDisplay}>{formatTime(currentTime)} <span style={{ opacity: 0.5, margin: '0 4px' }}>/</span> {formatTime(duration)}</div>
                                </div>

                                <div style={styles.rightControls}>
                                    <div style={{ position: 'relative' }}>
                                        <button className="glass-btn" style={{ ...styles.button, color: activeSubIndex !== -1 ? '#E50914' : '#fff' }} onClick={() => setShowSubMenu(!showSubMenu)}>
                                            <i className="fas fa-closed-captioning" style={{ fontSize: '26px' }} />
                                        </button>
                                        <AnimatePresence>
                                            {showSubMenu && (
                                                <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }} style={styles.menu}>
                                                    <button style={{ ...styles.menuItem, ...(activeSubIndex === -1 ? styles.activeItem : {}) }} onClick={() => switchSubtitle(-1)}>
                                                        <span>Kapalı</span>
                                                        {activeSubIndex === -1 && <i className="fas fa-check" style={{ color: '#E50914' }} />}
                                                    </button>
                                                    {subtitles.map((s, i) => (
                                                        <button key={i} style={{ ...styles.menuItem, ...(activeSubIndex === i ? styles.activeItem : {}) }} onClick={() => switchSubtitle(i)}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <img src={`https://flagsapi.com/${s.lang === 'tur' ? 'TR' : (s.lang === 'eng' ? 'US' : 'UN')}/flat/16.png`} alt="" onError={(e) => e.target.style.display = 'none'} />
                                                                {s.lang.toUpperCase()}
                                                            </span>
                                                            {activeSubIndex === i && <i className="fas fa-check" style={{ color: '#E50914' }} />}
                                                        </button>
                                                    ))}
                                                    {subtitles.length === 0 && <span style={{ padding: '12px', fontSize: '13px', color: '#888', textAlign: 'center' }}>Altyazı Bulunamadı</span>}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <button className="glass-btn" style={styles.button} onClick={toggleFullscreen}>
                                        <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} style={{ fontSize: '24px' }} />
                                    </button>
                                    <button className="glass-btn" style={{ ...styles.button, color: '#ff4b4b', marginLeft: '8px' }} onClick={onClose}>
                                        <i className="fas fa-times" style={{ fontSize: '28px' }} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
