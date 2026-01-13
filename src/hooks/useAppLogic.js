import { useState, useEffect, useRef, useCallback } from 'react';

// --- CONFIG ---
const AUTH_TOKEN_KEY = 'noxis_auth_token';
const AUTH_USER_KEY = 'noxis_user';
const WATCHED_KEY = 'watched_items';
const CONTINUE_KEY = 'continue_watching';

import { supabase } from '../lib/supabase';

// --- SUPABASE SYNC UTILS ---
export const syncUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Sync Watched Items
    // Strategy: Fetch all from cloud, merge with local (cloud wins conflict, but usually additively)
    // For simplicity V1: Cloud overwrites local cache on pull, Local pushes to Cloud on action.
    const { data: watchedData } = await supabase.from('watched_items').select('movie_id, season, episode, created_at');
    if (watchedData) {
        const watchedMap = {};
        watchedData.forEach(item => {
            const key = item.season && item.episode ? `${item.movie_id}_s${item.season}e${item.episode}` : `${item.movie_id}`;
            watchedMap[key] = { timestamp: new Date(item.created_at).getTime(), season: item.season, episode: item.episode };
        });
        localStorage.setItem(WATCHED_KEY, JSON.stringify(watchedMap));
    }

    // 2. Sync Continue Watching
    const { data: continueData } = await supabase.from('continue_watching').select('*').order('updated_at', { ascending: false }).limit(20);
    if (continueData) {
        // Transform back to local format if needed or simply store.
        // Local format: array of objects.
        const items = continueData.map(item => ({
            id: Number(item.movie_id) || item.movie_id, // Ensure ID types match
            season: item.season,
            episode: item.episode,
            progress: item.progress,
            timestamp: new Date(item.updated_at).getTime(),
            ...item.metadata // Spread stored metadata
        }));
        localStorage.setItem(CONTINUE_KEY, JSON.stringify(items));
    }
};

// --- AUTH UTILS (SUPABASE) ---
export const authApi = {
    register: async (username, password) => {
        // Supabase requires email. mapping username to fake email for "username-like" experience or just asking user.
        // For now, assuming input is email or mapping `username@noxis.app`.
        // Let's assume user provides EMAIL. If existing UI asks for "kullanıcı adı", we might need to change UI or append domain.
        // Edit: App seems to use 'username'. We'll append a domain to make it an email.
        const email = username.includes('@') ? username : `${username}@noxis.app`;

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username }
            }
        });

        if (error) return { success: false, error: error.message };
        return { success: true, user: data.user };
    },
    login: async (username, password) => {
        const email = username.includes('@') ? username : `${username}@noxis.app`;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) return { success: false, error: 'Giriş başarısız. Bilgileri kontrol edin.' };

        // Trigger Sync
        await syncUserData();
        return { success: true, user: data.user, token: data.session?.access_token };
    },
    logout: async () => {
        await supabase.auth.signOut();
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        // Optional: clear user data? No, keep it for offline/guest feel or clear it.
        // Let's clear to ensure privacy on shared devices.
        localStorage.removeItem(WATCHED_KEY);
        localStorage.removeItem(CONTINUE_KEY);
    },
    getToken: () => localStorage.getItem(AUTH_TOKEN_KEY), // Not strictly needed for Supabase direct calls
    getUser: () => {
        // We can check supabase session, but for sync UI, local storage is faster.
        // Ideally we subscribe to auth state changes.
        try { return JSON.parse(localStorage.getItem(AUTH_USER_KEY)); }
        catch { return null; }
    },
    setSession: (token, user) => {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    },
    // isLoggedIn is checked via local storage presence for UI speed, verified by calls failing if token invalid
    isLoggedIn: () => !!localStorage.getItem(AUTH_TOKEN_KEY)
};

// --- API UTILS ---
import { fetchTMDB, CATEGORY_DEFINITIONS } from '../services/tmdb';
export { fetchTMDB, CATEGORY_DEFINITIONS };

// --- DATA UTILS (Hybrid: Local + Cloud) ---
export const getStorageData = (key) => { try { return JSON.parse(localStorage.getItem(key) || (key === CONTINUE_KEY ? '[]' : '{}')); } catch { return key === CONTINUE_KEY ? [] : {}; } };

export const markAsWatched = async (movieId, season = null, episode = null) => {
    // 1. Local Update (Instant)
    const watched = getStorageData(WATCHED_KEY);
    const key = season && episode ? `${movieId}_s${season}e${episode}` : `${movieId}`;
    watched[key] = { timestamp: Date.now(), season, episode };
    localStorage.setItem(WATCHED_KEY, JSON.stringify(watched));

    // 2. Cloud Update (Background)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        supabase.from('watched_items').upsert({
            user_id: user.id,
            movie_id: String(movieId),
            season,
            episode
        }, { onConflict: 'user_id, movie_id, season, episode' }).then(({ error }) => {
            if (error) console.error('Cloud save failed (watched)', error);
        });
    }
};

export const isWatched = (movieId, season = null, episode = null) => {
    const watched = getStorageData(WATCHED_KEY);
    return !!watched[season && episode ? `${movieId}_s${season}e${episode}` : `${movieId}`];
};

export const saveContinueWatching = async (movie, season = null, episode = null, progress = 0) => {
    // 1. Local Update
    const items = getStorageData(CONTINUE_KEY);
    const existing = items.findIndex(i => String(i.id) === String(movie.id) && i.season === season && i.episode === episode);

    // Metadata to save
    const metadata = {
        title: movie.title || movie.name,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path
    };

    const item = { ...movie, season, episode, progress, timestamp: Date.now() };
    if (existing >= 0) items[existing] = item; else items.unshift(item);
    localStorage.setItem(CONTINUE_KEY, JSON.stringify(items.slice(0, 20)));

    // 2. Cloud Update
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        supabase.from('continue_watching').upsert({
            user_id: user.id,
            movie_id: String(movie.id),
            season,
            episode,
            progress,
            metadata: metadata,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, movie_id, season, episode' }).then(({ error }) => {
            if (error) console.error('Cloud save failed (continue)', error);
        });
    }
};

// --- SOUND MANAGER ---
export const SoundManager = {
    ctx: null, lastHover: 0, lastSelect: 0,
    init: () => { if (!SoundManager.ctx) SoundManager.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    playHover: () => {
        const now = Date.now(); if (now - SoundManager.lastHover < 50) return;
        SoundManager.lastHover = now; if (!SoundManager.ctx) SoundManager.init();
        if (SoundManager.ctx.state === 'suspended') SoundManager.ctx.resume().catch(() => { });
        const osc = SoundManager.ctx.createOscillator(); const gain = SoundManager.ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(300, SoundManager.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, SoundManager.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.02, SoundManager.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, SoundManager.ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(SoundManager.ctx.destination); osc.start(); osc.stop(SoundManager.ctx.currentTime + 0.1);
    },
    playSelect: () => {
        const now = Date.now(); if (now - SoundManager.lastSelect < 100) return;
        SoundManager.lastSelect = now; if (!SoundManager.ctx) SoundManager.init();
        if (SoundManager.ctx.state === 'suspended') SoundManager.ctx.resume().catch(() => { });
        const osc = SoundManager.ctx.createOscillator(); const gain = SoundManager.ctx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(400, SoundManager.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, SoundManager.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.04, SoundManager.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, SoundManager.ctx.currentTime + 0.15);
        osc.connect(gain); gain.connect(SoundManager.ctx.destination); osc.start(); osc.stop(SoundManager.ctx.currentTime + 0.15);
    }
};

// --- DEVICE HOOKS ---
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

    // Initial Focus & TV Detection Logic
    useEffect(() => {
        // 1. Detect TV Platform
        const ua = navigator.userAgent.toLowerCase();
        const isTV = ua.includes('tv') || ua.includes('web0s') || ua.includes('tizen') || ua.includes('smart') || ua.includes('box');

        if (isTV) {
            document.body.classList.add('tv-mode');
            console.log('[App] TV Platform Detected:', ua);
        }

        // 2. Wait for DOM to be ready
        const timeout = setTimeout(() => {
            // Auto-focus logic only if we are in tv-mode or no mouse detected
            if (isTV || (!document.activeElement || document.activeElement === document.body)) {
                // Prioritize "Play" buttons or "Home" nav
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
            // 1. Map Keys
            const getDirection = (key, keyCode) => {
                if (['ArrowUp', 'Up'].includes(key) || keyCode === 38) return 'up';
                if (['ArrowDown', 'Down'].includes(key) || keyCode === 40) return 'down';
                if (['ArrowLeft', 'Left'].includes(key) || keyCode === 37) return 'left';
                if (['ArrowRight', 'Right'].includes(key) || keyCode === 39) return 'right';
                // WASD for testing if needed, or stick to arrows
                return null;
            };
            const direction = getDirection(e.key, e.keyCode);

            // 2. Handle Back/Enter generic logic
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

            // 3. Define Scope
            // If player open -> specific scope
            // If modal open -> specific scope
            // Else -> default scope (home)
            let scopeSelector = isPlayerOpen ? '#player-container .focusable' : isModalOpen ? '.detail-view-container .focusable' : '.focusable';

            // If nothing focused or body focused, try to recover
            let currentElement = document.activeElement;
            if (!currentElement || !currentElement.classList.contains('focusable')) {
                const first = document.querySelector(scopeSelector);
                if (first) first.focus();
                return;
            }

            // 4. Spatial Navigation Logic
            // Find best candidate in direction
            const currentRect = currentElement.getBoundingClientRect();
            const allFocusables = Array.from(document.querySelectorAll(scopeSelector));

            // Filter visible only
            const validFocusables = allFocusables.filter(el => {
                // Optimization: don't select elements in hidden containers if specific scopes aren't used correctly
                if (!isPlayerOpen && !isModalOpen && (el.closest('.detail-view-container') || el.closest('#player-container'))) return false;

                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            });

            let closest = null;
            let minDistance = Infinity;

            validFocusables.forEach(el => {
                if (el === currentElement) return;
                const rect = el.getBoundingClientRect();

                // Directional Check
                let isCandidate = false;
                switch (direction) {
                    case 'right':
                        // To the right AND roughly aligned vertically
                        if (rect.left >= currentRect.left) { // Relaxed check
                            const vDiff = Math.abs((rect.top + rect.height / 2) - (currentRect.top + currentRect.height / 2));
                            if (vDiff < currentRect.height * 2) isCandidate = true; // Within 2 row heights
                        }
                        break;
                    case 'left':
                        if (rect.right <= currentRect.right) {
                            const vDiff = Math.abs((rect.top + rect.height / 2) - (currentRect.top + currentRect.height / 2));
                            if (vDiff < currentRect.height * 2) isCandidate = true;
                        }
                        break;
                    case 'down':
                        if (rect.top >= currentRect.top + (currentRect.height * 0.2)) {
                            // Allow some horizontal drift but prefer aligned
                            isCandidate = true;
                        }
                        break;
                    case 'up':
                        if (rect.bottom <= currentRect.bottom - (currentRect.height * 0.2)) {
                            isCandidate = true;
                        }
                        break;
                }

                if (isCandidate) {
                    // Calculate distance
                    // Weight the primary axis more heavily to prefer "straight" moves
                    const c1 = { x: currentRect.left + currentRect.width / 2, y: currentRect.top + currentRect.height / 2 };
                    const c2 = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

                    let dist = 0;
                    if (direction === 'left' || direction === 'right') {
                        dist = Math.abs(c1.x - c2.x) + (Math.abs(c1.y - c2.y) * 4); // Penisalt vertical diff
                    } else {
                        dist = Math.abs(c1.y - c2.y) + (Math.abs(c1.x - c2.x) * 4); // Penalize horizontal diff
                    }

                    if (dist < minDistance) {
                        minDistance = dist;
                        closest = el;
                    }
                }
            });

            // Special Case: Jump to Navbar if UP and no candidate found
            if (!closest && direction === 'up' && !isPlayerOpen && !isModalOpen) {
                const navbarBtn = document.querySelector('.navbar-container .nav-btn.active') || document.querySelector('.navbar-container .nav-btn');
                if (navbarBtn && navbarBtn !== currentElement) {
                    const navRect = navbarBtn.getBoundingClientRect();
                    if (currentRect.top > navRect.bottom) {
                        closest = navbarBtn;
                    }
                }
            }

            // 5. Execution
            if (closest) {
                if (closest !== lastFocus.current) {
                    SoundManager.playHover();
                    lastFocus.current = closest;
                }
                closest.focus();

                // FIXED FOCUS LOGIC: "Content comes to us"
                // horizontal: scroll active item to start (left)
                // vertical: center
                closest.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'start' // <--- This aligns the item to the LEFT
                });
            }
        };

        const recoveryInterval = setInterval(() => {
            const active = document.activeElement;
            if (!active || active === document.body) {
                // Try to focus something relevant
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
                    if (gp.axes[1] < -0.5 || gp.buttons[12]?.pressed) { triggerKey('ArrowUp'); lastPress.current = now; }
                    else if (gp.axes[1] > 0.5 || gp.buttons[13]?.pressed) { triggerKey('ArrowDown'); lastPress.current = now; }
                    else if (gp.axes[0] < -0.5 || gp.buttons[14]?.pressed) { triggerKey('ArrowLeft'); lastPress.current = now; }
                    else if (gp.axes[0] > 0.5 || gp.buttons[15]?.pressed) { triggerKey('ArrowRight'); lastPress.current = now; }
                    else if (gp.buttons[0]?.pressed) { if (document.activeElement) document.activeElement.click(); lastPress.current = now + 150; }
                    else if (gp.buttons[1]?.pressed) { triggerKey('Escape'); lastPress.current = now + 150; }
                }
            }
            reqRef.current = requestAnimationFrame(scanGamepads);
        };
        window.addEventListener("gamepadconnected", scanGamepads);
        scanGamepads();
        return () => cancelAnimationFrame(reqRef.current);
    }, []);
};

