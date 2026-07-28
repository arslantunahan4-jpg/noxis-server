import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAnnualWrappedData, enrichWrappedWithCredits } from '../utils/analytics';
import { imageUrl, mediaTitle } from '../tv/utils/media';
import { getStoredAvatar } from '../config/avatars';
import { shareNativeWrappedPoster, downloadWrappedPoster, shareWrappedToWhatsApp } from '../utils/wrappedPoster';
import { WrappedPosterDOM } from './WrappedPosterDOM';
import '../tv/tv.css';

const SLIDE_TAGLINES = [
    ['🍿 Popcornlar hazırsa başlayalım', '🎬 Main Character Energy aktifleşiyor...', '✨ 2026 sinema aura\'n ortaya çıkıyor'],
    ['⏱️ Ekran süren şaka mı?', '🔥 Ekranla bütünleştiğin o anlar...', '📺 Rekor kırıldı, arkana yaslan'],
    ['🤯 Maraton ustası', '⚡ Uyumak yerine devam dedin', '📺 Binge rekorun inanılmaz'],
    ['🎭 DNA\'nda hangi tür var?', '🌟 Algoritma zevkini deşifre etti', '🎯 Tarzın tek kelimeyle ikonik'],
    ['🏆 Zirvedeki Top 5 favorin', '⭐ Letterboxd listenin en tepesi', '🎞️ Tekrar tekrar döndürdüğün o 5\'li'],
    ['👑 2026 Sinema Unvanın', '🎖️ Aura seviyen tavan yaptı', '🌟 Final Boss modu açıldı']
];

const getRandomTagline = (slideIdx) => {
    const options = SLIDE_TAGLINES[slideIdx] || SLIDE_TAGLINES[0];
    return options[Math.floor(Math.random() * options.length)];
};

const createAmbientMusic = (genreName = '') => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0;
        gainNode.connect(ctx.destination);

        const oscillators = [];
        
        let notes = [130.81, 164.81, 196.0, 261.63]; // Default Major C
        let waveType = 'sine';
        
        if (genreName === 'Korku' || genreName === 'Gerilim') {
            notes = [110.0, 116.54, 130.81, 146.83]; // Dissonant low frequencies
            waveType = 'triangle';
        } else if (genreName === 'Aksiyon' || genreName === 'Macera') {
            notes = [196.0, 261.63, 293.66, 392.0]; // Fast pace high freq
            waveType = 'sawtooth';
        } else if (genreName === 'Komedi') {
            notes = [261.63, 329.63, 392.0, 523.25]; // Upbeat C Major
            waveType = 'square';
        }

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = waveType;
            osc.frequency.value = freq;
            const oscGain = ctx.createGain();
            // Lower volume for harsh waveforms
            const volMod = waveType === 'sine' ? 1 : 0.4;
            oscGain.gain.value = (0.04 - i * 0.008) * volMod;
            osc.connect(oscGain);
            oscGain.connect(gainNode);
            osc.start();
            oscillators.push(osc);
        });

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.3;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.008;
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        lfo.start();

        return {
            fadeIn: () => {
                if (ctx.state === 'suspended') ctx.resume();
                gainNode.gain.cancelScheduledValues(ctx.currentTime);
                gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.5);
            },
            fadeOut: () => {
                gainNode.gain.cancelScheduledValues(ctx.currentTime);
                gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
                setTimeout(() => {
                    oscillators.forEach(o => { try { o.stop(); } catch (e) {} });
                    try { lfo.stop(); } catch (e) {}
                    try { ctx.close(); } catch (e) {}
                }, 1200);
            },
            setVolume: (v) => {
                gainNode.gain.cancelScheduledValues(ctx.currentTime);
                gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.3);
            }
        };
    } catch {
        return { fadeIn: () => {}, fadeOut: () => {}, setVolume: () => {} };
    }
};

export const NoxisWrappedModal = ({ isOpen, onClose, year, username = 'Kullanıcı', avatar: propAvatar }) => {
    const [stats, setStats] = useState(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [taglines, setTaglines] = useState([]);
    const [isSharing, setIsSharing] = useState(false);
    const musicRef = useRef(null);

    const HAS_FACES_SLIDE = stats?.topActor || stats?.topDirector;
    const TOTAL_SLIDES = HAS_FACES_SLIDE ? 7 : 6;
    const PERSONA_SLIDE_INDEX = HAS_FACES_SLIDE ? 6 : 5;
    const SLIDE_DURATION = 7000;

    const avatar = propAvatar || getStoredAvatar();

    useEffect(() => {
        if (isOpen) {
            const data = getAnnualWrappedData(year || new Date().getFullYear());
            setStats(data);
            
            enrichWrappedWithCredits(data).then(enriched => {
                if (enriched) setStats(enriched);
            });

            setCurrentSlide(0);
            setIsPaused(false);
            setIsMuted(false);
            setTaglines(Array.from({ length: TOTAL_SLIDES }, (_, i) => getRandomTagline(i)));

            const music = createAmbientMusic(data.topGenreName);
            musicRef.current = music;
            music.fadeIn();
        }
        return () => {
            if (musicRef.current) {
                musicRef.current.fadeOut();
                musicRef.current = null;
            }
        };
    }, [isOpen, year]);

    useEffect(() => {
        if (!isOpen || isPaused || !stats?.hasEnoughData || currentSlide >= TOTAL_SLIDES - 1) return;
        const timer = setInterval(() => {
            setCurrentSlide(prev => Math.min(TOTAL_SLIDES - 1, prev + 1));
        }, SLIDE_DURATION);
        return () => clearInterval(timer);
    }, [isOpen, isPaused, stats, currentSlide]);

    const handleNext = useCallback(() => {
        if (currentSlide < TOTAL_SLIDES - 1) setCurrentSlide(prev => prev + 1);
        else onClose();
    }, [currentSlide, onClose]);

    const handlePrev = useCallback(() => {
        if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
    }, [currentSlide]);

    const toggleMute = useCallback(() => {
        setIsMuted(prev => {
            const next = !prev;
            if (musicRef.current) musicRef.current.setVolume(next ? 0 : 0.12);
            return next;
        });
    }, []);

    const handleClose = useCallback(() => {
        if (musicRef.current) {
            musicRef.current.fadeOut();
            musicRef.current = null;
        }
        onClose();
    }, [onClose]);

    // Triggers native device share sheet (Instagram Story / WhatsApp / App Picker)
    const handleNativeShare = async () => {
        if (!stats) return;
        setIsSharing(true);
        try {
            await shareNativeWrappedPoster(stats, avatar.url, username);
        } catch (e) {
            console.error('Native share failed', e);
        } finally {
            setIsSharing(false);
        }
    };

    const handleWhatsAppShare = () => {
        if (!stats) return;
        shareWrappedToWhatsApp(stats);
    };

    if (!isOpen || !stats) return null;

    const heroPosterUrl = stats.top3Items?.[0]
        ? imageUrl(stats.top3Items[0].backdrop_path || stats.top3Items[0].poster_path, 'w780')
        : null;

    const slideVariants = {
        enter: { opacity: 0, y: 40, scale: 0.96 },
        center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
        exit: { opacity: 0, y: -30, scale: 0.96, transition: { duration: 0.25 } }
    };

    // --- DYNAMIC TEXT GENERATION ---
    const getHoursText = (m) => {
        if (m < 10) return { title: `Sadece ${m} dakikacık...`, desc: "Uygulamaya şöyle bir bakıp çıkmışsın galiba. Gelecek yıl daha fazla görüşelim!" };
        if (m < 60) return { title: `Tam ${m} dakika.`, desc: "Sadece kısa bir içerik izlemişsin. Hayat çok meşgul olmalı." };
        if (m < 300) return { title: `Tam ${m} dakika (${(m/60).toFixed(1)} saat).`, desc: "Film ve diziler senin için çerezlik. Seçici davranıyor, sadece en iyilerini izliyorsun." };
        if (m < 1200) return { title: `Tam ${m.toLocaleString()} dakika (${Math.round(m/60)} saat)!`, desc: "Düzenli bir izleyicisin. Ne çok asosyal, ne de çok kopuk. Tam kıvamında!" };
        if (m < 3000) return { title: `Tam ${m.toLocaleString()} dakika (${Math.round(m/60)} saat)!`, desc: "Bu sürede spora başlasaydın şu an karın kasların vardı. Ama sen sinema sanatına adandın." };
        if (m < 6000) return { title: `Koca bir ${m.toLocaleString()} dakika (${Math.round(m/60)} saat)!`, desc: "Sıfırdan yeni bir dil öğrenebilirdin. Neyse ki filmlerde yeterince alt yazı okudun." };
        if (m < 15000) return { title: `Tam ${m.toLocaleString()} dakika (${Math.round(m/60)} saat)!!`, desc: "Dünyayı yürüyerek gezmeye başlayabilirdin. Ancak sen başka evrenleri keşfetmeyi seçtin. Saygı duyuyoruz 🫡" };
        return { title: `İnanılmaz... ${m.toLocaleString()} dakika (${Math.round(m/60)} saat)!!!`, desc: "Neredeyse bu uygulamada yaşıyorsun. Gerçek bir sinema/dizi gurmesi! Efsaneler arasında yerin hazır 👑" };
    };

    const getBingeText = (b) => {
        if (!b || b <= 1) return "Bu yıl pek maraton havasında değildin. Sindire sindire, yavaş yavaş izledin.";
        if (b === 2) return "Aynı gün 2 bölüm... Peş peşe izlemeye anca bu kadar dayanabildin. Sağlıklı bir sınır!";
        if (b === 3 || b === 4) return "Uykudan biraz feragat ettin, ama belli ki buna değdi.";
        if (b === 5 || b === 6) return "Bayağı kaptırdın! Saatlerin nasıl geçtiğini sen bile anlamadın.";
        if (b >= 7 && b <= 9) return "Dünyanın sonu gelse senin umurunda değildi. Gözlerini ekrandan ayıramadın!";
        if (b >= 10 && b <= 14) return "Güneşin doğuşunu ve batışını ekran karşısında izledin. İnsanüstü bir performans.";
        return "Fizyolojik sınırları aştın. Tuvalet ve yemek molası dışında hayattan tamamen koptun. Gerçek bir Maraton Tanrısı!";
    };

    const timeCopy = stats ? getHoursText(stats.totalMinutes) : { title: '', desc: '' };
    const bingeCopy = stats ? getBingeText(stats.maxBinge?.count || 0) : '';

    return (
        <AnimatePresence>
            <div className="noxis-wrapped-overlay" onClick={handleClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="noxis-wrapped-container"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Animated Mesh BG */}
                    <div className={`noxis-wrapped-mesh-bg slide-bg-${currentSlide}`} />
                    {heroPosterUrl && (
                        <div
                            className="noxis-wrapped-hero-blur-backdrop"
                            style={{ backgroundImage: `url(${heroPosterUrl})` }}
                        />
                    )}

                    {/* Hidden Export Node for Story Poster (html-to-image) */}
                    <div style={{
                        position: 'absolute',
                        left: '-9999px',
                        top: 0,
                        zIndex: -1,
                        overflow: 'hidden'
                    }}>
                        <WrappedPosterDOM stats={stats} username={username} avatarUrl={avatar.url} />
                    </div>

                    {!stats.hasEnoughData ? (
                        <div className="noxis-wrapped-empty-state">
                            <button type="button" className="noxis-wrapped-close-top" onClick={handleClose}>
                                <i className="fas fa-times" />
                            </button>
                            <div className="noxis-wrapped-empty-icon">
                                <i className="fas fa-chart-pie" />
                            </div>
                            <h2>Henüz Yeterli İzleme Verisi Yok</h2>
                            <p>
                                Noxis Wrapped tamamen <strong>gerçek izleme geçmişinize</strong> göre hesaplanır.
                                Film veya dizi izledikçe Spotify tarzı kartlarınız burada otomatik olarak dolacaktır.
                            </p>
                            <button type="button" className="noxis-wrapped-action-btn" onClick={handleClose}>
                                İzlemeye Başla
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Instagram Stories Top Progress Bars */}
                            <div className="noxis-wrapped-progress-bar-group">
                                {Array.from({ length: TOTAL_SLIDES }).map((_, index) => {
                                    let fillWidth = '0%';
                                    let transitionStyle = 'none';
                                    if (index < currentSlide) {
                                        fillWidth = '100%';
                                    } else if (index === currentSlide) {
                                        fillWidth = '100%';
                                        transitionStyle = isPaused ? 'none' : `width ${SLIDE_DURATION / 1000}s linear`;
                                    }
                                    return (
                                        <div key={index} className="noxis-wrapped-progress-track" onClick={() => setCurrentSlide(index)}>
                                            <div
                                                className="noxis-wrapped-progress-fill"
                                                style={{ width: fillWidth, transition: transitionStyle }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Top Bar: Brand + Controls */}
                            <div className="noxis-wrapped-top-bar">
                                <span className="noxis-wrapped-brand">
                                    <i className="fas fa-compact-disc fa-spin-slow" /> NOXIS REWIND {stats.year || 2026}
                                </span>
                                <div className="noxis-wrapped-controls">
                                    <button type="button" className="noxis-wrapped-icon-btn" onClick={toggleMute} title={isMuted ? 'Sesi Aç' : 'Sessiz'}>
                                        <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}`} />
                                    </button>
                                    <button type="button" className="noxis-wrapped-icon-btn" onClick={() => setIsPaused(!isPaused)} title={isPaused ? 'Devam Et' : 'Duraklat'}>
                                        <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`} />
                                    </button>
                                    <button type="button" className="noxis-wrapped-icon-btn" onClick={handleClose}>
                                        <i className="fas fa-times" />
                                    </button>
                                </div>
                            </div>

                            {/* Tap Navigation */}
                            <div className="noxis-wrapped-tap-left" onClick={handlePrev} />
                            <div className="noxis-wrapped-tap-right" onClick={handleNext} />

                            {/* Slide Content */}
                            <div className="noxis-wrapped-slide-viewport">
                                <AnimatePresence mode="wait">

                                    {/* ═══════ SLIDE 0: INTRO ═══════ */}
                                    {currentSlide === 0 && (
                                        <motion.div key="s0" variants={slideVariants} initial="enter" animate="center" exit="exit" className="noxis-wrapped-slide noxis-wrapped-slide-intro">
                                            <motion.div
                                                className="noxis-wrapped-avatar-ring"
                                                initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                            >
                                                <img src={avatar.url} alt={avatar.name} referrerPolicy="no-referrer" />
                                            </motion.div>

                                            <motion.span className="noxis-wrapped-hero-badge"
                                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                                            >
                                                NOXIS REWIND {stats.year || 2026}
                                            </motion.span>

                                            <motion.h1 className="noxis-wrapped-kinetic-hero"
                                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                                            >
                                                Sinema Yılın<br />Nasıl Geçti?
                                            </motion.h1>

                                            <motion.p className="noxis-wrapped-hero-desc"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                                            >
                                                {taglines[0]}
                                            </motion.p>

                                            <motion.div className="noxis-wrapped-intro-stats-preview"
                                                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}
                                            >
                                                <div className="noxis-wrapped-preview-stat">
                                                    <strong>{stats.totalHours}</strong>
                                                    <span>Saat İzleme</span>
                                                </div>
                                                <div className="noxis-wrapped-preview-stat">
                                                    <strong>{stats.movieCount + stats.episodeCount}</strong>
                                                    <span>Toplam İçerik</span>
                                                </div>
                                            </motion.div>

                                            <motion.button type="button" className="noxis-wrapped-action-btn"
                                                onClick={handleNext}
                                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 1.0 }}
                                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
                                            >
                                                Keşfetmeye Başla <i className="fas fa-arrow-right" />
                                            </motion.button>
                                        </motion.div>
                                    )}

                                    {/* ═══════ SLIDE 1: HOURS & TIME ═══════ */}
                                    {currentSlide === 1 && (
                                        <motion.div key="s1" variants={slideVariants} initial="enter" animate="center" exit="exit" className="noxis-wrapped-slide noxis-wrapped-slide-hours">
                                            <motion.span className="noxis-wrapped-kicker-neon"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                                            >
                                                EKRAN BAŞINDAKİ ZAMANIN
                                            </motion.span>

                                            <motion.div className="noxis-wrapped-big-number-wrapper"
                                                initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                transition={{ delay: 0.3, type: 'spring', stiffness: 150, damping: 12 }}
                                            >
                                                <div className="noxis-wrapped-kinetic-num">
                                                    {stats.timeBreakdown.title}
                                                </div>
                                            </motion.div>

                                            <motion.p className="noxis-wrapped-hero-desc" style={{ marginTop: '12px' }}
                                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                                            >
                                                <strong>{timeCopy.title}</strong>
                                                <br/>
                                                {timeCopy.desc}
                                            </motion.p>

                                            <motion.div className="noxis-wrapped-stat-duo"
                                                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                                            >
                                                <div className="noxis-wrapped-duo-card">
                                                    <i className="fas fa-film" />
                                                    <strong>{stats.movieCount}</strong>
                                                    <span>İzlenen Film</span>
                                                </div>
                                                <div className="noxis-wrapped-duo-card">
                                                    <i className="fas fa-tv" />
                                                    <strong>{stats.episodeCount}</strong>
                                                    <span>Dizi Bölümü</span>
                                                </div>
                                            </motion.div>
                                        </motion.div>
                                    )}

                                    {/* ═══════ SLIDE 2: BINGE STREAK ═══════ */}
                                    {currentSlide === 2 && (
                                        <motion.div key="s2" variants={slideVariants} initial="enter" animate="center" exit="exit" className="noxis-wrapped-slide noxis-wrapped-slide-binge">
                                            <motion.span className="noxis-wrapped-kicker-neon"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                                            >
                                                MARATON USTASI
                                            </motion.span>

                                            <motion.div className="noxis-wrapped-big-number-wrapper"
                                                initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                transition={{ delay: 0.3, type: 'spring', stiffness: 150, damping: 12 }}
                                            >
                                                <div className="noxis-wrapped-kinetic-num">
                                                    {stats.maxBinge?.count || 0}
                                                </div>
                                            </motion.div>

                                            <motion.p className="noxis-wrapped-hero-desc" style={{ marginTop: '12px', fontSize: '18px' }}
                                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                                            >
                                                {stats.maxBinge?.date && (
                                                    <>
                                                        {new Date(stats.maxBinge.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} gününde, üst üste tam {stats.maxBinge.count} bölüm izledin.
                                                        <br/><br/>
                                                    </>
                                                )}
                                                {bingeCopy}
                                            </motion.p>
                                            
                                            {stats.maxBinge?.title && (
                                                <motion.div className="noxis-wrapped-stat-duo"
                                                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                                                >
                                                    <div className="noxis-wrapped-duo-card" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <i className="fas fa-tv" style={{ color: '#ff3b47' }} />
                                                        <strong style={{ fontSize: '32px', color: '#fff', textTransform: 'uppercase' }}>{stats.maxBinge.title}</strong>
                                                        <span style={{ opacity: 0.6 }}>O Muhteşem Maratonun Başrolü</span>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* ═══════ SLIDE 3: TOP GENRE ═══════ */}
                                    {currentSlide === 3 && (
                                        <motion.div key="s2" variants={slideVariants} initial="enter" animate="center" exit="exit" className="noxis-wrapped-slide noxis-wrapped-slide-genres">
                                            <motion.span className="noxis-wrapped-kicker-neon"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                                            >
                                                RUH EŞİN OLAN TÜR
                                            </motion.span>

                                            <motion.h2 className="noxis-wrapped-genre-title"
                                                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                                            >
                                                {stats.topGenreName}
                                            </motion.h2>

                                            <motion.p className="noxis-wrapped-subtitle"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                                            >
                                                {taglines[2]}
                                            </motion.p>

                                            <motion.div className="noxis-wrapped-genre-spectrum"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                                            >
                                                {stats.topGenres.map((g, idx) => (
                                                    <div key={g.name} className="noxis-wrapped-spectrum-row">
                                                        <div className="noxis-wrapped-spectrum-info">
                                                            <span>#{idx + 1} {g.name}</span>
                                                            <small>{g.count} İçerik</small>
                                                        </div>
                                                        <div className="noxis-wrapped-spectrum-track">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${Math.min(100, (g.count / (stats.topGenres[0]?.count || 1)) * 100)}%` }}
                                                                transition={{ duration: 0.8, delay: 0.7 + idx * 0.15, ease: 'easeOut' }}
                                                                className={`noxis-wrapped-spectrum-fill fill-rank-${idx + 1}`}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        </motion.div>
                                    )}

                                    {/* ═══════ SLIDE 4: TOP 5 CONTENT ═══════ */}
                                    {currentSlide === 4 && (
                                        <motion.div key="s3" variants={slideVariants} initial="enter" animate="center" exit="exit" className="noxis-wrapped-slide noxis-wrapped-slide-top5">
                                            <motion.span className="noxis-wrapped-hero-badge"
                                                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                                            >
                                                NOXIS REWIND {stats.year || 2026}
                                            </motion.span>

                                            <motion.h2 className="noxis-wrapped-hero-sm"
                                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                                            >
                                                En Çok İzlediğin 5 İçerik
                                            </motion.h2>

                                            {(stats.top5Items || stats.top3Items).length > 0 ? (
                                                <div className="noxis-wrapped-top5-list">
                                                    {(stats.top5Items || stats.top3Items).map((item, idx) => {
                                                        const rank = idx + 1;
                                                        const poster = imageUrl(item.poster_path || item.backdrop_path, 'w500');
                                                        const name = mediaTitle(item);
                                                        const hours = Math.round((item.totalWatchSeconds || 0) / 3600 * 10) / 10;
                                                        const isChampion = rank === 1;

                                                        return (
                                                            <motion.div
                                                                key={idx}
                                                                className={`noxis-wrapped-top5-row ${isChampion ? 'champion-row' : ''}`}
                                                                initial={{ opacity: 0, x: -20 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.35 + idx * 0.08, type: 'spring', stiffness: 200 }}
                                                                whileHover={{ scale: 1.05, rotateY: 10, rotateX: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
                                                                style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
                                                            >
                                                                <span className={`noxis-wrapped-rank-badge rank-badge-${rank}`}>
                                                                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                                                                </span>
                                                                <div className="noxis-wrapped-top5-poster">
                                                                    {poster ? <img src={poster} alt={name} /> : <i className="fas fa-film" />}
                                                                </div>
                                                                <div className="noxis-wrapped-top5-info">
                                                                    <strong>{name}</strong>
                                                                    {hours > 0 && <small><i className="fas fa-clock" /> {hours} Saat</small>}
                                                                </div>
                                                                {isChampion && <span className="noxis-wrapped-champion-pill">ZİRVE</span>}
                                                            </motion.div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="noxis-wrapped-empty-top3">
                                                    <p>Tamamlanan izlemeleriniz burada sıralanacaktır.</p>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* ═══════ NEW SLIDE: TOP ACTOR / DIRECTOR ═══════ */}
                                    {HAS_FACES_SLIDE && currentSlide === 5 && (
                                        <motion.div key="faces" variants={slideVariants} initial="enter" animate="center" exit="exit" className="noxis-wrapped-slide noxis-wrapped-slide-faces">
                                            <motion.span className="noxis-wrapped-kicker-neon"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                                            >
                                                YILIN FAVORİ YÜZLERİ
                                            </motion.span>
                                            
                                            <div className="noxis-wrapped-faces-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '32px' }}>
                                                {stats.topActor && (
                                                    <motion.div className="noxis-wrapped-face-card"
                                                        initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    >
                                                        {stats.topActor.profile_path ? (
                                                            <img src={`https://image.tmdb.org/t/p/w200${stats.topActor.profile_path}`} alt={stats.topActor.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                                                        ) : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fas fa-user" /></div>}
                                                        <div>
                                                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Favori Oyuncun</div>
                                                            <div style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0' }}>{stats.topActor.name}</div>
                                                            <div style={{ color: '#ff3b47', fontSize: '14px', fontWeight: '600' }}><i className="fas fa-clock" /> {stats.topActor.score} Saat Birlikteydiniz</div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                                
                                                {stats.topDirector && (
                                                    <motion.div className="noxis-wrapped-face-card"
                                                        initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    >
                                                        {stats.topDirector.profile_path ? (
                                                            <img src={`https://image.tmdb.org/t/p/w200${stats.topDirector.profile_path}`} alt={stats.topDirector.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                                                        ) : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fas fa-video" /></div>}
                                                        <div>
                                                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Favori Yönetmen / Yaratıcı</div>
                                                            <div style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0' }}>{stats.topDirector.name}</div>
                                                            <div style={{ color: '#ff3b47', fontSize: '14px', fontWeight: '600' }}><i className="fas fa-clock" /> {stats.topDirector.score} Saat Birlikteydiniz</div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* ═══════ SLIDE: PERSONA & POSTER NATIVE SHARE ═══════ */}
                                    {currentSlide === PERSONA_SLIDE_INDEX && (
                                        <motion.div key="s4" variants={slideVariants} initial="enter" animate="center" exit="exit" className="noxis-wrapped-slide noxis-wrapped-slide-persona" style={{ overflow: 'hidden' }}>
                                            
                                            {/* Poster Wall Background */}
                                            <div className="noxis-wrapped-poster-wall">
                                                {Array.from({ length: 3 }).map((_, i) => (
                                                    <div key={i} className="noxis-wrapped-poster-wall-track" style={{ animationDuration: `${20 + i * 5}s`, animationDirection: i % 2 === 0 ? 'normal' : 'reverse' }}>
                                                        {stats.top5Items.concat(stats.top5Items).map((item, idx) => {
                                                            const posterUrl = imageUrl(item.poster_path || item.backdrop_path, 'w300');
                                                            return posterUrl ? <img key={idx} src={posterUrl} alt="" className="noxis-wrapped-wall-poster" /> : null;
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="noxis-wrapped-poster-wall-overlay" />

                                            <motion.span className="noxis-wrapped-kicker-neon" style={{ position: 'relative', zIndex: 10 }}
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                                            >
                                                {stats.year || 2026} SİNEMA UNVANIN
                                            </motion.span>

                                            <motion.div className="noxis-wrapped-persona-badge" style={{ position: 'relative', zIndex: 10 }}
                                                initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                                                transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 14 }}
                                            >
                                                <i className="fas fa-crown" />
                                            </motion.div>

                                            <motion.h2 className="noxis-wrapped-persona-title" style={{ position: 'relative', zIndex: 10 }}
                                                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.55, type: 'spring', stiffness: 180 }}
                                            >
                                                {stats.persona.title}
                                            </motion.h2>

                                            <motion.p className="noxis-wrapped-persona-desc" style={{ position: 'relative', zIndex: 10 }}
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}
                                            >
                                                {stats.persona.desc}
                                            </motion.p>

                                            {/* Glassmorphic 4-Card Summary Grid */}
                                            <motion.div className="noxis-wrapped-summary-grid" style={{ position: 'relative', zIndex: 10 }}
                                                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
                                            >
                                                <div className="noxis-wrapped-summary-card">
                                                    <i className="fas fa-clock" />
                                                    <div className="noxis-wrapped-summary-card-data">
                                                        <strong>{stats.totalHours}</strong>
                                                        <span>Saat İzleme</span>
                                                    </div>
                                                </div>
                                                <div className="noxis-wrapped-summary-card">
                                                    <i className="fas fa-film" />
                                                    <div className="noxis-wrapped-summary-card-data">
                                                        <strong>{stats.movieCount}</strong>
                                                        <span>Film</span>
                                                    </div>
                                                </div>
                                                <div className="noxis-wrapped-summary-card">
                                                    <i className="fas fa-tv" />
                                                    <div className="noxis-wrapped-summary-card-data">
                                                        <strong>{stats.episodeCount}</strong>
                                                        <span>Dizi Bölümü</span>
                                                    </div>
                                                </div>
                                                <div className="noxis-wrapped-summary-card">
                                                    <i className="fas fa-mask" />
                                                    <div className="noxis-wrapped-summary-card-data">
                                                        <strong className="accent-genre">{stats.topGenreName}</strong>
                                                        <span>Favori Tür</span>
                                                    </div>
                                                </div>
                                            </motion.div>

                                            {/* Single Native Share Button */}
                                            <motion.div className="noxis-wrapped-actions-row" style={{ position: 'relative', zIndex: 10 }}
                                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}
                                            >
                                                <button
                                                    type="button"
                                                    className="noxis-wrapped-btn-single-share"
                                                    onClick={() => shareNativeWrappedPoster(stats, avatar.url, username)}
                                                >
                                                    <i className="fas fa-share-nodes" /> Instagram / Hikayede Paylaş
                                                </button>
                                                
                                                <button
                                                    type="button"
                                                    className="noxis-wrapped-btn-single-share"
                                                    onClick={() => downloadWrappedPoster(stats, avatar.url, username)}
                                                    style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
                                                >
                                                    <i className="fas fa-download" /> Galeriye Kaydet
                                                </button>
                                            </motion.div>
                                        </motion.div>
                                    )}

                                </AnimatePresence>
                            </div>

                            {/* Slide Counter & Branding Footer */}
                            <div className="noxis-wrapped-footer-glass">
                                <span>{currentSlide + 1} / {TOTAL_SLIDES}</span>
                                <span className="noxis-wrapped-footer-brand">NOXIS REWIND {stats.year || 2026}</span>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
