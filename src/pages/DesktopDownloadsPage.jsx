import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const statusLabel = (task) => {
    if (task.isPaused) return 'Duraklatıldı';
    switch ((task.status || '').toUpperCase()) {
        case 'COMPLETED':
            return 'İndirildi';
        case 'DOWNLOADING':
            return 'İndiriliyor';
        case 'PENDING':
            return 'Bekliyor';
        case 'FAILED':
            return 'Hata';
        case 'PAUSED':
            return 'Duraklatıldı';
        default:
            return task.status || 'Bilinmiyor';
    }
};

const statusColor = (task) => {
    if (task.isPaused) return '#d6a84f';
    switch ((task.status || '').toUpperCase()) {
        case 'COMPLETED':
            return '#66d19e';
        case 'DOWNLOADING':
            return '#7aa7ff';
        case 'PENDING':
            return '#d6a84f';
        case 'FAILED':
            return '#ff6b6b';
        case 'PAUSED':
            return '#d6a84f';
        default:
            return 'rgba(255,255,255,0.62)';
    }
};

const formatBytes = (bytes = 0) => {
    if (!bytes) return '0 MB';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
};

const mediaMeta = (task) => {
    const parts = [];
    parts.push(task.mediaType === 'tv' ? 'Dizi' : 'Film');
    if (task.mediaType === 'tv' && task.season && task.episode) {
        parts.push(`S${task.season}E${task.episode}`);
    }
    if (task.quality) parts.push(task.quality);
    return parts.join(' / ');
};

const tmdbImage = (path, size) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `https://image.tmdb.org/t/p/${size}${path}`;
};

const DesktopDownloadsPage = () => {
    const navigate = useNavigate();
    const [downloads, setDownloads] = useState([]);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);
    const isDesktop = typeof window !== 'undefined' && !!window.NoxisDesktop;

    const refresh = async () => {
        if (!window.NoxisDesktop?.downloads) return;
        try {
            const data = await window.NoxisDesktop.downloads.list();
            setDownloads(data.downloads || []);
            setStats(data.stats || null);
            setError(null);
        } catch (err) {
            setError(err.message || 'İndirilenler okunamadı.');
        }
    };

    useEffect(() => {
        refresh();
        if (!window.NoxisDesktop?.downloads?.onChanged) return undefined;
        return window.NoxisDesktop.downloads.onChanged((data) => {
            setDownloads(data.downloads || []);
            setStats(data.stats || null);
        });
    }, []);

    const featured = useMemo(
        () => downloads.find(task => task.status === 'COMPLETED') || downloads[0] || null,
        [downloads]
    );

    const playTask = async (task) => {
        if (!task?.canPlay) return;
        const playable = await window.NoxisDesktop.downloads.playable(task.id);
        if (!playable?.localUrl) return;

        const type = playable.mediaType || 'movie';
        const params = new URLSearchParams({
            local: 'true',
            url: playable.localUrl,
            title: playable.title || 'Çevrimdışı Video'
        });

        if (playable.posterPath) params.set('poster', playable.posterPath);
        if (playable.backdropPath) params.set('backdrop', playable.backdropPath);
        if (playable.season) params.set('s', playable.season);
        if (playable.episode) params.set('e', playable.episode);

        navigate(`/play/${type}/${playable.id}?${params.toString()}`, {
            state: { from: '/downloads' }
        });
    };

    const pauseTask = async (task) => {
        await window.NoxisDesktop.downloads.pause(task.id);
        refresh();
    };

    const resumeTask = async (task) => {
        await window.NoxisDesktop.downloads.resume(task.id);
        refresh();
    };

    const deleteTask = async (task) => {
        await window.NoxisDesktop.downloads.delete(task.id);
        refresh();
    };

    if (!isDesktop) {
        return (
            <div className="desktop-downloads-page">
                <div className="desktop-downloads-empty">
                    <span>Bu ekran yalnızca Noxis Windows uygulamasında çalışır.</span>
                    <button type="button" onClick={() => navigate('/')}>Ana sayfa</button>
                </div>
            </div>
        );
    }

    return (
        <div className="desktop-downloads-page">
            <div className="desktop-downloads-header">
                <div>
                    <div className="desktop-kicker">NOXIS DESKTOP</div>
                    <h1>İndirilenler</h1>
                </div>
                <div className="desktop-downloads-actions">
                    <button type="button" onClick={() => navigate('/')}>
                        Keşfet
                    </button>
                    <button type="button" onClick={refresh}>
                        Yenile
                    </button>
                </div>
            </div>

            {error && <div className="desktop-downloads-error">{error}</div>}

            {featured && (
                <button
                    type="button"
                    className="desktop-downloads-hero"
                    onClick={() => playTask(featured)}
                    disabled={!featured.canPlay}
                >
                    {tmdbImage(featured.backdropPath || featured.posterPath, 'w1280') && (
                        <img src={tmdbImage(featured.backdropPath || featured.posterPath, 'w1280')} alt="" />
                    )}
                    <div className="desktop-downloads-hero-shade" />
                    <div className="desktop-downloads-hero-content">
                        {tmdbImage(featured.posterPath, 'w342') && (
                            <img className="desktop-downloads-poster" src={tmdbImage(featured.posterPath, 'w342')} alt="" />
                        )}
                        <div>
                            <span style={{ color: statusColor(featured) }}>{statusLabel(featured)}</span>
                            <h2>{featured.title}</h2>
                            <p>{mediaMeta(featured)}</p>
                            <strong>{featured.canPlay ? 'Oynat' : `%${featured.progress || 0}`}</strong>
                        </div>
                    </div>
                </button>
            )}

            <div className="desktop-downloads-summary">
                <span>{downloads.length} içerik</span>
                <span>{formatBytes(stats?.downloadBytes)} yerel depolama</span>
                <span>{stats?.rootDir || ''}</span>
            </div>

            {downloads.length === 0 ? (
                <div className="desktop-downloads-empty">
                    <span>Henüz indirilen içerik yok.</span>
                    <button type="button" onClick={() => navigate('/')}>Keşfet</button>
                </div>
            ) : (
                <div className="desktop-downloads-list">
                    {downloads.map(task => (
                        <div className="desktop-download-row" key={task.id}>
                            <button
                                type="button"
                                className="desktop-download-thumb"
                                onClick={() => playTask(task)}
                                disabled={!task.canPlay}
                            >
                                {tmdbImage(task.posterPath || task.backdropPath, 'w342') ? (
                                    <img src={tmdbImage(task.posterPath || task.backdropPath, 'w342')} alt="" />
                                ) : (
                                    <span>N</span>
                                )}
                            </button>

                            <div className="desktop-download-info">
                                <div className="desktop-download-title-line">
                                    <h3>{task.title}</h3>
                                    <span style={{ color: statusColor(task) }}>{statusLabel(task)}</span>
                                </div>
                                <p>{mediaMeta(task)}</p>
                                {task.error && <small>{task.error}</small>}
                                <div className="desktop-download-progress">
                                    <div style={{ width: `${Math.max(0, Math.min(100, task.progress || 0))}%` }} />
                                </div>
                            </div>

                            <div className="desktop-download-controls">
                                {task.canPlay && (
                                    <button type="button" onClick={() => playTask(task)}>Oynat</button>
                                )}
                                {(task.status === 'DOWNLOADING' || task.status === 'PENDING') && (
                                    <button type="button" onClick={() => pauseTask(task)}>Duraklat</button>
                                )}
                                {(task.status === 'PAUSED' || task.status === 'FAILED' || task.isPaused) && (
                                    <button type="button" onClick={() => resumeTask(task)}>Sürdür</button>
                                )}
                                <button type="button" onClick={() => deleteTask(task)}>Sil</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DesktopDownloadsPage;
