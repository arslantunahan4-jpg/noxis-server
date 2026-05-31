import { useEffect, useRef } from 'react';

/**
 * useTVScroll Hook
 * Automatically scrolls the container to align the focused element to the left.
 * usage: const containerRef = useTVScroll();
 * <div ref={containerRef} ... > {children} </div>
 */
export const useTVScroll = () => {
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleFocus = (e) => {
            const focusedEl = e.target;
            if (!container.contains(focusedEl)) return;

            // Calculate exact position to snap to left
            // We subtract a small padding (e.g. 40px) to keep it from sticking strictly to the edge
            // But user requested "en sola" (far left), so we'll try 0 or small padding.
            const containerLeft = container.getBoundingClientRect().left;
            const elementLeft = focusedEl.getBoundingClientRect().left;
            const scrollLeft = container.scrollLeft;

            // Target Scroll = Current Scroll + (Element relative to viewport - Container relative to viewport)
            // This aligns Element Lead Edge to Container Lead Edge
            const newScrollLeft = scrollLeft + (elementLeft - containerLeft);

            container.scrollTo({
                left: newScrollLeft,
                behavior: 'smooth'
            });
        };

        // Use Capture to detect focus events on children bubbling up/capturing down
        // 'focus' does not bubble, but 'focusin' does.
        container.addEventListener('focusin', handleFocus);

        return () => {
            container.removeEventListener('focusin', handleFocus);
        };
    }, []);

    return containerRef;
};
