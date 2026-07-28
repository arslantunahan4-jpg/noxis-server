import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SELECTOR = '.focusable:not([disabled]), .tv-focusable:not([disabled])';
const GROUP_SELECTOR = '[data-tv-focus-group]';
const routeFocusMemory = new Map();
const groupIndexMemory = new Map();

const isVisible = (element) => {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        element.getClientRects().length > 0;
};

const escapeFocusId = (value) => {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
};

const getDirection = (event) => {
    if (['ArrowUp', 'Up'].includes(event.key) || event.keyCode === 38) return 'up';
    if (['ArrowDown', 'Down'].includes(event.key) || event.keyCode === 40) return 'down';
    if (['ArrowLeft', 'Left'].includes(event.key) || event.keyCode === 37) return 'left';
    if (['ArrowRight', 'Right'].includes(event.key) || event.keyCode === 39) return 'right';
    return null;
};

const isBackKey = (event) => (
    ['Escape', 'Esc', 'XF86Back', 'BrowserBack'].includes(event.key) ||
    [10009, 461, 27, 10182, 166].includes(event.keyCode)
);

const isEnterKey = (event) => (
    ['Enter', 'Select'].includes(event.key) || [13, 195].includes(event.keyCode)
);

const focusablesIn = (root) => {
    const descendants = Array.from(root.querySelectorAll(SELECTOR));
    const candidates = root.matches?.(SELECTOR) ? [root, ...descendants] : descendants;
    return candidates.filter(isVisible);
};

const groupKey = (group) => group?.dataset.tvFocusGroup || '';

const groupsInDocument = () => Array.from(document.querySelectorAll(GROUP_SELECTOR))
    .filter(isVisible)
    .filter((group) => focusablesIn(group).length > 0);

const logicalIndex = (element, fallback = 0) => {
    const parsed = Number.parseInt(element?.dataset.tvFocusIndex, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const gridColumnCount = (group, elements) => {
    const explicit = Number.parseInt(group?.dataset.tvGridColumns, 10);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    const template = window.getComputedStyle(group).gridTemplateColumns || '';
    const columns = template.split(' ').filter(Boolean).length;
    return Math.max(columns, elements.length ? 1 : 0);
};

const scrollVerticalContainer = (element, direction) => {
    if (direction !== 'up' && direction !== 'down') return;
    const screen = element.closest('.tv-screen');
    const group = element.closest(GROUP_SELECTOR) || element;
    if (!screen || !group || screen.scrollHeight <= screen.clientHeight) return;

    const screenRect = screen.getBoundingClientRect();
    const groupRect = group.getBoundingClientRect();
    const preferredTop = screenRect.top + Math.min(150, screenRect.height * 0.18);
    const nextScrollTop = screen.scrollTop + groupRect.top - preferredTop;
    screen.scrollTop = Math.max(0, Math.min(nextScrollTop, screen.scrollHeight - screen.clientHeight));
};

export const useTvRemote = ({ enabled = true, onBack } = {}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const routeKey = `${location.pathname}${location.search}`;
    const routeKeyRef = useRef(routeKey);
    const hasUserNavigatedRef = useRef(false);
    const autofocusAppliedRef = useRef(false);
    routeKeyRef.current = routeKey;

    const rememberFocus = useCallback((element) => {
        if (!hasUserNavigatedRef.current) return;
        const focusId = element?.dataset.focusId || element?.id || '';
        if (focusId) routeFocusMemory.set(routeKeyRef.current, focusId);

        const group = element?.closest?.(GROUP_SELECTOR);
        const key = groupKey(group);
        if (key) {
            const elements = focusablesIn(group);
            const fallback = Math.max(elements.indexOf(element), 0);
            groupIndexMemory.set(key, logicalIndex(element, fallback));
        }
    }, []);

    const focusElement = useCallback((element, options = {}) => {
        if (!element || !isVisible(element)) return false;
        try {
            element.focus({ preventScroll: true });
        } catch {
            element.focus();
        }
        rememberFocus(element);
        scrollVerticalContainer(element, options.direction);
        return true;
    }, [rememberFocus]);

    const focusFirst = useCallback((root = document) => {
        const rememberedId = routeFocusMemory.get(routeKeyRef.current);
        const remembered = rememberedId
            ? root.querySelector(`[data-focus-id="${escapeFocusId(rememberedId)}"]`)
            : null;
        if (remembered && isVisible(remembered)) {
            autofocusAppliedRef.current = true;
            return focusElement(remembered, { instant: true });
        }

        const preferred = root.querySelector('[data-tv-autofocus="true"]');
        if (preferred && isVisible(preferred)) {
            autofocusAppliedRef.current = true;
            return focusElement(preferred, { instant: true });
        }

        const first = focusablesIn(root)[0];
        return first ? focusElement(first, { instant: true }) : false;
    }, [focusElement]);

    const focusAdjacentGroup = useCallback((currentGroup, currentElement, direction) => {
        const groups = groupsInDocument();
        const currentGroupIndex = groups.indexOf(currentGroup);
        if (currentGroupIndex < 0) return false;

        const step = direction === 'down' ? 1 : -1;
        for (let index = currentGroupIndex + step; index >= 0 && index < groups.length; index += step) {
            const targetGroup = groups[index];
            const targetElements = focusablesIn(targetGroup);
            if (!targetElements.length) continue;

            const currentElements = focusablesIn(currentGroup);
            const currentFallback = Math.max(currentElements.indexOf(currentElement), 0);
            const currentLogical = logicalIndex(currentElement, currentFallback);
            const remembered = groupIndexMemory.get(groupKey(targetGroup));
            const targetLogical = Number.isFinite(remembered) ? remembered : currentLogical;
            const target = targetElements.reduce((best, candidate, candidateIndex) => {
                const candidateLogical = logicalIndex(candidate, candidateIndex);
                const bestLogical = logicalIndex(best, targetElements.indexOf(best));
                return Math.abs(candidateLogical - targetLogical) < Math.abs(bestLogical - targetLogical)
                    ? candidate
                    : best;
            }, targetElements[0]);

            return focusElement(target, { direction });
        }

        return false;
    }, [focusElement]);

    const moveFocus = useCallback((direction) => {
        const current = document.activeElement?.matches?.(SELECTOR) ? document.activeElement : null;
        if (!current) {
            focusFirst();
            return;
        }

        const currentGroup = current.closest(GROUP_SELECTOR);
        if (!currentGroup) {
            focusFirst();
            return;
        }

        const elements = focusablesIn(currentGroup);
        const domIndex = Math.max(elements.indexOf(current), 0);
        const axis = currentGroup.dataset.tvFocusAxis || 'horizontal';

        if (axis === 'grid') {
            const columns = gridColumnCount(currentGroup, elements);
            const delta = direction === 'left' ? -1
                : direction === 'right' ? 1
                    : direction === 'up' ? -columns
                        : columns;
            const nextIndex = domIndex + delta;
            const staysInGrid = nextIndex >= 0 && nextIndex < elements.length && (
                direction === 'up' || direction === 'down' ||
                Math.floor(domIndex / columns) === Math.floor(nextIndex / columns)
            );
            if (staysInGrid) {
                focusElement(elements[nextIndex], { direction });
                return;
            }
        } else if (direction === 'left' || direction === 'right') {
            const nextIndex = domIndex + (direction === 'right' ? 1 : -1);
            if (nextIndex >= 0 && nextIndex < elements.length) {
                focusElement(elements[nextIndex], { direction });
            }
            return;
        }

        if (direction === 'up' || direction === 'down') {
            focusAdjacentGroup(currentGroup, current, direction);
        }
    }, [focusAdjacentGroup, focusElement, focusFirst]);

    useEffect(() => {
        if (!enabled) return undefined;
        document.body.classList.add('noxis-tv-mode');

        const handleFocusIn = (event) => {
            if (event.target?.matches?.(SELECTOR)) rememberFocus(event.target);
        };

        const handleKeyDown = (event) => {
            const targetTag = document.activeElement?.tagName;
            const isTextInput = ['INPUT', 'TEXTAREA'].includes(targetTag);

            if (isBackKey(event) || (event.key === 'Backspace' && !isTextInput)) {
                hasUserNavigatedRef.current = true;
                event.preventDefault();
                if (onBack) onBack();
                else navigate(-1);
                return;
            }

            if ((isEnterKey(event) || event.key === ' ') && !isTextInput) {
                hasUserNavigatedRef.current = true;
                const active = document.activeElement;
                if (active?.matches?.(SELECTOR)) {
                    event.preventDefault();
                    active.click();
                }
                return;
            }

            const direction = getDirection(event);
            if (!direction) return;
            if (isTextInput && (direction === 'left' || direction === 'right')) return;

            hasUserNavigatedRef.current = true;
            event.preventDefault();
            moveFocus(direction);
        };

        const handlePointerDown = () => {
            hasUserNavigatedRef.current = true;
        };

        const initialFocus = window.setTimeout(() => focusFirst(), 70);
        window.addEventListener('focusin', handleFocusIn);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('pointerdown', handlePointerDown, true);
        return () => {
            window.clearTimeout(initialFocus);
            window.removeEventListener('focusin', handleFocusIn);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('pointerdown', handlePointerDown, true);
            document.body.classList.remove('noxis-tv-mode');
        };
    }, [enabled, focusFirst, moveFocus, navigate, onBack, rememberFocus]);

    useEffect(() => {
        if (!enabled) return undefined;

        hasUserNavigatedRef.current = false;
        autofocusAppliedRef.current = false;

        const focusWhenReady = () => {
            const active = document.activeElement;
            const preferred = document.querySelector('[data-tv-autofocus="true"]');
            if (!autofocusAppliedRef.current && !hasUserNavigatedRef.current && preferred && isVisible(preferred)) {
                autofocusAppliedRef.current = true;
                focusElement(preferred, { instant: true });
                return;
            }
            if (active?.matches?.(SELECTOR) && isVisible(active)) return;
            focusFirst(document);
        };

        const timer = window.setTimeout(focusWhenReady, 70);
        let frame = null;
        const observer = new MutationObserver(() => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = null;
                focusWhenReady();
            });
        });
        observer.observe(document.querySelector('.tv-web-content') || document.body, {
            childList: true,
            subtree: true
        });

        return () => {
            window.clearTimeout(timer);
            if (frame) window.cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [enabled, focusElement, focusFirst, routeKey]);

    return { focusFirst, focusElement };
};
