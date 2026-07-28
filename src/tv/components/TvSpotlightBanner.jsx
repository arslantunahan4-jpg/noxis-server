import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { imageUrl, mediaTitle, mediaType, mediaYear, ratingText } from '../utils/media';

export const TvSpotlightBanner = memo(({ item, onSelect, eyebrow = "Haftanın Öne Çıkan Seçkisi" }) => {
    if (!item) return null;

    const title = mediaTitle(item);
    const type = mediaType(item);
    const year = mediaYear(item);
    const rating = ratingText(item);
    const overview = item.overview || item.description || '';
    const backdrop = imageUrl(item.backdrop_path || item.poster_path, 'original');
    const poster = imageUrl(item.poster_path || item.backdrop_path, 'w500');

    return (
        <motion.div
            initial={{ opacity: 0, y: 35, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="tv-spotlight-banner"
            onClick={() => onSelect?.(item)}
        >
            <div className="tv-spotlight-bg">
                {backdrop && <img src={backdrop} alt={title} loading="lazy" />}
                <div className="tv-spotlight-overlay" />
            </div>

            <div className="tv-spotlight-content">
                <div className="tv-spotlight-info">
                    <div className="tv-spotlight-eyebrow">
                        <i className="fas fa-fire" /> {eyebrow}
                    </div>
                    <h2 className="tv-spotlight-title">{title}</h2>
                    <div className="tv-spotlight-meta">
                        {rating && <span className="tv-spotlight-rating"><i className="fas fa-star" /> {rating}</span>}
                        {year && <span className="tv-spotlight-year">{year}</span>}
                        <span className="tv-spotlight-badge">{type === 'tv' ? 'Dizi' : 'Film'}</span>
                        <span className="tv-spotlight-quality">4K Ultra HD</span>
                    </div>
                    {overview && <p className="tv-spotlight-overview">{overview}</p>}
                    <div className="tv-spotlight-actions">
                        <button
                            type="button"
                            className="tv-spotlight-btn-play"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect?.(item);
                            }}
                        >
                            <i className="fas fa-play" /> Hemen İzle
                        </button>
                        <button
                            type="button"
                            className="tv-spotlight-btn-detail"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect?.(item);
                            }}
                        >
                            <i className="fas fa-info-circle" /> Detaylar
                        </button>
                    </div>
                </div>

                {poster && (
                    <div className="tv-spotlight-poster">
                        <img src={poster} alt={title} loading="lazy" />
                    </div>
                )}
            </div>
        </motion.div>
    );
});
