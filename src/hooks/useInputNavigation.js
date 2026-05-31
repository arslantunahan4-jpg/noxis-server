import { useEffect, useRef } from 'react';

const SoundManager = {
    ctx: null,
    lastHover: 0,
    lastSelect: 0,
    init: () => {
        if (!SoundManager.ctx) {
            SoundManager.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playHover: () => {
        const now = Date.now();
        if (now - SoundManager.lastHover < 50) return;
        SoundManager.lastHover = now;
        if (!SoundManager.ctx) SoundManager.init();
        if (SoundManager.ctx.state === 'suspended') SoundManager.ctx.resume().catch(() => {});
        const osc = SoundManager.ctx.createOscillator();
        const gain = SoundManager.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, SoundManager.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, SoundManager.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.02, SoundManager.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, SoundManager.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(SoundManager.ctx.destination);
        osc.start();
        osc.stop(SoundManager.ctx.currentTime + 0.1);
    },
    playSelect: () => {
        const now = Date.now();
        if (now - SoundManager.lastSelect < 100) return;
        SoundManager.lastSelect = now;
        if (!SoundManager.ctx) SoundManager.init();
        if (SoundManager.ctx.state === 'suspended') SoundManager.ctx.resume().catch(() => {});
        const osc = SoundManager.ctx.createOscillator();
        const gain = SoundManager.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, SoundManager.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, SoundManager.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.04, SoundManager.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, SoundManager.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(SoundManager.ctx.destination);
        osc.start();
        osc.stop(SoundManager.ctx.currentTime + 0.15);
    }
};

export const useSmartMouse = () => {
    const timerRef = useRef(null);
    const lastMoveRef = useRef(0);
    const isVisibleRef = useRef(true);

    useEffect(() => {
        const handleMouseMove = () => {
            const now = Date.now();
            if (now - lastMoveRef.current < 100) return;
            lastMoveRef.current = now;

            if (!isVisibleRef.current) {
                document.body.style.cursor = 'auto';
                isVisibleRef.current = true;
            }

            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                document.body.style.cursor = 'none';
                isVisibleRef.current = false;
            }, 3000);
        };

        const handleMouseOver = (e) => {
            const target = e.target.closest('.focusable');
            if (target && target !== document.activeElement) {
                target.focus({ preventScroll: true });
                SoundManager.playHover();
            }
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseover', handleMouseOver, { passive: true });

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseover', handleMouseOver);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);
};

export const useTVNavigation = (isModalOpen, isPlayerOpen) => {
    const lastFocus = useRef(null);

    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        const isTV = ua.includes('tv') || ua.includes('web0s') || ua.includes('tizen') || ua.includes('smart') || ua.includes('box');

        if (isTV) {
            document.body.classList.add('tv-mode');
            console.log('[App] TV Platform Detected:', ua);
        }

        const timeout = setTimeout(() => {
            if (isTV || (!document.activeElement || document.activeElement === document.body)) {
                const prioritySelect = isPlayerOpen ? '#video-frame' : isModalOpen ? '.detail-play-btn' : '.nav-btn.active, .nav-btn';
                const target = document.querySelector(prioritySelect) || document.querySelector('.focusable');
                if (target) {
                    target.focus();
                    lastFocus.current = target;
                }
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [isModalOpen, isPlayerOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const getDirection = (key, keyCode) => {
                if (['ArrowUp', 'Up'].includes(key) || keyCode === 38) return 'up';
                if (['ArrowDown', 'Down'].includes(key) || keyCode === 40) return 'down';
                if (['ArrowLeft', 'Left'].includes(key) || keyCode === 37) return 'left';
                if (['ArrowRight', 'Right'].includes(key) || keyCode === 39) return 'right';
                return null;
            };

            const direction = getDirection(e.key, e.keyCode);
            const activeTag = document.activeElement?.tagName;
            const isInInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);
            const backKeyCodes = [10009, 461, 27, 10182, 166];
            const isBackKey = ['Escape', 'Esc', 'XF86Back', 'BrowserBack'].includes(e.key) || backKeyCodes.includes(e.keyCode);

            if (isBackKey || (e.key === 'Backspace' && !isInInput)) {
                e.preventDefault();
                window.history.back();
                return;
            }

            if (activeTag === 'IFRAME') return;

            const enterKeyCodes = [13, 195];
            const isEnterKey = ['Enter', 'Select'].includes(e.key) || enterKeyCodes.includes(e.keyCode);

            if ((isEnterKey || e.key === ' ') && !isInInput) {
                if (document.activeElement?.classList.contains('focusable')) {
                    e.preventDefault();
                    SoundManager.playSelect();
                    document.activeElement.click();
                }
                return;
            }

            if (!direction) return;
            if (isInInput && (direction === 'left' || direction === 'right')) return;

            e.preventDefault();

            const scopeSelector = isPlayerOpen ? '#player-container .focusable' : isModalOpen ? '.detail-view-container .focusable' : '.focusable';
            const currentElement = document.activeElement;

            if (!currentElement || !currentElement.classList.contains('focusable')) {
                const first = document.querySelector(scopeSelector);
                if (first) first.focus();
                return;
            }

            const currentRect = currentElement.getBoundingClientRect();
            const allFocusables = Array.from(document.querySelectorAll(scopeSelector));
            const validFocusables = allFocusables.filter((el) => {
                if (!isPlayerOpen && !isModalOpen && (el.closest('.detail-view-container') || el.closest('#player-container'))) {
                    return false;
                }

                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            });

            let closest = null;
            let minDistance = Infinity;

            validFocusables.forEach((el) => {
                if (el === currentElement) return;
                const rect = el.getBoundingClientRect();
                let isCandidate = false;

                switch (direction) {
                    case 'right': {
                        if (rect.left >= currentRect.left) {
                            const vDiff = Math.abs((rect.top + rect.height / 2) - (currentRect.top + currentRect.height / 2));
                            if (vDiff < currentRect.height * 2) isCandidate = true;
                        }
                        break;
                    }
                    case 'left': {
                        if (rect.right <= currentRect.right) {
                            const vDiff = Math.abs((rect.top + rect.height / 2) - (currentRect.top + currentRect.height / 2));
                            if (vDiff < currentRect.height * 2) isCandidate = true;
                        }
                        break;
                    }
                    case 'down':
                        if (rect.top >= currentRect.top + (currentRect.height * 0.2)) isCandidate = true;
                        break;
                    case 'up':
                        if (rect.bottom <= currentRect.bottom - (currentRect.height * 0.2)) isCandidate = true;
                        break;
                }

                if (!isCandidate) return;

                const c1 = { x: currentRect.left + currentRect.width / 2, y: currentRect.top + currentRect.height / 2 };
                const c2 = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                const dist = direction === 'left' || direction === 'right'
                    ? Math.abs(c1.x - c2.x) + (Math.abs(c1.y - c2.y) * 4)
                    : Math.abs(c1.y - c2.y) + (Math.abs(c1.x - c2.x) * 4);

                if (dist < minDistance) {
                    minDistance = dist;
                    closest = el;
                }
            });

            if (!closest && direction === 'up' && !isPlayerOpen && !isModalOpen) {
                const navbarBtn = document.querySelector('.navbar-container .nav-btn.active') || document.querySelector('.navbar-container .nav-btn');
                if (navbarBtn && navbarBtn !== currentElement) {
                    const navRect = navbarBtn.getBoundingClientRect();
                    if (currentRect.top > navRect.bottom) {
                        closest = navbarBtn;
                    }
                }
            }

            if (closest) {
                if (closest !== lastFocus.current) {
                    SoundManager.playHover();
                    lastFocus.current = closest;
                }

                closest.focus();
                closest.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'start'
                });
            }
        };

        const recoveryInterval = setInterval(() => {
            const active = document.activeElement;
            if (!active || active === document.body) {
                if (isPlayerOpen) document.getElementById('video-frame')?.focus();
                else if (isModalOpen) document.querySelector('.detail-view-container .focusable')?.focus();
                else document.querySelector('.nav-btn.btn-active')?.focus();
            }
        }, 1000);

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearInterval(recoveryInterval);
        };
    }, [isModalOpen, isPlayerOpen]);
};

export const useGamepadNavigation = () => {
    const lastPress = useRef(0);
    const reqRef = useRef(null);

    useEffect(() => {
        const triggerKey = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        const scanGamepads = () => {
            const gp = (navigator.getGamepads ? navigator.getGamepads() : [])[0];
            if (gp) {
                const now = Date.now();
                if (now - lastPress.current > 150) {
                    if (gp.axes[1] < -0.5 || gp.buttons[12]?.pressed) {
                        triggerKey('ArrowUp');
                        lastPress.current = now;
                    } else if (gp.axes[1] > 0.5 || gp.buttons[13]?.pressed) {
                        triggerKey('ArrowDown');
                        lastPress.current = now;
                    } else if (gp.axes[0] < -0.5 || gp.buttons[14]?.pressed) {
                        triggerKey('ArrowLeft');
                        lastPress.current = now;
                    } else if (gp.axes[0] > 0.5 || gp.buttons[15]?.pressed) {
                        triggerKey('ArrowRight');
                        lastPress.current = now;
                    } else if (gp.buttons[0]?.pressed) {
                        if (document.activeElement) document.activeElement.click();
                        lastPress.current = now + 150;
                    } else if (gp.buttons[1]?.pressed) {
                        triggerKey('Escape');
                        lastPress.current = now + 150;
                    }
                }
            }
            reqRef.current = requestAnimationFrame(scanGamepads);
        };

        window.addEventListener('gamepadconnected', scanGamepads);
        scanGamepads();

        return () => {
            window.removeEventListener('gamepadconnected', scanGamepads);
            if (reqRef.current) cancelAnimationFrame(reqRef.current);
        };
    }, []);
};
