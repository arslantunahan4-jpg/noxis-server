import React from 'react';
import { imageUrl } from '../tv/utils/media';

const getGenreStyle = (genreName) => {
    const genre = (genreName || '').toLowerCase();
    // Modern, derin ve premium gradient paletleri (Apple stili mesh gradyanlar)
    if (genre.includes('aksiyon')) return { bg: '#090000', text: '#ffffff', glow: '#ff2a2a', accent: '#ff4d4d' };
    if (genre.includes('korku') || genre.includes('gerilim')) return { bg: '#030303', text: '#ffffff', glow: '#1d4ed8', accent: '#3b82f6' };
    if (genre.includes('komedi') || genre.includes('aile')) return { bg: '#0f0a00', text: '#ffffff', glow: '#ca8a04', accent: '#fef08a' };
    if (genre.includes('bilim kurgu')) return { bg: '#05021a', text: '#ffffff', glow: '#4f46e5', accent: '#818cf8' };
    if (genre.includes('dram')) return { bg: '#0a0314', text: '#ffffff', glow: '#9333ea', accent: '#c084fc' };
    return { bg: '#050505', text: '#ffffff', glow: '#dc2626', accent: '#ef4444' };
};

export const WrappedPosterDOM = ({ stats, username, avatarUrl }) => {
    const colors = getGenreStyle(stats.topGenreName);
    const top3 = (stats.top5Items || []).slice(0, 3);

    return (
        <div 
            id="noxis-wrapped-export-node"
            style={{
                width: '1080px',
                height: '1920px',
                backgroundColor: colors.bg,
                position: 'relative',
                overflow: 'hidden',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
        >
            {/* Cinematic Ambient Glow (Neon Mesh) */}
            <div style={{
                position: 'absolute', top: '-20%', left: '-20%', width: '140%', height: '140%',
                background: `radial-gradient(circle at 30% 20%, ${colors.glow}44 0%, transparent 40%),
                             radial-gradient(circle at 80% 80%, ${colors.glow}33 0%, transparent 50%)`,
                filter: 'blur(80px)',
                zIndex: 0
            }} />

            {/* Premium Header / Bento Header */}
            <div style={{ position: 'absolute', top: '70px', left: '70px', width: '940px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '24px', fontWeight: 600, color: '#fff', opacity: 0.5, letterSpacing: '0.2em' }}>
                        YILLIK ÖZET
                    </span>
                    <span style={{ fontSize: '48px', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginTop: '-5px' }}>
                        NOXIS <span style={{ color: colors.accent }}>REWIND</span>
                    </span>
                </div>
                
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    padding: '16px 32px',
                    borderRadius: '100px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#fff'
                }}>
                    {stats.year || 2026}
                </div>
            </div>

            {/* BENTO BOX 1: Hero Poster Showcase */}
            <div style={{
                position: 'absolute', top: '220px', left: '70px', width: '940px', height: '850px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '50px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                overflow: 'hidden',
                zIndex: 5,
                boxShadow: '0 30px 60px rgba(0,0,0,0.5)'
            }}>
                {top3.length > 0 && (
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        {top3.map((item, i) => {
                            const pUrl = imageUrl(item.poster_path || item.backdrop_path, 'w780');
                            const isCenter = i === 0;
                            const isLeft = i === 1;
                            
                            const x = isCenter ? 250 : isLeft ? -20 : 520;
                            const y = isCenter ? 70 : isLeft ? 120 : 120;
                            const rot = isCenter ? 0 : isLeft ? -8 : 8;
                            const scale = isCenter ? 1.1 : 0.9;
                            const z = isCenter ? 10 : 5;

                            return (
                                <img 
                                    key={i}
                                    src={pUrl}
                                    style={{
                                        position: 'absolute',
                                        left: `${x}px`,
                                        top: `${y}px`,
                                        width: '440px',
                                        height: '660px',
                                        borderRadius: '24px',
                                        boxShadow: isCenter ? '0 40px 80px rgba(0,0,0,0.8)' : '0 20px 40px rgba(0,0,0,0.5)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        transform: `rotate(${rot}deg) scale(${scale})`,
                                        zIndex: z,
                                        objectFit: 'cover'
                                    }}
                                />
                            );
                        })}
                        {/* Inner Shadow / Vignette for Hero Box */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%)',
                            zIndex: 15,
                            pointerEvents: 'none'
                        }} />
                        <div style={{
                            position: 'absolute', bottom: '40px', left: '0', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 20
                        }}>
                            <span style={{ fontSize: '24px', fontWeight: 700, color: '#fff', opacity: 0.8, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                                Yılın Favorileri
                            </span>
                            {(stats.topActor || stats.topDirector) && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: '8px 24px 8px 12px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                                    {(stats.topActor?.profile_path || stats.topDirector?.profile_path) ? (
                                        <img src={`https://image.tmdb.org/t/p/w200${stats.topActor?.profile_path || stats.topDirector?.profile_path}`} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: colors.glow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={`fas ${stats.topActor ? 'fa-user' : 'fa-video'}`} style={{ color: '#fff' }} /></div>}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em' }}>FAVORİ {stats.topActor ? 'OYUNCU' : 'YÖNETMEN'}</span>
                                        <span style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginTop: '-2px' }}>{stats.topActor?.name || stats.topDirector?.name}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* BENTO ROW: Hours & Genre */}
            <div style={{ position: 'absolute', top: '1100px', left: '70px', width: '940px', display: 'flex', gap: '30px', zIndex: 10 }}>
                
                {/* BENTO BOX 2: Total Hours */}
                <div style={{
                    flex: '1.2', height: '360px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    borderRadius: '40px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '40px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <span style={{ fontSize: '24px', fontWeight: 600, color: colors.text, opacity: 0.5, letterSpacing: '0.1em' }}>
                        TOPLAM SÜRE
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                        <span style={{ fontSize: '120px', fontWeight: 900, color: colors.text, lineHeight: '0.9', letterSpacing: '-0.04em' }}>
                            {stats.totalHours}
                        </span>
                        <span style={{ fontSize: '32px', fontWeight: 700, color: colors.text, opacity: 0.7 }}>
                            SAAT
                        </span>
                    </div>
                </div>

                {/* BENTO BOX 3: Top Genre */}
                <div style={{
                    flex: '1', height: '360px',
                    background: `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, ${colors.glow}33 100%)`,
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    borderRadius: '40px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '40px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <span style={{ fontSize: '24px', fontWeight: 600, color: colors.text, opacity: 0.5, letterSpacing: '0.1em' }}>
                        FAVORİ TÜR
                    </span>
                    <div>
                        <span style={{ fontSize: '55px', fontWeight: 900, color: colors.accent, lineHeight: '1.1', display: 'block', wordBreak: 'break-word' }}>
                            {(stats.topGenreName || 'Bilinmiyor').toUpperCase()}
                        </span>
                    </div>
                </div>
            </div>

            {/* BENTO ROW: Details & Persona */}
            <div style={{ position: 'absolute', top: '1490px', left: '70px', width: '940px', display: 'flex', gap: '30px', zIndex: 10 }}>
                
                {/* BENTO BOX 4: Counts (Movies & Episodes) */}
                <div style={{
                    flex: '1', height: '280px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    borderRadius: '40px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '40px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '20px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '22px', fontWeight: 600, color: colors.text, opacity: 0.6 }}>İZLENEN FİLM</span>
                        <span style={{ fontSize: '48px', fontWeight: 900, color: colors.text }}>{stats.movieCount}</span>
                    </div>
                    <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '22px', fontWeight: 600, color: colors.text, opacity: 0.6 }}>DİZİ BÖLÜMÜ</span>
                        <span style={{ fontSize: '48px', fontWeight: 900, color: colors.text }}>{stats.episodeCount}</span>
                    </div>
                </div>

                {/* BENTO BOX 5: Persona & Username */}
                <div style={{
                    flex: '1.2', height: '280px',
                    background: colors.text === '#ffffff' ? '#ffffff' : '#000000',
                    borderRadius: '40px',
                    padding: '40px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '15px'
                }}>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: colors.bg, opacity: 0.6, letterSpacing: '0.15em' }}>
                        SİNEMA UNVANIN
                    </span>
                    <span style={{ fontSize: '44px', fontWeight: 900, color: colors.bg, lineHeight: '1.1' }}>
                        {(stats.persona?.title || 'SİNEMA KAŞİFİ').toUpperCase()}
                    </span>
                    
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {avatarUrl ? (
                            <img src={avatarUrl} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${colors.glow}` }} />
                        ) : (
                            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: colors.glow, opacity: 0.8 }} />
                        )}
                        <span style={{ fontSize: '26px', fontWeight: 700, color: colors.bg, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '360px' }}>
                            @{username}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
