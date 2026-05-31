import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartImage, ORIGINAL_IMG, Card, SkeletonRow } from './Shared';

export const HeroCarousel = memo(({ movies, onPlay, onDetails }) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!movies?.length) return;
        const timer = setInterval(() => setIndex(p => (p + 1) % movies.length), 7000);
        return () => clearInterval(timer);
    }, [movies]);

    if (!movies?.length) {
        return (
            <div
                className="hero-section skeleton"
                style={{ margin: '0', borderRadius: '0' }}
            />
        );
    }

    const movie = movies[index];

    const prevSlide = () => {
        setIndex(prev => (prev === 0 ? movies.length - 1 : prev - 1));
    };

    const nextSlide = () => {
        setIndex(prev => (prev + 1) % movies.length);
    };

    return (
        <div className="hero-section">
            <AnimatePresence mode="wait">
                <motion.div
                    key={movie.id}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{ position: 'absolute', inset: 0 }}
                >
                    <SmartImage
                        src={ORIGINAL_IMG + (movie.backdrop_path || movie.poster_path)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div className="hero-gradient"></div>
                    <div className="hero-gradient-side"></div>
                </motion.div>
            </AnimatePresence>

            <div className="hero-content">
                <motion.div
                    key={`content-${movie.id}`}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                >
                    <h1 className="hero-title">{movie.title || movie.name}</h1>
                    <p className="hero-overview">{movie.overview}</p>
                    <div className="hero-buttons">
                        <button
                            tabIndex="0"
                            onClick={() => onPlay(movie)}
                            className="focusable hero-button"
                        >
                            <i className="fas fa-play"></i>
                            <span>Oynat</span>
                        </button>
                        <button
                            tabIndex="0"
                            onClick={() => onDetails(movie)}
                            className="focusable hero-button secondary"
                        >
                            <i className="fas fa-info-circle"></i>
                            <span>Daha Fazla</span>
                        </button>
                    </div>
                </motion.div>
            </div>

            <button
                className="scroll-btn left"
                onClick={prevSlide}
                style={{ left: '1rem', zIndex: 40 }}
                aria-label="Önceki"
            >
                <i className="fas fa-chevron-left"></i>
            </button>

            <button
                className="scroll-btn right"
                onClick={nextSlide}
                style={{ right: '1rem', zIndex: 40 }}
                aria-label="Sonraki"
            >
                <i className="fas fa-chevron-right"></i>
            </button>

            <div style={{
                position: 'absolute',
                bottom: '2rem',
                right: '3vw',
                display: 'flex',
                gap: '0.5rem',
                zIndex: 30
            }}>
                {movies.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setIndex(i)}
                        style={{
                            width: i === index ? '2rem' : '0.5rem',
                            height: '0.5rem',
                            borderRadius: '4px',
                            background: i === index
                                ? 'rgba(255, 255, 255, 0.9)'
                                : 'rgba(255, 255, 255, 0.3)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.4s ease'
                        }}
                    />
                ))}
            </div>
        </div>
    );
});

import { VirtualRow } from './VirtualRow';

export const Row = VirtualRow;
