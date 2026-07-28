import React, { useEffect, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ORIGINAL_IMG } from './Shared';
import { VirtualRow } from './VirtualRow';

export const HeroCarousel = memo(({ movies, onPlay, onDetails }) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!movies?.length) return undefined;
        const timer = window.setInterval(() => setIndex((value) => (value + 1) % movies.length), 9000);
        return () => window.clearInterval(timer);
    }, [movies]);

    if (!movies?.length) {
        return <section className="tv-hero-native tv-hero-loading" />;
    }

    const movie = movies[index % movies.length];
    const title = movie.title || movie.name;
    const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    const mediaType = movie.media_type === 'tv' || movie.first_air_date ? 'Dizi' : 'Film';
    const rating = Number(movie.vote_average || 0).toFixed(1);
    const backdrop = ORIGINAL_IMG + (movie.backdrop_path || movie.poster_path);
    const poster = ORIGINAL_IMG + (movie.poster_path || movie.backdrop_path);

    return (
        <section className="tv-hero-native">
            <AnimatePresence initial={false}>
                <motion.div
                    key={movie.id}
                    className="tv-hero-bg"
                    initial={{ opacity: 0, scale: 1.012 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.004 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    style={{ backgroundImage: `url("${backdrop}")` }}
                />
            </AnimatePresence>
            <div className="tv-hero-vignette" />
            <div className="tv-hero-bottom-fade" />

            <motion.div
                className="tv-hero-copy-native"
                key={`copy-${movie.id}`}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.24, delay: 0.04 }}
            >
                <span className="tv-kicker">Noxis seçkisi</span>
                <h1>{title}</h1>
                <div className="tv-hero-meta">
                    {year && <span>{year}</span>}
                    <span>{mediaType}</span>
                    {Number(movie.vote_average) > 0 && <span><i className="fas fa-star" /> {rating}</span>}
                    <span>HD</span>
                </div>
                <p>{movie.overview || 'Bu içerik için açıklama bilgisi bulunmuyor.'}</p>
                <div className="tv-hero-actions">
                    <button type="button" className="focusable tv-action tv-action-primary" onClick={() => onPlay(movie)}>
                        <i className="fas fa-play" />
                        <span>Oynat</span>
                    </button>
                    <button type="button" className="focusable tv-action tv-action-secondary" onClick={() => onDetails(movie)}>
                        <i className="fas fa-info-circle" />
                        <span>Detaylar</span>
                    </button>
                </div>
            </motion.div>

            <motion.aside
                className="tv-hero-feature-card"
                initial={{ opacity: 0, x: 40, rotateY: -8 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                transition={{ duration: 0.26, delay: 0.06 }}
            >
                <img src={poster} alt="" />
                <div>
                    <span>Şimdi öne çıkan</span>
                    <strong>{title}</strong>
                </div>
            </motion.aside>

            <div className="tv-hero-switcher" aria-label="Öne çıkan içerikler">
                {movies.slice(0, 6).map((candidate, candidateIndex) => (
                    <button
                        key={candidate.id || candidateIndex}
                        type="button"
                        className={`focusable tv-hero-dot ${candidateIndex === index ? 'active' : ''}`}
                        onClick={() => setIndex(candidateIndex)}
                        aria-label={`${candidateIndex + 1}. öne çıkan içerik`}
                    />
                ))}
            </div>
        </section>
    );
});

export const Row = VirtualRow;
