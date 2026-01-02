import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Card, SkeletonRow } from './Shared';

import { useTVScroll } from '../hooks/useTVScroll';

// Helper to get dimensions based on current window width matching index.css
const getItemDimensions = (layout, windowWidth) => {
    let fontSize = 16;
    if (windowWidth > 1600) fontSize = windowWidth * 0.0085; // 0.85vw
    else if (windowWidth > 1024) fontSize = 15;
    else if (windowWidth > 768) fontSize = 14;

    const isLandscape = layout === 'landscape';
    let width, gap;

    if (windowWidth > 1600) {
        // Large screens
        width = (isLandscape ? 24 : 14) * fontSize;
        gap = 1.2 * fontSize;
    } else if (windowWidth > 768) {
        // Medium screens
        width = isLandscape ? 320 : 180;
        gap = 16;
    } else {
        // Mobile/Standard
        width = isLandscape ? 260 : 140;
        gap = 12;
    }

    return { width, gap };
};

export const VirtualRow = memo(({ title, data, onSelect, onLoadMore, isLoadingMore, hasMore = true, layout = 'portrait' }) => {
    const containerRef = useTVScroll(); // Use TV Scroll Hook instead of plain useRef
    const [containerWidth, setContainerWidth] = useState(0);
    const [itemDims, setItemDims] = useState({ width: 0, gap: 0 });

    // Scroll Arrow States
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    // Only store the range indices in state to minimize re-renders
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });

    // Refs for values needed in scroll handler to avoid closure staleness without re-binding
    const itemDimsRef = useRef(itemDims);
    const dataLengthRef = useRef(data?.length || 0);
    const containerWidthRef = useRef(0);

    // Sync refs
    useEffect(() => { itemDimsRef.current = itemDims; }, [itemDims]);
    useEffect(() => { dataLengthRef.current = data?.length || 0; }, [data]);
    useEffect(() => { containerWidthRef.current = containerWidth; }, [containerWidth]);

    // 1. Measure Container & Dimensions on Resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const el = containerRef.current;
                setContainerWidth(el.clientWidth);

                // Update arrows logic
                setShowLeftArrow(el.scrollLeft > 10);
                setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);

                // Trigger initial calculation
                calculateRange(el.scrollLeft);
            }
            setItemDims(getItemDimensions(layout, window.innerWidth));
        };

        // Initial measurement delay to ensure DOM is ready
        const timer = setTimeout(updateDimensions, 50);
        window.addEventListener('resize', updateDimensions);
        return () => {
            window.removeEventListener('resize', updateDimensions);
            clearTimeout(timer);
        };
    }, [layout, data]);

    const calculateRange = useCallback((scrollLeft) => {
        const { width: itemWidth, gap } = itemDimsRef.current;
        const totalItemWidth = itemWidth + gap;
        if (totalItemWidth === 0) return;

        const overscan = 4; // Render extra items
        const visibleCount = Math.ceil(containerWidthRef.current / totalItemWidth);

        const newStart = Math.max(0, Math.floor(scrollLeft / totalItemWidth) - overscan);
        const newEnd = Math.min(dataLengthRef.current, Math.floor(scrollLeft / totalItemWidth) + visibleCount + overscan);

        setVisibleRange(prev => {
            if (prev.start !== newStart || prev.end !== newEnd) {
                return { start: newStart, end: newEnd };
            }
            return prev;
        });
    }, []);

    // 2. Optimized Handle Scroll
    const handleScroll = useCallback((e) => {
        const target = e.target;
        const scrollLeft = target.scrollLeft;
        const scrollWidth = target.scrollWidth;
        const clientWidth = target.clientWidth;

        // Update arrows
        setShowLeftArrow(scrollLeft > 10);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);

        requestAnimationFrame(() => {
            calculateRange(scrollLeft);
        });
    }, [calculateRange]);

    // 3. Virtualization Logic
    const { width: itemWidth, gap } = itemDims;
    const totalItemWidth = itemWidth + gap;

    if (!data || data.length === 0 || totalItemWidth === 0) return <SkeletonRow />;

    const totalContentWidth = data.length * totalItemWidth;

    const visibleItems = [];
    // Ensure we don't go out of bounds
    const safeEnd = Math.min(data.length, visibleRange.end);

    for (let i = visibleRange.start; i < safeEnd; i++) {
        visibleItems.push({
            ...data[i],
            virtualIndex: i,
            offsetLeft: i * totalItemWidth
        });
    }

    // Scroll Buttons implementation
    const manualScroll = (direction) => {
        if (containerRef.current) {
            const scrollAmount = containerWidth * 0.8;
            containerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="row-wrapper" style={{ position: 'relative' }}>
            <h3 className="row-header">{title}</h3>

            {showLeftArrow && (
                <button
                    className="scroll-btn left"
                    onClick={() => manualScroll('left')}
                    tabIndex="-1"
                    aria-label="Sola kaydır"
                    style={{ zIndex: 20 }}
                >
                    <i className="fas fa-chevron-left"></i>
                </button>
            )}

            <div
                className="row-scroll-container"
                ref={containerRef}
                onScroll={handleScroll}
                style={{
                    position: 'relative',
                    overflowX: 'auto',
                    height: layout === 'landscape' ? (itemWidth * 9 / 16 + 40) : (itemWidth * 3 / 2 + 40),
                    display: 'block',
                    willChange: 'scroll-position' // Hint to browser
                }}
            >
                {/* Phantom container to force scroll width */}
                <div style={{ width: totalContentWidth + (hasMore ? 300 : 0), height: '1px' }}></div>

                {visibleItems.map((m) => (
                    <div
                        key={`${m.id}-${m.virtualIndex}`}
                        style={{
                            position: 'absolute',
                            left: m.offsetLeft,
                            top: 8,
                            width: itemWidth,
                            height: layout === 'landscape' ? (itemWidth * 9 / 16) : (itemWidth * 3 / 2),
                            contain: 'layout paint' // Performance optimization for browser
                        }}
                    >
                        <Card
                            movie={m}
                            onSelect={onSelect}
                            layout={layout}
                            progress={m.progress || 0}
                        />
                    </div>
                ))}

                {/* Load More Button (Virtual) */}
                {onLoadMore && hasMore && (
                    <div
                        style={{
                            position: 'absolute',
                            left: data.length * totalItemWidth,
                            top: 8,
                            width: itemWidth,
                            height: layout === 'landscape' ? (itemWidth * 9 / 16) : (itemWidth * 3 / 2)
                        }}
                    >
                        <button
                            tabIndex="0"
                            onClick={onLoadMore}
                            disabled={isLoadingMore}
                            className={`poster-card focusable load-more-card ${layout === 'landscape' ? 'card-landscape' : 'card-portrait'}`}
                            style={{ width: '100%', height: '100%' }}
                        >
                            {isLoadingMore ? (
                                <i
                                    className="fas fa-circle-notch fa-spin"
                                    style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.6)' }}
                                />
                            ) : (
                                <>
                                    <div className="load-more-icon">
                                        <i className="fas fa-plus" style={{ fontSize: '1.3rem' }}></i>
                                    </div>
                                    <span style={{ fontWeight: '600', fontSize: '1rem' }}>Daha Fazla</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {showRightArrow && (
                <button
                    className="scroll-btn right"
                    onClick={() => manualScroll('right')}
                    tabIndex="-1"
                    aria-label="Sağa kaydır"
                    style={{ zIndex: 20 }}
                >
                    <i className="fas fa-chevron-right"></i>
                </button>
            )}
        </div>
    );
});