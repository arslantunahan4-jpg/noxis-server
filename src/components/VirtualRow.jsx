import React, { memo, useCallback, useEffect, useState } from 'react';
import { Card, SkeletonRow } from './Shared';

const GAP = 24;
const WINDOW_BEHIND = 2;
const WINDOW_AHEAD = 7;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const cardWidthFor = (layout, viewportWidth) => (
    layout === 'landscape'
        ? clamp(viewportWidth * 0.268, 430, 560)
        : clamp(viewportWidth * 0.142, 220, 286)
);

export const VirtualRow = memo(({
    title,
    data,
    onSelect,
    onLoadMore,
    isLoadingMore,
    hasMore = true,
    layout = 'portrait'
}) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isFocused, setIsFocused] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth || 1920);

    useEffect(() => {
        const onResize = () => setViewportWidth(window.innerWidth || 1920);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const handleCardFocus = useCallback((item, itemIndex) => {
        setActiveIndex(itemIndex);
        setIsFocused(true);
    }, []);

    if (!data || data.length === 0) return <SkeletonRow />;

    const canLoadMore = Boolean(onLoadMore && hasMore);
    const totalCount = data.length + (canLoadMore ? 1 : 0);
    const safeActiveIndex = clamp(activeIndex, 0, Math.max(totalCount - 1, 0));
    const cardWidth = cardWidthFor(layout, viewportWidth);
    const step = cardWidth + GAP;
    const safePadding = viewportWidth * (viewportWidth <= 1280 ? 0.026 : 0.034);
    const totalWidth = Math.max(0, totalCount * step - GAP + safePadding * 2);
    const maxOffset = Math.max(0, totalWidth - viewportWidth);
    const railOffset = clamp(safeActiveIndex * step, 0, maxOffset);
    const windowStart = Math.max(0, safeActiveIndex - WINDOW_BEHIND);
    const windowEnd = Math.min(totalCount, safeActiveIndex + WINDOW_AHEAD + 1);
    const visibleItems = data.slice(windowStart, Math.min(data.length, windowEnd));
    const leadingSpace = windowStart > 0 ? Math.max(0, windowStart * step - GAP) : 0;
    const trailingCount = Math.max(0, totalCount - windowEnd);
    const trailingSpace = trailingCount > 0 ? Math.max(0, trailingCount * step - GAP) : 0;
    const activeItem = data[Math.min(safeActiveIndex, Math.max(data.length - 1, 0))];

    return (
        <section
            className={`tv-rail ${isFocused ? 'tv-rail-focused' : ''}`}
            aria-label={title}
            onMouseLeave={() => setIsFocused(false)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
            }}
        >
            <div className="tv-rail-heading">
                <div><h2>{title}</h2></div>
            </div>
            <div className="tv-rail-viewport">
                <div
                    className={`tv-rail-strip tv-rail-strip-${layout}`}
                    style={{ transform: `translate3d(${-railOffset}px, 0, 0)` }}
                >
                    {leadingSpace > 0 && <span className="tv-rail-spacer" style={{ width: `${leadingSpace}px` }} />}
                    {visibleItems.map((item, windowIndex) => {
                        const itemIndex = windowStart + windowIndex;
                        return (
                            <Card
                                key={`${item.id}-${itemIndex}`}
                                movie={item}
                                onSelect={onSelect}
                                layout={layout}
                                progress={item.progress || 0}
                                rowKey={title}
                                index={itemIndex}
                                onFocusItem={handleCardFocus}
                                isSpotlight={isFocused && safeActiveIndex === itemIndex}
                            />
                        );
                    })}
                    {canLoadMore && windowEnd > data.length && (
                        <button
                            type="button"
                            className={`focusable tv-card tv-card-${layout} tv-load-more-card`}
                            onClick={onLoadMore}
                            onMouseEnter={() => {
                                setActiveIndex(data.length);
                                setIsFocused(true);
                            }}
                            disabled={isLoadingMore}
                        >
                            <span className="tv-load-more-icon"><i className={`fas ${isLoadingMore ? 'fa-circle-notch fa-spin' : 'fa-plus'}`} /></span>
                            <span className="tv-load-more-copy">
                                <strong>{isLoadingMore ? 'Yükleniyor' : 'Daha fazla'}</strong>
                                <small>Keşfetmeye devam et</small>
                            </span>
                        </button>
                    )}
                    {trailingSpace > 0 && <span className="tv-rail-spacer" style={{ width: `${trailingSpace}px` }} />}
                </div>
            </div>
            {activeItem && (
                <div className="tv-rail-active-panel">
                    <div className="tv-rail-active-meta">
                        {(activeItem.release_date || activeItem.first_air_date) && <span>{(activeItem.release_date || activeItem.first_air_date).slice(0, 4)}</span>}
                        <span>{activeItem.media_type === 'tv' || activeItem.first_air_date ? 'Dizi' : 'Film'}</span>
                        {Number(activeItem.vote_average) > 0 && <span>★ {Number(activeItem.vote_average).toFixed(1)}</span>}
                        <span>HD</span>
                    </div>
                    <h3>{activeItem.title || activeItem.name}</h3>
                    <p>{activeItem.overview || 'Bu içerik için açıklama bilgisi bulunmuyor.'}</p>
                </div>
            )}
        </section>
    );
});

export default VirtualRow;
