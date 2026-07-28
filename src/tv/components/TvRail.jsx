import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { imageUrl, mediaTitle, mediaType, mediaYear, ratingText } from '../utils/media';
import { preloadImages } from '../utils/tmdbCache';

const GAP = 24;
const WINDOW_BEHIND = 2;
const WINDOW_AHEAD = 7;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const cardWidthFor = (layout, viewportWidth) => {
    if (viewportWidth <= 480) {
        return layout === 'landscape'
            ? clamp(viewportWidth * 0.76, 220, 310)
            : clamp(viewportWidth * 0.4, 130, 165);
    }
    if (viewportWidth <= 768) {
        return layout === 'landscape'
            ? clamp(viewportWidth * 0.54, 280, 390)
            : clamp(viewportWidth * 0.28, 155, 205);
    }
    if (viewportWidth <= 1024) {
        return layout === 'landscape'
            ? clamp(viewportWidth * 0.38, 340, 440)
            : clamp(viewportWidth * 0.2, 180, 230);
    }
    if (layout === 'landscape') return clamp(viewportWidth * 0.268, 420, 560);
    return clamp(viewportWidth * 0.142, 210, 286);
};

const railMeta = (item) => [
    mediaYear(item),
    mediaType(item) === 'tv' ? 'Dizi' : 'Film',
    ratingText(item) ? `★ ${ratingText(item)}` : null,
    'HD'
].filter(Boolean);

const cardImageUrl = (item, layout) => imageUrl(
    layout === 'landscape'
        ? (item.backdrop_path || item.poster_path)
        : (item.poster_path || item.backdrop_path),
    layout === 'landscape' ? 'w780' : 'w500'
);

export const TvCard = memo(({
    item,
    layout = 'portrait',
    rowKey = 'row',
    index = 0,
    onSelect,
    onFocusItem,
    onHoverItem,
    isSpotlight = false,
    showRank = false
}) => {
    const type = mediaType(item);
    const title = mediaTitle(item);
    const image = cardImageUrl(item, layout);
    const watchProgress = Number(item.progress);
    const hasProgress = Number.isFinite(watchProgress) && watchProgress > 0 && watchProgress < 100;

    const handleClick = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect?.(item);
    }, [item, onSelect]);

    const handlePointerDown = useCallback((event) => {
        if (event.pointerType === 'mouse' && event.button === 0) {
            onSelect?.(item);
        }
    }, [item, onSelect]);

    return (
        <button
            type="button"
            className={`focusable tv-card tv-card-${layout} ${isSpotlight ? 'tv-card-active' : ''} ${showRank ? 'has-rank' : ''}`}
            data-focus-id={`${rowKey}-${type}-${item.id}-${index}`}
            data-tv-focus-index={index}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onMouseEnter={() => onHoverItem?.(index)}
            onMouseLeave={() => onHoverItem?.(null)}
            onFocus={() => onFocusItem?.(item, index)}
            aria-label={title}
        >
            {showRank && (
                <span className="tv-card-rank-badge">
                    <span className="tv-card-rank-num">{index + 1}</span>
                </span>
            )}
            <span className="tv-card-media">
                {image ? (
                    <img src={image} alt={title} loading="lazy" decoding="async" />
                ) : (
                    <span className="tv-card-fallback">
                        <i className="fas fa-film" />
                    </span>
                )}
            </span>
            <span className="tv-card-shade" />
            <span className="tv-card-focus-layer">
                <i className="fas fa-play" />
            </span>
            <span className="tv-card-copy">
                <span className="tv-card-title">{title}</span>
                <span className="tv-card-meta">
                    {mediaYear(item) && <span>{mediaYear(item)}</span>}
                    <span>{type === 'tv' ? 'Dizi' : 'Film'}</span>
                    {ratingText(item) && (
                        <span>
                            <i className="fas fa-star" /> {ratingText(item)}
                        </span>
                    )}
                    {item.season && item.episode && <span>S{item.season} · B{item.episode}</span>}
                </span>
                {hasProgress && (
                    <span className="tv-card-progress">
                        <span style={{ width: `${clamp(watchProgress, 0, 100)}%` }} />
                    </span>
                )}
            </span>
        </button>
    );
});

export const TvLoadMoreCard = memo(({
    layout = 'portrait',
    rowKey = 'row',
    index = 0,
    loading = false,
    onSelect,
    onFocus
}) => (
    <button
        type="button"
        className={`focusable tv-card tv-card-${layout} tv-load-more-card`}
        data-focus-id={`${rowKey}-load-more`}
        data-tv-focus-index={index}
        onClick={onSelect}
        onPointerDown={() => onSelect?.()}
        onFocus={onFocus}
        disabled={loading}
    >
        <span className="tv-load-more-icon">
            <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : 'fa-plus'}`} />
        </span>
        <span className="tv-load-more-copy">
            <strong>{loading ? 'Yükleniyor' : 'Daha fazla'}</strong>
            <small>Keşfetmeye devam et</small>
        </span>
    </button>
));

export const TvRailSkeleton = ({ title = 'Yükleniyor', layout = 'portrait' }) => (
    <section className="tv-rail tv-rail-skeleton-shell">
        <div className="tv-rail-heading">
            <h2>{title}</h2>
        </div>
        <div className="tv-rail-viewport">
            <div className={`tv-rail-strip tv-rail-strip-${layout}`}>
                {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className={`tv-card tv-card-${layout} tv-card-skeleton`} />
                ))}
            </div>
        </div>
    </section>
);

const TvRailActivePanel = memo(({ item }) => {
    if (!item) return <div className="tv-rail-active-panel" aria-hidden="true" />;

    return (
        <div className="tv-rail-active-panel">
            <div className="tv-rail-active-meta">
                {railMeta(item).map((entry) => <span key={entry}>{entry}</span>)}
            </div>
            <h3>{mediaTitle(item)}</h3>
            <p>{item.overview || 'Bu içerik için açıklama bilgisi bulunmuyor.'}</p>
        </div>
    );
});

export const TvRail = memo(({
    title,
    items = [],
    layout = 'portrait',
    rowKey = 'row',
    onSelect,
    eyebrow = null,
    canLoadMore = false,
    loadingMore = false,
    onLoadMore,
    isTop10 = false
}) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const [viewportWidth, setViewportWidth] = useState(() => (
        typeof window !== 'undefined' ? window.innerWidth : 1920
    ));
    const [isFocused, setIsFocused] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const totalCount = items.length + (canLoadMore ? 1 : 0);
    const safeActiveIndex = clamp(activeIndex, 0, Math.max(totalCount - 1, 0));
    const activeItemIndex = (hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < items.length)
        ? hoveredIndex
        : safeActiveIndex;
    const activeItem = items[Math.min(activeItemIndex, Math.max(items.length - 1, 0))] || null;
    const stableRowKey = useMemo(() => rowKey, [rowKey]);

    const { windowStart, windowEnd, railOffset, step } = useMemo(() => {
        const currentCardWidth = cardWidthFor(layout, viewportWidth);
        const currentStep = currentCardWidth + GAP;
        const targetIndex = safeActiveIndex;

        if (isMobile) {
            return {
                windowStart: 0,
                windowEnd: items.length,
                railOffset: 0,
                step: currentStep
            };
        }

        const maxVisibleCards = Math.max(3, Math.floor((viewportWidth - (GAP * 2)) / currentStep));
        const lead = Math.max(1, Math.floor(maxVisibleCards * 0.35));
        const desiredStart = Math.max(0, targetIndex - lead);
        const maxStart = Math.max(0, totalCount - maxVisibleCards);
        const start = clamp(desiredStart, 0, maxStart);
        const end = Math.min(totalCount, start + maxVisibleCards);
        const offset = start * currentStep;

        return {
            windowStart: Math.max(0, start - WINDOW_BEHIND),
            windowEnd: Math.min(totalCount, end + WINDOW_AHEAD),
            railOffset: offset,
            step: currentStep
        };
    }, [isMobile, layout, viewportWidth, hoveredIndex, safeActiveIndex, totalCount, items.length]);

    const itemWindowEnd = Math.min(items.length, windowEnd);
    const visibleItems = items.slice(windowStart, itemWindowEnd);
    const leadingSpace = !isMobile && windowStart > 0 ? Math.max(0, windowStart * step - GAP) : 0;
    const trailingCount = !isMobile ? Math.max(0, totalCount - windowEnd) : 0;
    const trailingSpace = trailingCount > 0 ? Math.max(0, trailingCount * step - GAP) : 0;

    useEffect(() => {
        const handleResize = () => setViewportWidth(window.innerWidth || 1920);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setActiveIndex((value) => clamp(value, 0, Math.max(totalCount - 1, 0)));
        setHoveredIndex(null);
    }, [stableRowKey, totalCount]);

    const handleRailBlur = useCallback((event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsFocused(false);
            setHoveredIndex(null);
        }
    }, []);

    const handleCardFocus = useCallback((item, index) => {
        setActiveIndex(index);
    }, []);

    const handleCardHover = useCallback((index) => {
        setHoveredIndex(index);
    }, []);

    const handleLoadMoreFocus = useCallback(() => {
        setActiveIndex(items.length);
    }, [items.length]);

    const lastWheelTime = React.useRef(0);
    const handleWheel = useCallback((event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            const now = Date.now();
            if (now - lastWheelTime.current < 150) return;

            if (event.deltaX > 15) {
                setActiveIndex((prev) => Math.min(totalCount - 1, prev + 1));
                lastWheelTime.current = now;
            } else if (event.deltaX < -15) {
                setActiveIndex((prev) => Math.max(0, prev - 1));
                lastWheelTime.current = now;
            }
        }
    }, [totalCount]);

    if (!items.length) return null;

    const isTop10Rail = isTop10 || stableRowKey === 'top10';

    return (
        <motion.section
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={`tv-rail ${isFocused ? 'tv-rail-focused' : ''} ${isTop10Rail ? 'tv-rail-top10' : ''}`}
            aria-label={title}
            data-tv-focus-group={stableRowKey}
            data-tv-focus-axis="horizontal"
            onFocus={() => setIsFocused(true)}
            onBlur={handleRailBlur}
            onWheel={handleWheel}
        >
            <div className="tv-rail-heading">
                <div>
                    {eyebrow && <span className="tv-rail-eyebrow">{eyebrow}</span>}
                    <h2>{title}</h2>
                </div>
            </div>
            <div className="tv-rail-viewport">
                <div
                    className={`tv-rail-strip tv-rail-strip-${layout}`}
                    style={{ transform: `translate3d(${-railOffset}px, 0, 0)` }}
                >
                    {leadingSpace > 0 && <span className="tv-rail-spacer" style={{ width: `${leadingSpace}px` }} />}
                    {visibleItems.map((item, windowIndex) => {
                        const index = windowStart + windowIndex;
                        return (
                            <TvCard
                                key={`${mediaType(item)}-${item.id}`}
                                item={item}
                                layout={layout}
                                rowKey={stableRowKey}
                                index={index}
                                onSelect={onSelect}
                                onFocusItem={handleCardFocus}
                                onHoverItem={handleCardHover}
                                isSpotlight={isFocused && safeActiveIndex === index}
                                showRank={isTop10Rail && index < 10}
                            />
                        );
                    })}
                    {canLoadMore && windowEnd > items.length && (
                        <TvLoadMoreCard
                            layout={layout}
                            rowKey={stableRowKey}
                            index={items.length}
                            loading={loadingMore}
                            onSelect={onLoadMore}
                            onFocus={handleLoadMoreFocus}
                        />
                    )}
                    {trailingSpace > 0 && <span className="tv-rail-spacer" style={{ width: `${trailingSpace}px` }} />}
                </div>
            </div>
            {!isMobile && <TvRailActivePanel item={activeItem} />}
        </motion.section>
    );
});
