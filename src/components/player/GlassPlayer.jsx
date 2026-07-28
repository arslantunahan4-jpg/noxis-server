import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Hls from 'hls.js';
import { saveProgress, getProgress, forceSyncBeforeUnload } from '../../utils/watchHistory';
import { usePartySocket } from '../../hooks/usePartySocket';
import { useCasting } from '../../hooks/useCasting';
import { PartyModal } from './PartyModal';
import { VoiceChat } from './VoiceChat';
import {
    useThrottledCallback,
    usePlayerStyles,
    useOptimizedHlsConfig,
    useDeviceCapability,
    useOptimizedAnimations,
    useVisibilityOptimization,
    useMemoryPressure
} from '../../hooks/usePerformance';
import { isVidmodyOriginalAudio, isVidmodyTurkishAudio } from '../../utils/vidmody';
import { getApiBaseUrl } from '../../utils/apiBaseUrl';
import { getSubtitleMenuLabel, inferSubtitleProvider, optimizeSubtitleList } from '../../utils/subtitles';

// VPS veya Backend URL'si
const SERVER_URL = getApiBaseUrl();
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://ancient-math-1d1b.arslab.workers.dev';

// iOS Detection (cached at module level)
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const SOURCE_SUBTITLE_PROVIDERS = new Set(['kaynak', 'source', 'vidmody', 'streamimdb', 'diziyou', 'dizigom', 'dizimom']);

// Determine if a URL needs crossOrigin="anonymous" (only our own proxies guarantee CORS)
const needsCORS = (url) => {
    if (!url) return false;
    try {
        // Our worker and API server always send CORS headers
        if (url.includes(WORKER_URL)) return true;
        if (url.includes(SERVER_URL)) return true;
        // Same-origin is fine
        if (url.startsWith('/') || url.startsWith(window.location.origin)) return true;
        return false;
    } catch { return false; }
};

const getMasterStreamConfig = (url) => {
    try {
        const parsed = new URL(url, window.location.origin);
        return {
            isMaster: parsed.searchParams.get('mode') === 'master',
            isDual: parsed.searchParams.get('dual') === 'true',
            defaultAudio: parsed.searchParams.get('defaultAudio'),
            audioSwitchStrategy: parsed.searchParams.get('audioSwitchStrategy') || 'none'
        };
    } catch {
        return {
            isMaster: false,
            isDual: false,
            defaultAudio: null,
            audioSwitchStrategy: 'none'
        };
    }
};

const inferSubtitleSourceParamFromUrl = (url) => {
    const activeUrl = String(url || '').toLowerCase();
    if (!activeUrl) return null;

    try {
        const decodedUrl = decodeURIComponent(activeUrl);
        if (
            decodedUrl.includes('streamimdb') ||
            decodedUrl.includes('vaplayer') ||
            decodedUrl.includes('justhd.tv') ||
            decodedUrl.includes('onlinecoachingacademy') ||
            decodedUrl.includes('brightpathsignals') ||
            decodedUrl.includes('nextgencloudfabric')
        ) {
            return 'streamimdb';
        }
    } catch (e) {}

    if (
        activeUrl.includes('streamimdb') ||
        activeUrl.includes('vaplayer') ||
        activeUrl.includes('justhd.tv') ||
        activeUrl.includes('onlinecoachingacademy') ||
        activeUrl.includes('brightpathsignals') ||
        activeUrl.includes('nextgencloudfabric')
    ) {
        return 'streamimdb';
    }

    return null;
};

const shouldUseHlsForUrl = (url) => {
    const activeUrl = String(url || '').toLowerCase();
    if (!activeUrl) return false;

    return (
        activeUrl.includes('.m3u8') ||
        activeUrl.includes('.gif') ||
        activeUrl.includes('vidmody.com') ||
        activeUrl.includes('video-proxy') ||
        activeUrl.includes('vidmody-master') ||
        activeUrl.includes('mode=master') ||
        activeUrl.includes('diziyou') ||
        inferSubtitleSourceParamFromUrl(activeUrl) === 'streamimdb'
    );
};

const usesSourceAudioSwitch = (externalAudioTracks) => {
    if (!externalAudioTracks) return false;
    if (externalAudioTracks.switchStrategy === 'source') return true;
    return externalAudioTracks.provider === 'diziyou' || externalAudioTracks.provider === 'dizimom';
};

const unwrapNestedMediaUrl = (value) => {
    if (!value) return null;

    try {
        const parsed = new URL(value, window.location.origin);
        const wrappedUrl = parsed.searchParams.get('url');
        if (wrappedUrl) {
            return unwrapNestedMediaUrl(wrappedUrl);
        }

        return parsed.toString();
    } catch (e) {
        return String(value || '');
    }
};

const extractDiziyouVideoIdFromUrl = (...candidates) => {
    for (const candidate of candidates) {
        const resolved = unwrapNestedMediaUrl(candidate);
        if (!resolved) continue;

        const match = String(resolved).match(/storage\.diziyou\.one\/episodes\/(\d+)(?:_tr)?\/[^/?#]+\.m3u8(?:[?#].*)?$/i);
        if (match?.[1]) {
            return match[1];
        }
    }

    return null;
};

const buildDerivedDiziyouSubtitles = (videoId) => {
    if (!videoId) return [];

    return [
        {
            id: `diziyou-derived-tr-${videoId}`,
            lang: 'tr',
            provider: 'diziyou',
            label: 'Turkce (Diziyou)',
            url: `https://storage.diziyou.one/subtitles/${videoId}/tr.vtt`
        },
        {
            id: `diziyou-derived-en-${videoId}`,
            lang: 'en',
            provider: 'diziyou',
            label: 'English (Diziyou)',
            url: `https://storage.diziyou.one/subtitles/${videoId}/en.vtt`
        }
    ];
};

const KNOWN_SUBTITLE_FPS_RATIOS = [
    { label: '25/23.976', ratio: 25 / (24000 / 1001) },
    { label: '25/24', ratio: 25 / 24 },
    { label: '23.976/25', ratio: (24000 / 1001) / 25 },
    { label: '24/25', ratio: 24 / 25 }
];

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const roundTo = (value, precision = 1000) => Math.round(value * precision) / precision;

const medianNumber = (values = []) => {
    const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const isTurkishSubtitle = (subtitle = {}) => {
    const lang = String(subtitle.lang || subtitle.language || subtitle.srcLang || '').toLowerCase();
    return lang === 'tr' || lang === 'tur' || lang === 'turkish';
};

const getSubtitleStableKey = (subtitle = {}, index = 0) =>
    subtitle.url || subtitle.id || `${subtitle.lang || 'und'}:${subtitle.label || subtitle.name || index}`;

const getSubtitleCandidateStats = (cues = []) => {
    const cleanCues = cues
        .filter(cue => Number.isFinite(cue?.startTime) && Number.isFinite(cue?.endTime) && cue.endTime > cue.startTime)
        .slice()
        .sort((a, b) => a.startTime - b.startTime);

    if (cleanCues.length === 0) return null;

    const firstStart = cleanCues[0].startTime;
    const lastEnd = cleanCues.reduce((latest, cue) => Math.max(latest, cue.endTime), 0);
    const speechDuration = cleanCues.reduce((total, cue) => total + Math.max(0, cue.endTime - cue.startTime), 0);
    const quantiles = [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => {
        const index = Math.min(cleanCues.length - 1, Math.max(0, Math.round((cleanCues.length - 1) * q)));
        return cleanCues[index].startTime;
    });

    return {
        cueCount: cleanCues.length,
        firstStart,
        lastEnd,
        span: Math.max(0, lastEnd - firstStart),
        speechDuration,
        speechDensity: lastEnd > 0 ? speechDuration / lastEnd : 0,
        quantiles
    };
};

const findKnownSubtitleFpsRatio = (ratio) => {
    if (!Number.isFinite(ratio)) return null;

    return KNOWN_SUBTITLE_FPS_RATIOS
        .map(candidate => ({
            ...candidate,
            delta: Math.abs(candidate.ratio - ratio)
        }))
        .filter(candidate => candidate.delta <= 0.008)
        .sort((a, b) => a.delta - b.delta)[0] || null;
};

const buildAutoSubtitleSyncPlan = (stats, syncDuration) => {
    if (!stats || !Number.isFinite(syncDuration) || syncDuration <= 0 || stats.lastEnd <= 0) {
        return { scale: 1, offset: 0, mode: 'none', confidence: 0, ratio: 1, driftSeconds: 0 };
    }

    const ratio = syncDuration / stats.lastEnd;
    const driftSeconds = syncDuration - stats.lastEnd;
    const absoluteDrift = Math.abs(driftSeconds);
    const coverage = stats.lastEnd / syncDuration;
    const fpsMatch = findKnownSubtitleFpsRatio(ratio);

    if (
        fpsMatch &&
        coverage >= 0.88 &&
        coverage <= 1.12 &&
        absoluteDrift >= 20
    ) {
        return {
            scale: clampNumber(roundTo(ratio), 0.92, 1.08),
            offset: 0,
            mode: 'fps-scale',
            confidence: clampNumber(1 - (fpsMatch.delta / 0.008), 0.4, 0.98),
            ratio,
            driftSeconds,
            fpsLabel: fpsMatch.label
        };
    }

    return {
        scale: 1,
        offset: 0,
        mode: 'none',
        confidence: absoluteDrift <= 60 ? 0.55 : 0.2,
        ratio,
        driftSeconds,
        fpsLabel: null
    };
};

const getAdjustedQuantiles = (stats, plan) =>
    (stats?.quantiles || []).map(time => (time * (plan?.scale || 1)) + (plan?.offset || 0));

const getPlanFitMetrics = (stats, plan, syncDuration, consensusQuantiles = []) => {
    const adjustedQuantiles = getAdjustedQuantiles(stats, plan);
    const averageQuantileDelta = medianNumber(
        adjustedQuantiles.map((time, qIndex) => Math.abs(time - (consensusQuantiles[qIndex] || time)))
    );
    const adjustedFirstStart = (stats.firstStart * plan.scale) + plan.offset;
    const adjustedLastEnd = (stats.lastEnd * plan.scale) + plan.offset;
    const adjustedEndGap = syncDuration - adjustedLastEnd;

    return {
        adjustedFirstStart,
        adjustedLastEnd,
        adjustedEndGap,
        averageQuantileDelta
    };
};

const refineAutoSubtitleSyncPlan = (stats, basePlan, syncDuration, consensusQuantiles = []) => {
    if (!stats || !Number.isFinite(syncDuration) || syncDuration <= 0) {
        return basePlan || { scale: 1, offset: 0, mode: 'none', confidence: 0 };
    }

    const scale = Number.isFinite(basePlan?.scale) && basePlan.scale > 0 ? basePlan.scale : 1;
    const consensusOffset = medianNumber(
        (stats.quantiles || []).map((time, index) => {
            const target = consensusQuantiles[index];
            return Number.isFinite(target) ? target - (time * scale) : null;
        })
    );
    const endOffset = syncDuration - (stats.lastEnd * scale);
    const candidateOffsets = [
        basePlan?.offset || 0,
        Math.abs(consensusOffset) <= 180 ? consensusOffset : null,
        Math.abs(endOffset) <= 180 ? endOffset : null
    ].filter(Number.isFinite);

    const candidates = Array.from(new Set(candidateOffsets.map(offset => roundTo(offset, 10))))
        .map(offset => ({
            ...basePlan,
            scale,
            offset,
            mode: basePlan?.mode === 'none' && Math.abs(offset) >= 0.5 ? 'offset' : (basePlan?.mode || 'none')
        }));

    const ranked = candidates
        .map((plan) => {
            const metrics = getPlanFitMetrics(stats, plan, syncDuration, consensusQuantiles);
            const cost =
                (metrics.averageQuantileDelta * 1.35) +
                (Math.max(0, Math.abs(metrics.adjustedEndGap) - 180) * 0.08) +
                (Math.abs(plan.offset) * 0.1) +
                (metrics.adjustedFirstStart < -1 ? 30 : 0);

            return { plan, cost };
        })
        .sort((a, b) => a.cost - b.cost);

    return ranked[0]?.plan || basePlan;
};

const scoreSubtitleAnalyses = (analyses = [], syncDuration) => {
    if (analyses.length === 0) return [];

    const initialPlans = analyses.map(analysis => ({
        ...analysis,
        plan: buildAutoSubtitleSyncPlan(analysis.stats, syncDuration)
    }));
    const adjustedQuantiles = initialPlans.map(analysis => getAdjustedQuantiles(analysis.stats, analysis.plan));
    const consensusQuantiles = [0, 1, 2, 3, 4].map(index =>
        medianNumber(adjustedQuantiles.map(quantiles => quantiles[index]))
    );
    const medianCueCount = medianNumber(initialPlans.map(analysis => analysis.stats.cueCount));

    return initialPlans.map((analysis) => {
        const { subtitle, stats, index } = analysis;
        const plan = refineAutoSubtitleSyncPlan(stats, analysis.plan, syncDuration, consensusQuantiles);
        const provider = inferSubtitleProvider(subtitle);
        const coverage = stats.lastEnd / syncDuration;
        const { adjustedEndGap, averageQuantileDelta, adjustedFirstStart } = getPlanFitMetrics(stats, plan, syncDuration, consensusQuantiles);

        let score = 0;
        const reasons = [];

        if (isTurkishSubtitle(subtitle)) {
            score += 20;
            reasons.push('tr');
        }

        if (provider === 'streamimdb' || provider === 'source' || provider === 'kaynak') score += 16;
        else if (provider === 'stremio') score += 12;
        else if (provider === 'opensubtitles') score += 8;
        else score += 4;

        if (stats.cueCount >= 700 && stats.cueCount <= 2600) score += 18;
        else if (stats.cueCount >= 300 && stats.cueCount < 700) score += 8;
        else if (stats.cueCount > 2600 && stats.cueCount <= 3800) score += 6;
        else score -= 30;

        const cueCountDelta = medianCueCount > 0 ? Math.abs(stats.cueCount - medianCueCount) / medianCueCount : 0;
        if (cueCountDelta <= 0.12) score += 12;
        else if (cueCountDelta <= 0.28) score += 6;
        else score -= 8;

        if (coverage >= 0.88 && coverage <= 1.04) score += 14;
        else if (coverage >= 0.78 && coverage <= 1.12) score += 5;
        else score -= 20;

        if (plan.mode === 'fps-scale') {
            score += 24 + (plan.confidence * 8);
            reasons.push(`fps:${plan.fpsLabel}`);
        } else if (Math.abs(plan.driftSeconds) <= 75) {
            score += 10;
        } else {
            score -= 12;
        }

        if (Math.abs(adjustedEndGap) <= 180) score += 10;
        else if (Math.abs(adjustedEndGap) <= 420) score += 3;
        else score -= 8;

        if (averageQuantileDelta <= 5) score += 18;
        else if (averageQuantileDelta <= 20) score += 12;
        else if (averageQuantileDelta <= 60) score += 4;
        else score -= 10;

        if (stats.firstStart >= 0 && stats.firstStart <= 600) score += 6;
        else if (stats.firstStart > 900) score -= 8;

        if (adjustedFirstStart < -1) score -= 12;

        if (stats.speechDensity >= 0.08 && stats.speechDensity <= 0.38) score += 5;

        const stremioIndex = Number(subtitle.stremioIndex) || Number(String(subtitle.label || '').match(/stremio\s+(\d+)/i)?.[1]);
        if (Number.isFinite(stremioIndex) && stremioIndex > 0) {
            score += Math.max(0, 6 - stremioIndex) * 0.5;
        }

        return {
            ...analysis,
            score: roundTo(score, 10),
            reasons,
            diagnostics: {
                provider,
                coverage: roundTo(coverage),
                adjustedEndGap: roundTo(adjustedEndGap, 10),
                averageQuantileDelta: roundTo(averageQuantileDelta, 10),
                cueCount: stats.cueCount,
                scale: plan.scale,
                offset: plan.offset,
                mode: plan.mode,
                confidence: roundTo(plan.confidence || 0)
            },
            sortIndex: index
        };
    }).sort((a, b) =>
        b.score - a.score ||
        a.diagnostics.averageQuantileDelta - b.diagnostics.averageQuantileDelta ||
        Math.abs(a.diagnostics.adjustedEndGap) - Math.abs(b.diagnostics.adjustedEndGap) ||
        a.sortIndex - b.sortIndex
    );
};

const isReliableAutoSubtitleChoice = (candidate) => {
    if (!candidate) return false;

    const diagnostics = candidate.diagnostics || {};
    const quantileDelta = Number(diagnostics.averageQuantileDelta);
    const endGap = Math.abs(Number(diagnostics.adjustedEndGap));
    const offset = Math.abs(Number(diagnostics.offset || 0));
    const mode = diagnostics.mode;

    if (!Number.isFinite(candidate.score) || candidate.score < 80) return false;
    if (Number.isFinite(quantileDelta) && quantileDelta > 240) return false;
    if (Number.isFinite(endGap) && endGap > 360) return false;

    if (mode === 'none' && Number.isFinite(endGap) && endGap > 240) return false;
    if (mode === 'offset') {
        if (Number.isFinite(quantileDelta) && quantileDelta > 90) return false;
        if (Number.isFinite(endGap) && endGap > 240) return false;
        if (Number.isFinite(offset) && offset > 180) return false;
    }

    return true;
};

const isReliableAutoSyncPlan = (candidate) => {
    if (!candidate?.plan || !candidate?.diagnostics) return false;

    const { plan, diagnostics } = candidate;
    const quantileDelta = Number(diagnostics.averageQuantileDelta);
    const endGap = Math.abs(Number(diagnostics.adjustedEndGap));
    const offset = Math.abs(Number(diagnostics.offset || 0));

    if (plan.mode === 'fps-scale') {
        return (
            Number.isFinite(quantileDelta) &&
            Number.isFinite(endGap) &&
            quantileDelta <= 180 &&
            endGap <= 240
        );
    }

    if (plan.mode === 'offset') {
        return (
            Number.isFinite(quantileDelta) &&
            Number.isFinite(endGap) &&
            Number.isFinite(offset) &&
            quantileDelta <= 60 &&
            endGap <= 180 &&
            offset <= 90
        );
    }

    return false;
};

export const GlassPlayer = ({ streamUrl, subtitles = [], onClose, movieTitle, episodeTitle = null, imdbId, tmdbId, mediaType, season, episode, poster, backdrop, isEmbedded = false, externalVideoRef = null, partyInstance = null, onNextEpisode = null, nextEpisodeInfo = null, externalAudioTracks = null, onPlaybackError = null }) => {
    const styles = usePlayerStyles();
    const videoRef = externalVideoRef || useRef(null);
    const containerRef = useRef(null);
    const hlsRef = useRef(null);
    const controlsTimeout = useRef(null);
    const timeoutsRef = useRef([]); // Track active timeouts
    const lastTapRef = useRef(0);
    const initialPinchDistanceRef = useRef(null);
    const volumeSliderRef = useRef(null);
    const currentTimeRef = useRef(0);
    const isMounted = useRef(true);
    const seekTimeoutRef = useRef(null);
    const playTimeoutRef = useRef(null);
    const dragTimeRef = useRef(0);
    const iosRetryCountRef = useRef(0);
    const iosWatchdogRef = useRef(null);
    const playbackErrorNotifiedRef = useRef(false);
    const playbackFallbackTimerRef = useRef(null);
    const hlsManifestReadyRef = useRef(false);
    const pendingResumeTimeRef = useRef(null);
    const pendingAutoplayRef = useRef(null);
    const lastPlaybackKeyRef = useRef(null);
    const lastSavedSecondRef = useRef(-1);

    // PERFORMANCE: Cihaz ve animasyon optimizasyonu
    const deviceCapability = useDeviceCapability();
    const animConfig = useOptimizedAnimations();
    const hlsConfig = useOptimizedHlsConfig();
    const visibility = useVisibilityOptimization();
    const memory = useMemoryPressure();

    const [username, setUsername] = useState('Misafir');
    const [currentStreamUrl, setCurrentStreamUrl] = useState(streamUrl);
    const playbackErrorContextRef = useRef({ onPlaybackError, currentStreamUrl: streamUrl, streamUrl });
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [videoError, setVideoError] = useState(null);
    const [duration, setDuration] = useState(0);
    const [hlsPlaylistDuration, setHlsPlaylistDuration] = useState(0);
    const durationRef = useRef(0);
    const hlsPlaylistDurationRef = useRef(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [progress, setProgress] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showCenterPlay, setShowCenterPlay] = useState(false);
    const [showPlayButton, setShowPlayButton] = useState(false); // iOS autoplay fallback
    const [resizeMode, setResizeMode] = useState('contain');

    useEffect(() => {
        playbackErrorContextRef.current = { onPlaybackError, currentStreamUrl, streamUrl };
    }, [onPlaybackError, currentStreamUrl, streamUrl]);

    useEffect(() => {
        durationRef.current = duration;
    }, [duration]);

    useEffect(() => {
        hlsPlaylistDurationRef.current = hlsPlaylistDuration;
    }, [hlsPlaylistDuration]);

    const [audioTracks, setAudioTracks] = useState([]);
    const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
    const [currentAudio, setCurrentAudio] = useState('a1');
    const [isDualAudio, setIsDualAudio] = useState(false);
    const [isDiziyouDual, setIsDiziyouDual] = useState(false);
    const [diziyouOriginalUrl, setDiziyouOriginalUrl] = useState(null);
    const [showAudioMenu, setShowAudioMenu] = useState(false);

    const [qualityLevels, setQualityLevels] = useState([]);
    const [currentQuality, setCurrentQuality] = useState(-1);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    // Custom subtitle overlay for HLS streams
    const [subtitleCues, setSubtitleCues] = useState([]);
    const [baseSubtitleCues, setBaseSubtitleCues] = useState([]);
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const [fallbackSubtitles, setFallbackSubtitles] = useState([]);
    const subtitleCuesRef = useRef([]);
    const iosNativeTrackRef = useRef(null);
    const iosTrackElementRefs = useRef([]);
    const userSubtitleSelectionRef = useRef(false);
    const userSubtitleSyncRef = useRef(false);
    const autoSubtitleSyncKeyRef = useRef(null);
    const autoSubtitleSelectionKeyRef = useRef(null);
    const autoSubtitleSelectionRunningRef = useRef(null);
    const subtitleCueCacheRef = useRef(new Map());
    const activeSubIndexRef = useRef(-1);
    const derivedDiziyouSubtitles = useMemo(() => {
        const providerCandidates = [
            currentStreamUrl,
            streamUrl,
            externalAudioTracks?.original,
            externalAudioTracks?.dub
        ];
        const videoId = extractDiziyouVideoIdFromUrl(...providerCandidates);
        if (!videoId) return [];

        const existingDiziyouSubtitle = [...subtitles, ...fallbackSubtitles].some((subtitle) => {
            const provider = inferSubtitleProvider(subtitle);
            return provider === 'diziyou';
        });

        if (existingDiziyouSubtitle) {
            return [];
        }

        return buildDerivedDiziyouSubtitles(videoId);
    }, [currentStreamUrl, streamUrl, externalAudioTracks, subtitles, fallbackSubtitles]);

    const subtitleSourceList = useMemo(() => {
        const baseSubtitles = subtitles.length > 0 ? subtitles : fallbackSubtitles;
        const merged = [...baseSubtitles];
        const seenUrls = new Set(baseSubtitles.map((subtitle) => subtitle?.url).filter(Boolean));

        derivedDiziyouSubtitles.forEach((subtitle) => {
            if (!subtitle?.url || seenUrls.has(subtitle.url)) return;
            seenUrls.add(subtitle.url);
            merged.push(subtitle);
        });

        return merged;
    }, [subtitles, fallbackSubtitles, derivedDiziyouSubtitles]);

    const availableSubtitles = useMemo(
        () => optimizeSubtitleList(subtitleSourceList),
        [subtitleSourceList]
    );
    const turkishSubtitleCount = useMemo(
        () => availableSubtitles.filter(subtitle => subtitle?.url && isTurkishSubtitle(subtitle)).length,
        [availableSubtitles]
    );

    const [activeSubIndex, setActiveSubIndex] = useState(-1);
    const activeSubtitle = useMemo(
        () => (activeSubIndex === -1 ? null : availableSubtitles[activeSubIndex] || null),
        [activeSubIndex, availableSubtitles]
    );
    const subtitleSyncDuration = useMemo(() => {
        if (Number.isFinite(duration) && duration >= 1800) return duration;
        if (Number.isFinite(hlsPlaylistDuration) && hlsPlaylistDuration >= 1800) return hlsPlaylistDuration;
        return 0;
    }, [duration, hlsPlaylistDuration]);

    useEffect(() => {
        activeSubIndexRef.current = activeSubIndex;
    }, [activeSubIndex]);
    const [subtitleOffset, setSubtitleOffset] = useState(0);
    const [subtitleTimeScale, setSubtitleTimeScale] = useState(1);
    const [showSubMenu, setShowSubMenu] = useState(false);
    const [showSubtitleSyncTools, setShowSubtitleSyncTools] = useState(false);

    const getPlaybackSnapshot = useCallback(() => {
        const video = videoRef.current;
        const currentPlaybackTime = video?.currentTime || currentTimeRef.current || 0;
        const currentDuration = video?.duration || durationRef.current || hlsPlaylistDurationRef.current || 0;

        return {
            currentTime: currentPlaybackTime,
            duration: currentDuration,
            paused: video ? video.paused : true,
            readyState: video?.readyState || 0,
            hasStarted: currentPlaybackTime > 3
        };
    }, []);

    const preservePlaybackPosition = useCallback(() => {
        const snapshot = getPlaybackSnapshot();
        if (snapshot.currentTime > 0) {
            pendingResumeTimeRef.current = snapshot.currentTime;
            currentTimeRef.current = snapshot.currentTime;
        }
        return snapshot.currentTime;
    }, [getPlaybackSnapshot]);

    useEffect(() => {
        setSubtitleOffset(0);
        setSubtitleTimeScale(1);
        setShowSubtitleSyncTools(false);
        userSubtitleSyncRef.current = false;
        autoSubtitleSyncKeyRef.current = null;
        playbackErrorNotifiedRef.current = false;
        hlsManifestReadyRef.current = false;
        if (playbackFallbackTimerRef.current) {
            clearTimeout(playbackFallbackTimerRef.current);
            playbackFallbackTimerRef.current = null;
        }
    }, [currentStreamUrl]);

    const notifyPlaybackError = useCallback((reason, data = {}) => {
        if (playbackErrorNotifiedRef.current) return;
        playbackErrorNotifiedRef.current = true;
        const playbackSnapshot = getPlaybackSnapshot();
        const {
            onPlaybackError: latestOnPlaybackError,
            currentStreamUrl: latestCurrentStreamUrl,
            streamUrl: latestStreamUrl
        } = playbackErrorContextRef.current;
        if (typeof latestOnPlaybackError === 'function') {
            latestOnPlaybackError({
                reason,
                details: data?.details || null,
                url: latestCurrentStreamUrl || latestStreamUrl,
                ...playbackSnapshot
            });
        }
    }, [getPlaybackSnapshot]);

    const schedulePlaybackFallback = useCallback((reason, data = {}, delay = 8000) => {
        if (playbackErrorNotifiedRef.current || hlsManifestReadyRef.current) return;
        if (playbackFallbackTimerRef.current) return;
        if (getPlaybackSnapshot().hasStarted) return;

        playbackFallbackTimerRef.current = setTimeout(() => {
            playbackFallbackTimerRef.current = null;
            if (hlsManifestReadyRef.current) return;
            if (getPlaybackSnapshot().hasStarted) return;
            notifyPlaybackError(reason, data);
        }, delay);
    }, [getPlaybackSnapshot, notifyPlaybackError]);

    useEffect(() => {
        setHlsPlaylistDuration(0);
        autoSubtitleSelectionKeyRef.current = null;
        autoSubtitleSelectionRunningRef.current = null;
    }, [currentStreamUrl]);

    const [showPartyModal, setShowPartyModal] = useState(false);
    const [hoverProgress, setHoverProgress] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [isDraggingVolume, setIsDraggingVolume] = useState(false);
    const [isDraggingProgress, setIsDraggingProgress] = useState(false);
    const [hoverTime, setHoverTime] = useState(null);
    const [tooltipPos, setTooltipPos] = useState(0);
    const progressBarRef = useRef(null);
    const [seekAnimation, setSeekAnimation] = useState({ show: false, direction: null, seconds: 0 });
    const [showNextEpisode, setShowNextEpisode] = useState(false);

    const episodeCode = mediaType === 'tv' && season && episode
        ? `S${season}E${episode}`
        : null;
    const displayTitle = episodeCode
        ? `${movieTitle}:${episodeCode}${episodeTitle ? ` ${episodeTitle}` : ''}`
        : movieTitle;

    const HIDE_CONTROLS_DELAY = 3000;
    const NEXT_EPISODE_THRESHOLD = 180;

    useEffect(() => {
        setShowNextEpisode(false);
        setHlsPlaylistDuration(0);
    }, [streamUrl, season, episode]);

    useEffect(() => {
        const playbackKey = `${imdbId || 'unknown'}:${season || 0}:${episode || 0}`;

        if (lastPlaybackKeyRef.current && lastPlaybackKeyRef.current !== playbackKey) {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }

            if (videoRef.current) {
                try {
                    videoRef.current.pause();
                    videoRef.current.removeAttribute('src');
                    videoRef.current.load();
                } catch (e) {}
            }

            pendingResumeTimeRef.current = null;
            pendingAutoplayRef.current = null;
            currentTimeRef.current = 0;
            dragTimeRef.current = 0;
            setIsPlaying(false);
            setIsLoading(true);
            setShowPlayButton(false);
            setVideoError(null);
            setCurrentTime(0);
            setProgress(0);
            setDuration(0);
            setHlsPlaylistDuration(0);
            setBuffered(0);
            setHoverTime(null);
        }

        lastPlaybackKeyRef.current = playbackKey;
    }, [imdbId, season, episode]);

    const internalParty = usePartySocket(videoRef, imdbId, username);
    const party = partyInstance || internalParty;

    const casting = useCasting(videoRef);
    const API_URL = SERVER_URL;

    // Parse VTT subtitle file
    const parseVTT = (vttText) => {
        const cues = [];
        const lines = vttText.split('\n');
        let i = 0;

        while (i < lines.length) {
            const line = lines[i].trim();

            // Look for timestamp line (HH:MM:SS.mmm or MM:SS.mmm format)
            const timeMatch = line.match(/(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})/);
            if (timeMatch) {
                const startHours = parseInt(timeMatch[1] || 0);
                const startMins = parseInt(timeMatch[2]);
                const startSecs = parseInt(timeMatch[3]);
                const startMs = parseInt(timeMatch[4]);
                const endHours = parseInt(timeMatch[5] || 0);
                const endMins = parseInt(timeMatch[6]);
                const endSecs = parseInt(timeMatch[7]);
                const endMs = parseInt(timeMatch[8]);

                const startTime = startHours * 3600 + startMins * 60 + startSecs + startMs / 1000;
                const endTime = endHours * 3600 + endMins * 60 + endSecs + endMs / 1000;

                // Collect text lines until empty line
                let text = '';
                i++;
                while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
                    const textLine = lines[i].trim();
                    // Skip position/styling info
                    if (!textLine.startsWith('position:') && !textLine.startsWith('align:')) {
                        text += (text ? '\n' : '') + textLine;
                    }
                    i++;
                }

                if (text && !text.startsWith('NOTE')) {
                    cues.push({ startTime, endTime, text });
                }
                continue;
            }
            i++;
        }

        return cues;
    };

    const extractDirectBrowserSubtitleUrl = useCallback((subtitleInput) => {
        const subtitleUrl = typeof subtitleInput === 'string' ? subtitleInput : subtitleInput?.url;
        const provider = typeof subtitleInput === 'string' ? '' : inferSubtitleProvider(subtitleInput);
        if (!subtitleUrl) return null;

        const resolveCandidate = (value) => {
            if (!value) return null;

            try {
                const parsed = new URL(value, window.location.origin);
                const wrappedUrl = parsed.searchParams.get('url');
                if (wrappedUrl) {
                    return resolveCandidate(wrappedUrl);
                }

                const isDiziyouSubtitle = parsed.hostname === 'storage.diziyou.one'
                    && /\/subtitles\/\d+\/[a-z]{2}\.vtt$/i.test(parsed.pathname);
                return isDiziyouSubtitle ? parsed.toString() : null;
            } catch (e) {
                return null;
            }
        };

        return resolveCandidate(subtitleUrl);
    }, []);

    const resolveSubtitleFetchUrl = useCallback((subtitleInput) => {
        const subtitleUrl = typeof subtitleInput === 'string' ? subtitleInput : subtitleInput?.url;
        if (!subtitleUrl) return null;

        // CRITICAL: If this is a local offline video subtitle, do NOT proxy it through the remote server!
        // Load it directly so the Android WebView's local resource interceptor can serve it from device storage.
        if (subtitleUrl.includes('/local-video/')) {
            return subtitleUrl;
        }

        const directBrowserUrl = extractDirectBrowserSubtitleUrl(subtitleInput);
        if (directBrowserUrl) {
            return directBrowserUrl;
        }

        try {
            const parsed = new URL(subtitleUrl, window.location.origin);
            if (parsed.pathname.endsWith('/subtitle-proxy') || parsed.pathname.endsWith('/api/subtitle-proxy')) {
                return parsed.toString();
            }
        } catch (e) {}

        return `${API_URL}/api/subtitle-proxy?url=${encodeURIComponent(subtitleUrl)}`;
    }, [API_URL, extractDirectBrowserSubtitleUrl]);

    const resolveSubtitleTrackUrl = useCallback((subtitleInput, offset = 0) => {
        const resolvedUrl = resolveSubtitleFetchUrl(subtitleInput);
        if (!resolvedUrl) return '';

        if (extractDirectBrowserSubtitleUrl(subtitleInput) || extractDirectBrowserSubtitleUrl(resolvedUrl)) {
            return resolvedUrl;
        }

        try {
            const parsed = new URL(resolvedUrl, window.location.origin);
            parsed.searchParams.set('offset', offset.toString());
            return parsed.toString();
        } catch (e) {
            const separator = resolvedUrl.includes('?') ? '&' : '?';
            return `${resolvedUrl}${separator}offset=${encodeURIComponent(offset)}`;
        }
    }, [extractDirectBrowserSubtitleUrl, resolveSubtitleFetchUrl]);

    const clearTextTrackCues = (track) => {
        if (!track?.cues) return;
        Array.from(track.cues).forEach(cue => {
            try {
                track.removeCue(cue);
            } catch (e) {}
        });
    };

    const createNativeTextCue = (cue) => {
        const CueConstructor = window.VTTCue || window.TextTrackCue;
        if (!CueConstructor) return null;
        if (!Number.isFinite(cue.startTime) || !Number.isFinite(cue.endTime) || cue.endTime <= cue.startTime) return null;

        try {
            return new CueConstructor(Math.max(0, cue.startTime), Math.max(cue.startTime + 0.01, cue.endTime), cue.text);
        } catch (e) {
            return null;
        }
    };

    const syncIosNativeTrack = useCallback(() => {
        if (!IS_IOS || !videoRef.current) return;

        const video = videoRef.current;
        const trackElements = iosTrackElementRefs.current.filter(Boolean);
        const activeTrack = activeSubIndex !== -1 ? trackElements[activeSubIndex]?.track : null;
        iosNativeTrackRef.current = activeTrack || null;

        for (let i = 0; i < video.textTracks.length; i++) {
            const currentTrack = video.textTracks[i];
            if (currentTrack.kind === 'subtitles' || currentTrack.kind === 'captions') {
                currentTrack.mode = activeTrack && currentTrack === activeTrack ? 'showing' : 'disabled';
            }
        }
    }, [activeSubIndex, videoRef]);

    useEffect(() => {
        let cancelled = false;

        if (subtitles.length > 0) {
            setFallbackSubtitles([]);
            return undefined;
        }

        if (!imdbId) {
            setFallbackSubtitles([]);
            return undefined;
        }

        const params = new URLSearchParams({ imdb: imdbId });
        if (mediaType === 'tv' && season && episode) {
            params.set('season', season.toString());
            params.set('episode', episode.toString());
        }
        const subtitleSource = inferSubtitleSourceParamFromUrl(currentStreamUrl || streamUrl);
        if (subtitleSource) {
            params.set('source', subtitleSource);
        }

        const loadFallbackSubtitles = async () => {
            try {
                const response = await fetch(`${API_URL}/api/subtitles?${params.toString()}`);
                if (!response.ok) throw new Error('Subtitle request failed');

                const data = await response.json();
                if (!cancelled) {
                    setFallbackSubtitles(Array.isArray(data) ? data : []);
                }
            } catch (e) {
                if (!cancelled) {
                    setFallbackSubtitles([]);
                }
            }
        };

        loadFallbackSubtitles();

        return () => {
            cancelled = true;
        };
    }, [API_URL, imdbId, mediaType, season, episode, subtitles, currentStreamUrl, streamUrl]);

    // Load subtitles when active subtitle changes
    useEffect(() => {
        if (!activeSubtitle) {
            setBaseSubtitleCues([]);
            return;
        }

        const controller = new AbortController();

        const loadSubtitles = async () => {
            try {
                setBaseSubtitleCues([]);
                const subtitleKey = getSubtitleStableKey(activeSubtitle, activeSubIndex);
                const cached = subtitleCueCacheRef.current.get(subtitleKey);
                if (cached?.cues) {
                    setBaseSubtitleCues(cached.cues);
                    return;
                }

                const subtitleFetchUrl = resolveSubtitleFetchUrl(activeSubtitle);
                if (!subtitleFetchUrl) throw new Error('Failed to resolve subtitle URL');

                const response = await fetch(subtitleFetchUrl, { signal: controller.signal });
                if (!response.ok) throw new Error('Failed to fetch');
                const vttText = await response.text();
                const cues = parseVTT(vttText);
                const stats = getSubtitleCandidateStats(cues);
                subtitleCueCacheRef.current.set(subtitleKey, { cues, stats, fetchedAt: Date.now() });
                setBaseSubtitleCues(cues);
            } catch (e) {
                if (e.name === 'AbortError') return;
                console.warn('Failed to load subtitles:', e);
                setBaseSubtitleCues([]);
            }
        };

        loadSubtitles();

        return () => {
            controller.abort();
        };
    }, [activeSubtitle, activeSubIndex, resolveSubtitleFetchUrl]);

    useEffect(() => {
        if (!baseSubtitleCues || baseSubtitleCues.length < 20) return;
        if (!Number.isFinite(subtitleSyncDuration) || subtitleSyncDuration < 1800) return;
        if (activeSubIndex === -1 || userSubtitleSyncRef.current) return;

        const syncKey = `${currentStreamUrl || streamUrl || ''}|${activeSubtitle?.url || activeSubtitle?.id || activeSubIndex}|${Math.round(subtitleSyncDuration)}`;
        if (autoSubtitleSyncKeyRef.current === syncKey) return;
        autoSubtitleSyncKeyRef.current = syncKey;

        const lastCueEnd = baseSubtitleCues.reduce((latest, cue) => {
            const endTime = Number(cue?.endTime);
            return Number.isFinite(endTime) ? Math.max(latest, endTime) : latest;
        }, 0);
        if (!Number.isFinite(lastCueEnd) || lastCueEnd <= 0) return;

        const stats = getSubtitleCandidateStats(baseSubtitleCues);
        const plan = buildAutoSubtitleSyncPlan(stats, subtitleSyncDuration);

        if (plan.mode === 'fps-scale') {
            setSubtitleTimeScale(plan.scale);
            setSubtitleOffset(0);
        }
    }, [baseSubtitleCues, subtitleSyncDuration, activeSubIndex, activeSubtitle, currentStreamUrl, streamUrl]);

    // Apply subtitle offset and handle iOS native blob generation
    useEffect(() => {
        if (!baseSubtitleCues || baseSubtitleCues.length === 0) {
            setSubtitleCues([]);
            subtitleCuesRef.current = [];
            setCurrentSubtitle('');
            if (IS_IOS) {
                syncIosNativeTrack();
            }
            return;
        }

        const scale = Number.isFinite(subtitleTimeScale) && subtitleTimeScale > 0 ? subtitleTimeScale : 1;
        const adjustCueTime = (time) => Math.max(0, (time * scale) + subtitleOffset);
        const adjustedCues = baseSubtitleCues.map(c => {
            const startTime = adjustCueTime(c.startTime);
            const endTime = adjustCueTime(c.endTime);

            return {
                startTime,
                endTime: Math.max(startTime + 0.01, endTime),
                text: c.text
            };
        });

        setSubtitleCues(adjustedCues);
        subtitleCuesRef.current = adjustedCues;

        if (IS_IOS) {
            syncIosNativeTrack();
        }
    }, [baseSubtitleCues, subtitleOffset, subtitleTimeScale, syncIosNativeTrack]);

    // Keep the iOS native track in sync when the selected subtitle changes
    useEffect(() => {
        if (!IS_IOS) return;
        syncIosNativeTrack();
    }, [activeSubIndex, availableSubtitles, syncIosNativeTrack]);

    useEffect(() => {
        iosTrackElementRefs.current = iosTrackElementRefs.current.slice(0, availableSubtitles.length);
        if (IS_IOS) {
            const syncId = setTimeout(() => syncIosNativeTrack(), 0);
            timeoutsRef.current.push(syncId);
        }
    }, [availableSubtitles, subtitleOffset, syncIosNativeTrack]);

    useEffect(() => {
        if (!IS_IOS || !videoRef.current) return;

        const video = videoRef.current;
        const resyncTrack = () => {
            syncIosNativeTrack();
        };

        video.addEventListener('webkitbeginfullscreen', resyncTrack);
        video.addEventListener('webkitendfullscreen', resyncTrack);

        return () => {
            video.removeEventListener('webkitbeginfullscreen', resyncTrack);
            video.removeEventListener('webkitendfullscreen', resyncTrack);
        };
    }, [activeSubIndex, syncIosNativeTrack, videoRef]);

    // Update current subtitle based on video time
    useEffect(() => {
        if (subtitleCuesRef.current.length === 0) return;

        const updateSubtitle = () => {
            if (!videoRef.current) return;
            const time = videoRef.current.currentTime;

            const cue = subtitleCuesRef.current.find(
                c => time >= c.startTime && time <= c.endTime
            );

            if (cue) {
                // Keep clean HTML tags (<i>, <b>, <u>) intact, but strip proprietary SRT brackets and WebVTT class/style tags
                const formattedText = cue.text
                    .replace(/\{[^}]+\}/g, '')
                    .replace(/<c[^>]*>/gi, '')
                    .replace(/<\/c>/gi, '')
                    .replace(/<font[^>]*>/gi, '')
                    .replace(/<\/font>/gi, '')
                    .replace(/style="[^"]*"/gi, '')
                    .trim();
                setCurrentSubtitle(formattedText);
            } else {
                setCurrentSubtitle('');
            }
        };

        const video = videoRef.current;
        if (video) {
            video.addEventListener('timeupdate', updateSubtitle);
            return () => video.removeEventListener('timeupdate', updateSubtitle);
        }
    }, [subtitleCues]);


    // Auto-load media when casting connects
    useEffect(() => {
        if (casting.isCasting && casting.activeCastType === 'chromecast' && streamUrl) {
            const loadCastMedia = async () => {
                try {
                    const posterUrl = poster ? `https://image.tmdb.org/t/p/w500${poster}` : null;
                    await casting.chromecast.loadMedia(streamUrl, {
                        title: movieTitle || 'Video',
                        subtitle: mediaType === 'tv' && season && episode
                            ? `Sezon ${season} Bölüm ${episode}`
                            : '',
                        images: posterUrl ? [posterUrl] : [],
                        currentTime: videoRef.current?.currentTime || 0
                    });
                } catch (e) {
                    console.warn('Cast media load failed:', e);
                }
            };
            loadCastMedia();
        }
    }, [casting.isCasting, casting.activeCastType, streamUrl]);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
            if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
            if (iosWatchdogRef.current) { clearInterval(iosWatchdogRef.current); iosWatchdogRef.current = null; }
            document.body.classList.remove('player-fullscreen');
        };
    }, []);

    useEffect(() => {
        const activeStreamUrl = currentStreamUrl || streamUrl;
        const masterStream = getMasterStreamConfig(activeStreamUrl);
        const hasExternalTracks = externalAudioTracks && (externalAudioTracks.original || externalAudioTracks.dub);
        const isHlsTrackSwitch = masterStream.isMaster && masterStream.isDual && masterStream.audioSwitchStrategy === 'hls-track';
        const isSourceSwitch = hasExternalTracks && usesSourceAudioSwitch(externalAudioTracks);

        setIsDualAudio(isHlsTrackSwitch);
        setIsDiziyouDual(false);
        setDiziyouOriginalUrl(null);

        if (isHlsTrackSwitch) {
            setIsDualAudio(true);
            if (masterStream.defaultAudio) {
                setCurrentAudio(masterStream.defaultAudio);
            }
        }

        if (isSourceSwitch) {
            if (externalAudioTracks.original && externalAudioTracks.dub) {
                setIsDiziyouDual(true);
            }
            if (externalAudioTracks.original) {
                setDiziyouOriginalUrl(externalAudioTracks.original);
            }

            if (externalAudioTracks.dub && activeStreamUrl === externalAudioTracks.dub) {
                setCurrentAudio('tr');
            } else if (externalAudioTracks.original && activeStreamUrl === externalAudioTracks.original) {
                setCurrentAudio('original');
            } else if (externalAudioTracks.active === 'dub') {
                setCurrentAudio('tr');
            } else if (externalAudioTracks.active === 'original') {
                setCurrentAudio('original');
            } else if (activeStreamUrl.includes('_tr')) {
                setCurrentAudio('tr');
            } else {
                setCurrentAudio('original');
            }
            return;
        }

        if (activeStreamUrl.includes('diziyou.one') && activeStreamUrl.includes('_tr')) {
            const originalUrl = activeStreamUrl.replace(/_tr(\/|$)/g, '$1');
            setIsDiziyouDual(true);
            setDiziyouOriginalUrl(originalUrl);
            setCurrentAudio('tr');
        } else if (activeStreamUrl.includes('diziyou.one') && !activeStreamUrl.includes('_tr')) {
            if (externalAudioTracks?.dub) {
                setIsDiziyouDual(true);
            }
            setDiziyouOriginalUrl(activeStreamUrl);
            setCurrentAudio('original');
        }
    }, [currentStreamUrl, streamUrl, externalAudioTracks]);

    useEffect(() => {
        if (streamUrl && streamUrl !== currentStreamUrl) {
            setCurrentStreamUrl(streamUrl);
        }
    }, [streamUrl]);

    const buildProgressMetadata = useCallback(() => ({
        season,
        episode,
        title: movieTitle,
        poster_path: poster,
        backdrop_path: backdrop,
        tmdbId,
        mediaType
    }), [season, episode, movieTitle, poster, backdrop, tmdbId, mediaType]);

    const savePlaybackProgress = useCallback((timeOverride = null) => {
        const video = videoRef.current;
        const playbackTime = Number.isFinite(timeOverride)
            ? timeOverride
            : (video?.currentTime || currentTimeRef.current || 0);
        const totalDuration = video?.duration || duration || 0;

        if (!imdbId || !(playbackTime > 0) || !(totalDuration > 0)) return null;

        saveProgress(imdbId, playbackTime, totalDuration, buildProgressMetadata());
        currentTimeRef.current = playbackTime;
        return playbackTime;
    }, [imdbId, duration, buildProgressMetadata, videoRef]);

    const restorePlaybackPosition = useCallback((videoDuration = 0) => {
        if (!videoRef.current) return false;

        const pendingResumeTime = pendingResumeTimeRef.current;
        if (Number.isFinite(pendingResumeTime) && pendingResumeTime > 0) {
            videoRef.current.currentTime = pendingResumeTime;
            currentTimeRef.current = pendingResumeTime;
            pendingResumeTimeRef.current = null;
            return true;
        }

        if (!imdbId) return false;

        const saved = getProgress(imdbId, season, episode);
        if (!saved || saved.currentTime <= 0) return false;

        const maxDuration = videoDuration || videoRef.current.duration || 0;
        if (maxDuration > 0 && saved.currentTime >= maxDuration - 1) return false;

        videoRef.current.currentTime = saved.currentTime;
        currentTimeRef.current = saved.currentTime;
        return true;
    }, [imdbId, season, episode, videoRef]);

    // Volume Drag Logic
    const handleVolumeDragCore = useCallback((e) => {
        if (!volumeSliderRef.current) return;
        const rect = volumeSliderRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let newVolume = (clientX - rect.left) / rect.width;
        newVolume = Math.min(Math.max(newVolume, 0), 1);

        setVolume(newVolume);
        if (videoRef.current) videoRef.current.volume = newVolume;
        setIsMuted(newVolume === 0);
    }, []);
    const handleVolumeDrag = useThrottledCallback(handleVolumeDragCore, 32, [handleVolumeDragCore]);

    useEffect(() => {
        const onMouseUp = () => setIsDraggingVolume(false);
        const onMouseMove = (e) => { if (isDraggingVolume) handleVolumeDrag(e); };

        if (isDraggingVolume) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('touchmove', onMouseMove);
            window.addEventListener('touchend', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('touchend', onMouseUp);
        };
    }, [isDraggingVolume, handleVolumeDrag]);


    const switchQuality = (index) => {
        if (!hlsRef.current) return;
        hlsRef.current.currentLevel = index;
        setCurrentQuality(index);
        setShowQualityMenu(false);
    };

    const changeSpeed = (speed) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
        setPlaybackSpeed(speed);
        setShowQualityMenu(false);
    };

    const switchVidmodyAudio = (targetAudio) => {
        if (!hlsRef.current) return;
        const availableTracks = hlsRef.current.audioTracks || [];
        const matchedIndex = availableTracks.findIndex(track => (
            targetAudio === 'a1' ? isVidmodyTurkishAudio(track) : isVidmodyOriginalAudio(track)
        ));
        const fallbackIndex = targetAudio === 'a1' ? 0 : 1;
        const trackIndex = matchedIndex !== -1 ? matchedIndex : fallbackIndex;
        if (trackIndex < 0 || trackIndex >= availableTracks.length) return;

        hlsRef.current.audioTrack = trackIndex;
        setCurrentAudio(targetAudio);
        setShowAudioMenu(false);
    };

    const switchSourceAudio = (targetAudio) => {
        let newUrl = null;

        if (targetAudio === 'tr') {
            // Switch to Turkish dub
            if (externalAudioTracks?.dub) {
                newUrl = externalAudioTracks.dub;
            } else if (currentStreamUrl.includes('_tr')) {
                // Already on TR
                setShowAudioMenu(false);
                return;
            } else {
                // Construct TR URL
                newUrl = currentStreamUrl.replace(/\/play\.m3u8$/, '_tr/play.m3u8');
            }
        } else if (targetAudio === 'original') {
            // Switch to original
            if (externalAudioTracks?.original) {
                newUrl = externalAudioTracks.original;
            } else if (diziyouOriginalUrl) {
                newUrl = diziyouOriginalUrl;
            } else if (!currentStreamUrl.includes('_tr')) {
                // Already on original
                setShowAudioMenu(false);
                return;
            } else {
                // Remove _tr from URL
                newUrl = currentStreamUrl.replace(/_tr(\/|$)/g, '$1');
            }
        }

        if (!newUrl) {
            setShowAudioMenu(false);
            return;
        }

        const currentTime = videoRef.current?.currentTime || currentTimeRef.current || 0;
        pendingResumeTimeRef.current = currentTime > 0 ? currentTime : null;
        pendingAutoplayRef.current = videoRef.current ? !videoRef.current.paused : null;
        savePlaybackProgress(currentTime);

        // Notify parent if callback exists
        if (externalAudioTracks && externalAudioTracks.onChange) {
            const track = targetAudio === 'tr' ? 'dub' : 'original';
            externalAudioTracks.onChange(track);
        } else {
            setCurrentStreamUrl(newUrl);
        }

        setCurrentAudio(targetAudio);
        setShowAudioMenu(false);
    };

    useEffect(() => {
        const loadMediaInfo = async () => {
            try {
                const urlObj = new URL(streamUrl);
                const magnet = urlObj.searchParams.get('magnet');
                const season = urlObj.searchParams.get('season');
                const episode = urlObj.searchParams.get('episode');

                if (magnet) {
                    const res = await fetch(`${API_URL}/media-info?magnet=${encodeURIComponent(magnet)}&season=${season || ''}&episode=${episode || ''}`);
                    const data = await res.json();

                    if (isMounted.current && data.audioTracks && data.audioTracks.length > 1) {
                        setAudioTracks(data.audioTracks);
                    }
                }
            } catch (e) {
                console.warn('Failed to load media info:', e);
            }
        };
        loadMediaInfo();
    }, [streamUrl, API_URL]);

    useEffect(() => {
        return () => {
            if (savePlaybackProgress()) {
                forceSyncBeforeUnload();
            }
        };
    }, [savePlaybackProgress]);

    const switchAudio = (index) => {
        if (index === selectedAudioIndex) return;
        setSelectedAudioIndex(index);
        setShowAudioMenu(false);
        setIsLoading(true);

        const timeToSeek = videoRef.current ? videoRef.current.currentTime : 0;
        pendingResumeTimeRef.current = timeToSeek > 0 ? timeToSeek : null;
        pendingAutoplayRef.current = videoRef.current ? !videoRef.current.paused : null;
        savePlaybackProgress(timeToSeek);
        const urlObj = new URL(streamUrl);
        urlObj.searchParams.set('audioIndex', index);
        urlObj.searchParams.set('startTime', Math.floor(timeToSeek));

        const newUrl = urlObj.toString();
        setCurrentStreamUrl(newUrl);
    };

    const handleLoadedMetadata = () => {
        const mediaDuration = videoRef.current?.duration || 0;
        if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
            setDuration(mediaDuration);
        }
        restorePlaybackPosition();
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const adjustSubtitleOffset = (amount) => {
        userSubtitleSyncRef.current = true;
        setSubtitleOffset(prev => {
            const newVal = Math.round((prev + amount) * 10) / 10;
            return newVal;
        });
        handleInteraction();
    };

    const adjustSubtitleTimeScale = (amount) => {
        userSubtitleSyncRef.current = true;
        const videoTime = videoRef.current?.currentTime || 0;
        const currentScale = Number.isFinite(subtitleTimeScale) && subtitleTimeScale > 0 ? subtitleTimeScale : 1;
        const rawTimeAtCurrentPosition = (videoTime - subtitleOffset) / currentScale;
        const nextScale = Math.min(1.08, Math.max(0.92, Math.round((currentScale + amount) * 1000) / 1000));
        const nextOffset = Math.round((videoTime - (rawTimeAtCurrentPosition * nextScale)) * 10) / 10;

        setSubtitleTimeScale(nextScale);
        setSubtitleOffset(nextOffset);
        handleInteraction();
    };

    const resetSubtitleSync = () => {
        userSubtitleSyncRef.current = true;
        setSubtitleOffset(0);
        setSubtitleTimeScale(1);
        handleInteraction();
    };

    const handleInteraction = useCallback(() => {
        setShowControls(true);
        containerRef.current.style.cursor = 'auto';
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        if (videoRef.current && !videoRef.current.paused && !showVolumeSlider) {
            controlsTimeout.current = setTimeout(() => {
                if (containerRef.current) {
                    setShowControls(false);
                    setShowSubMenu(false);
                    containerRef.current.style.cursor = 'none';
                }
            }, HIDE_CONTROLS_DELAY);
        }
    }, [showVolumeSlider]);

    const togglePlay = useCallback((e) => {
        if (e) e.stopPropagation();
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play().then(() => {
                    party.broadcastState(true);
                }).catch(console.error);
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                party.broadcastState(true);
                setIsPlaying(false);
            }
            setShowCenterPlay(true);

            if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
            playTimeoutRef.current = setTimeout(() => {
                if (isMounted.current) setShowCenterPlay(false);
            }, 600);

            handleInteraction();
        }
    }, [handleInteraction, party]);

    const handleProgressDragCore = useCallback((e) => {
        if (!progressBarRef.current || !duration) return;

        const rect = progressBarRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let percentage = (clientX - rect.left) / rect.width;
        percentage = Math.min(Math.max(percentage, 0), 1);

        const newTime = percentage * duration;
        dragTimeRef.current = newTime;
        setProgress(percentage * 100);
        setCurrentTime(newTime);
        setHoverTime(newTime);
        setTooltipPos(percentage * 100);
    }, [duration]);
    const handleProgressDrag = useThrottledCallback(handleProgressDragCore, 32, [handleProgressDragCore]);

    const startProgressDrag = (e) => {
        setIsDraggingProgress(true);
        handleProgressDrag(e);
    };

    const stopProgressDrag = useCallback(() => {
        if (isDraggingProgress && videoRef.current) {
            setIsDraggingProgress(false);
            videoRef.current.currentTime = dragTimeRef.current;
            party.broadcastState(true);
        }
    }, [isDraggingProgress, party]);

    useEffect(() => {
        const onMouseUp = () => stopProgressDrag();
        const onMouseMove = (e) => { if (isDraggingProgress) handleProgressDrag(e); };

        if (isDraggingProgress) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('touchmove', onMouseMove, { passive: false });
            window.addEventListener('touchend', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('touchend', onMouseUp);
        };
    }, [isDraggingProgress, handleProgressDrag, stopProgressDrag]);

    const handleProgressHover = (e) => {
        if (isDraggingProgress || !progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let percentage = (clientX - rect.left) / rect.width;
        percentage = Math.min(Math.max(percentage, 0), 1);

        setHoverTime(percentage * duration);
        setTooltipPos(percentage * 100);
    };

    const [hlsSubtitleTracks, setHlsSubtitleTracks] = useState([]);
    const [selectedHlsSub, setSelectedHlsSub] = useState(-1);

    const getSubtitleSourceName = useCallback(() => {
        const activeUrl = String(currentStreamUrl || streamUrl || '').toLowerCase();

        try {
            const decodedUrl = decodeURIComponent(activeUrl);
            if (decodedUrl.includes('diziyou')) return 'Diziyou';
            if (decodedUrl.includes('dizimom')) return 'Dizimom';
            if (decodedUrl.includes('vidmody')) return 'Vidmody';
            if (
                decodedUrl.includes('streamimdb') ||
                decodedUrl.includes('vaplayer') ||
                decodedUrl.includes('justhd.tv') ||
                decodedUrl.includes('onlinecoachingacademy') ||
                decodedUrl.includes('brightpathsignals') ||
                decodedUrl.includes('nextgencloudfabric')
            ) return 'StreamIMDb';
        } catch (e) {}

        if (activeUrl.includes('diziyou')) return 'Diziyou';
        if (activeUrl.includes('dizimom')) return 'Dizimom';
        if (activeUrl.includes('vidmody')) return 'Vidmody';
        if (
            activeUrl.includes('streamimdb') ||
            activeUrl.includes('vaplayer') ||
            activeUrl.includes('justhd.tv') ||
            activeUrl.includes('onlinecoachingacademy') ||
            activeUrl.includes('brightpathsignals') ||
            activeUrl.includes('nextgencloudfabric')
        ) return 'StreamIMDb';
        return 'Kaynak';
    }, [currentStreamUrl, streamUrl]);

    const disableNativeSubtitleTracks = useCallback(() => {
        if (!videoRef.current?.textTracks) return;

        const tracks = videoRef.current.textTracks;
        for (let i = 0; i < tracks.length; i++) {
            tracks[i].mode = 'disabled';
        }
    }, [videoRef]);

    const disableHlsSubtitles = useCallback(() => {
        if (!hlsRef.current) return;

        try {
            hlsRef.current.subtitleTrack = -1;
            if ('subtitleDisplay' in hlsRef.current) {
                hlsRef.current.subtitleDisplay = false;
            }
        } catch (e) {}
    }, []);

    const clearCustomSubtitleOverlay = useCallback(() => {
        subtitleCuesRef.current = [];
        setBaseSubtitleCues([]);
        setSubtitleCues([]);
        setCurrentSubtitle('');
    }, []);

    const getPreferredSubtitleIndex = useCallback((items = []) => {
        const trIndex = items.findIndex(item => item?.lang === 'tr' || item?.lang === 'tur');
        if (trIndex !== -1) return trIndex;
        const engIndex = items.findIndex(item => item?.lang === 'eng' || item?.lang === 'en');
        if (engIndex !== -1) return engIndex;
        return items.length > 0 ? 0 : -1;
    }, []);

    const getPreferredHlsSubtitleIndex = useCallback((items = []) => {
        const trIndex = items.findIndex(item => {
            const lang = (item?.lang || '').toLowerCase();
            const name = (item?.name || '').toLowerCase();
            return lang === 'tr' || lang === 'tur' || name.includes('turk') || name.includes('türk');
        });
        if (trIndex !== -1) return trIndex;
        const engIndex = items.findIndex(item => {
            const lang = (item?.lang || '').toLowerCase();
            const name = (item?.name || '').toLowerCase();
            return lang === 'en' || lang === 'eng' || name.includes('english');
        });
        if (engIndex !== -1) return engIndex;
        return items.length > 0 ? 0 : -1;
    }, []);

    const switchSubtitle = (index, userInitiated = true) => {
        if (userInitiated) {
            userSubtitleSelectionRef.current = true;
            userSubtitleSyncRef.current = false;
            autoSubtitleSyncKeyRef.current = null;
            setSubtitleOffset(0);
            setSubtitleTimeScale(1);
        }

        disableHlsSubtitles();
        setSelectedHlsSub(-1);
        disableNativeSubtitleTracks();
        setCurrentSubtitle('');
        setActiveSubIndex(index);
        setShowSubMenu(false);
    };

    const switchHlsSubtitle = (index, userInitiated = true) => {
        if (!hlsRef.current) return;
        if (userInitiated) {
            userSubtitleSelectionRef.current = true;
            userSubtitleSyncRef.current = false;
            autoSubtitleSyncKeyRef.current = null;
            setSubtitleOffset(0);
            setSubtitleTimeScale(1);
        }

        clearCustomSubtitleOverlay();
        disableNativeSubtitleTracks();
        setActiveSubIndex(-1);

        if ('subtitleDisplay' in hlsRef.current) {
            hlsRef.current.subtitleDisplay = index !== -1;
        }
        hlsRef.current.subtitleTrack = index;
        setSelectedHlsSub(index);
        setShowSubMenu(false);
    };

    useEffect(() => {
        userSubtitleSelectionRef.current = false;
        setActiveSubIndex(-1);
        setSelectedHlsSub(-1);
        clearCustomSubtitleOverlay();
        disableHlsSubtitles();
        disableNativeSubtitleTracks();
    }, [currentStreamUrl, clearCustomSubtitleOverlay, disableHlsSubtitles, disableNativeSubtitleTracks]);

    useEffect(() => {
        if (activeSubIndex !== -1) {
            disableHlsSubtitles();
            disableNativeSubtitleTracks();
        }
    }, [activeSubIndex, disableHlsSubtitles, disableNativeSubtitleTracks]);

    useEffect(() => {
        if (userSubtitleSelectionRef.current) return;

        if (availableSubtitles.length > 0) {
            const subtitleSource = inferSubtitleSourceParamFromUrl(currentStreamUrl || streamUrl);
            const shouldWaitForAutoScore = activeSubIndex === -1
                && turkishSubtitleCount > 1
                && (subtitleSource === 'streamimdb' || subtitleSyncDuration >= 1800);

            if (shouldWaitForAutoScore) return;

            const preferredSubtitleIndex = getPreferredSubtitleIndex(availableSubtitles);
            const needsInitialSubtitle = activeSubIndex === -1 || activeSubIndex >= availableSubtitles.length;
            if (preferredSubtitleIndex !== -1 && needsInitialSubtitle) {
                switchSubtitle(preferredSubtitleIndex, false);
            }
            return;
        }

        if (hlsSubtitleTracks.length > 0 && hlsRef.current) {
            const preferredHlsIndex = getPreferredHlsSubtitleIndex(hlsSubtitleTracks);
            if (preferredHlsIndex !== -1 && selectedHlsSub !== preferredHlsIndex) {
                switchHlsSubtitle(preferredHlsIndex, false);
            }
            return;
        }

        if (activeSubIndex !== -1) {
            setActiveSubIndex(-1);
        }
    }, [
        availableSubtitles,
        hlsSubtitleTracks,
        activeSubIndex,
        selectedHlsSub,
        turkishSubtitleCount,
        subtitleSyncDuration,
        currentStreamUrl,
        streamUrl,
        getPreferredSubtitleIndex,
        getPreferredHlsSubtitleIndex
    ]);

    useEffect(() => {
        if (userSubtitleSelectionRef.current) return;
        if (!Number.isFinite(subtitleSyncDuration) || subtitleSyncDuration < 1800) return;

        const turkishCandidates = availableSubtitles
            .map((subtitle, index) => ({ subtitle, index }))
            .filter(({ subtitle }) => subtitle?.url && isTurkishSubtitle(subtitle))
            .slice(0, 8);

        if (turkishCandidates.length < 2) return;

        const selectionKey = [
            currentStreamUrl || streamUrl || '',
            Math.round(subtitleSyncDuration),
            ...turkishCandidates.map(({ subtitle, index }) => getSubtitleStableKey(subtitle, index))
        ].join('|');

        if (autoSubtitleSelectionKeyRef.current === selectionKey) return;
        if (autoSubtitleSelectionRunningRef.current === selectionKey) return;
        autoSubtitleSelectionRunningRef.current = selectionKey;

        let cancelled = false;
        const controller = new AbortController();

        const analyzeCandidate = async ({ subtitle, index }) => {
            const subtitleKey = getSubtitleStableKey(subtitle, index);
            const cached = subtitleCueCacheRef.current.get(subtitleKey);

            if (cached?.cues || cached?.stats) {
                const stats = cached.stats || getSubtitleCandidateStats(cached.cues);
                if (!stats || stats.cueCount < 20) return null;
                const plan = buildAutoSubtitleSyncPlan(stats, subtitleSyncDuration);
                subtitleCueCacheRef.current.set(subtitleKey, {
                    ...cached,
                    stats,
                    plan,
                    fetchedAt: cached.fetchedAt || Date.now()
                });

                return {
                    subtitle,
                    index,
                    key: subtitleKey,
                    stats,
                    plan
                };
            }

            const subtitleFetchUrl = resolveSubtitleFetchUrl(subtitle);
            if (!subtitleFetchUrl) return null;

            const response = await fetch(subtitleFetchUrl, { signal: controller.signal });
            if (!response.ok) return null;

            const vttText = await response.text();
            const cues = parseVTT(vttText);
            const stats = getSubtitleCandidateStats(cues);
            if (!stats || stats.cueCount < 20) return null;

            const plan = buildAutoSubtitleSyncPlan(stats, subtitleSyncDuration);
            subtitleCueCacheRef.current.set(subtitleKey, {
                cues,
                stats,
                plan,
                fetchedAt: Date.now()
            });

            return { subtitle, index, key: subtitleKey, stats, plan };
        };

        const scoreCandidates = async () => {
            try {
                const analyses = (await Promise.all(turkishCandidates.map(analyzeCandidate))).filter(Boolean);
                const selectFallbackSubtitle = () => {
                    if (activeSubIndex !== -1 || userSubtitleSelectionRef.current) return;
                    const preferredSubtitleIndex = getPreferredSubtitleIndex(availableSubtitles);
                    if (preferredSubtitleIndex !== -1) {
                        switchSubtitle(preferredSubtitleIndex, false);
                    }
                };

                if (cancelled || userSubtitleSelectionRef.current) return;
                if (analyses.length === 0) {
                    autoSubtitleSelectionKeyRef.current = selectionKey;
                    selectFallbackSubtitle();
                    return;
                }

                const ranked = scoreSubtitleAnalyses(analyses, subtitleSyncDuration);
                const best = ranked[0];
                if (!isReliableAutoSubtitleChoice(best)) {
                    autoSubtitleSelectionKeyRef.current = selectionKey;
                    selectFallbackSubtitle();
                    return;
                }

                autoSubtitleSelectionKeyRef.current = selectionKey;

                const current = ranked.find(candidate => candidate.index === activeSubIndex);
                const currentIsTurkish = activeSubIndex >= 0 && isTurkishSubtitle(availableSubtitles[activeSubIndex]);
                const shouldSwitch = best.index !== activeSubIndex && (
                    !currentIsTurkish ||
                    !current ||
                    best.score - current.score >= 4
                );

                if (shouldSwitch) {
                    if (!userSubtitleSyncRef.current && isReliableAutoSyncPlan(best)) {
                        setSubtitleTimeScale(best.plan.scale);
                        setSubtitleOffset(best.plan.offset);
                    }
                    switchSubtitle(best.index, false);
                    return;
                }

                if (!userSubtitleSyncRef.current && best.index === activeSubIndex && isReliableAutoSyncPlan(best)) {
                    setSubtitleTimeScale(best.plan.scale);
                    setSubtitleOffset(best.plan.offset);
                }
            } catch (e) {
                if (!cancelled && e?.name !== 'AbortError') {
                    console.warn('[Subtitle AutoScore] Failed:', e);
                }
            } finally {
                if (autoSubtitleSelectionRunningRef.current === selectionKey) {
                    autoSubtitleSelectionRunningRef.current = null;
                }
            }
        };

        scoreCandidates();

        return () => {
            cancelled = true;
            controller.abort();
            if (autoSubtitleSelectionRunningRef.current === selectionKey) {
                autoSubtitleSelectionRunningRef.current = null;
            }
        };
    }, [availableSubtitles, subtitleSyncDuration, currentStreamUrl, streamUrl, activeSubIndex, resolveSubtitleFetchUrl]);

    const hasSourceSubtitleOption = availableSubtitles.some((subtitle) =>
        SOURCE_SUBTITLE_PROVIDERS.has(inferSubtitleProvider(subtitle))
    );

    const visibleHlsSubtitleTracks = (() => {
        if (hasSourceSubtitleOption) return [];

        const indexedTracks = hlsSubtitleTracks.map((track, index) => ({ ...track, trackIndex: index }));
        const grouped = new Map();

        indexedTracks.forEach((track) => {
            const lang = String(track?.lang || '').toLowerCase();
            const name = String(track?.name || '').toLowerCase();
            const key = lang || name || `track-${track.trackIndex}`;
            if (!grouped.has(key)) {
                grouped.set(key, track);
            }
        });

        const ordered = Array.from(grouped.values());
        ordered.sort((a, b) => {
            const aLang = String(a?.lang || '').toLowerCase();
            const bLang = String(b?.lang || '').toLowerCase();
            const getRank = (lang) => (lang === 'tr' || lang === 'tur' ? 0 : lang === 'en' || lang === 'eng' ? 1 : 2);
            return getRank(aLang) - getRank(bLang);
        });

        return ordered;
    })();
    const subtitleScalePercent = ((subtitleTimeScale - 1) * 100).toFixed(1).replace('.0', '');

    // PERFORMANCE: onTimeUpdate'i throttle et - saniyede 4 kez çalışır (60fps yerine)
    // Bu değişiklik CPU kullanımını %85 azaltır
    const onTimeUpdateCore = useCallback(() => {
        if (!visibility.isVisible && !IS_IOS) return; // Skip heavy UI updates if hidden and not iOS
        if (!videoRef.current) return;
        const vid = videoRef.current;
        currentTimeRef.current = vid.currentTime;

        // Party sync - sadece host için
        if (party.isHost && !vid.paused) {
            party.broadcastState(false);
        }

        // İlerleme kaydetme - her 10 saniyede bir (tekrarsız)
        const second = Math.floor(vid.currentTime);
        if (imdbId && second > 0 && vid.duration > 0 && second % 10 === 0 && second !== lastSavedSecondRef.current) {
            lastSavedSecondRef.current = second;
            saveProgress(imdbId, vid.currentTime, vid.duration, {
                season, episode, title: movieTitle, poster_path: poster, backdrop_path: backdrop,
                tmdbId, mediaType
            });
        }

        // State güncellemeleri - batch olarak
        if (!isDraggingProgress) {
            setCurrentTime(vid.currentTime);
            setProgress((vid.currentTime / vid.duration) * 100 || 0);
        }
        setDuration(vid.duration || 0);

        if (onNextEpisode && nextEpisodeInfo && mediaType === 'tv' && vid.duration > 0) {
            const remainingTime = vid.duration - vid.currentTime;
            const watchedRatio = vid.duration > 0 ? vid.currentTime / vid.duration : 0;
            setShowNextEpisode(
                (remainingTime <= NEXT_EPISODE_THRESHOLD && remainingTime > 0) ||
                watchedRatio >= 0.92
            );
        }

        // Buffer hesaplama - sadece gerektiğinde
        if (vid.buffered.length > 0) {
            for (let i = 0; i < vid.buffered.length; i++) {
                if (vid.buffered.start(i) <= vid.currentTime && vid.buffered.end(i) >= vid.currentTime) {
                    setBuffered((vid.buffered.end(i) / vid.duration) * 100);
                    break;
                }
            }
        }
    }, [party, imdbId, season, episode, movieTitle, poster, backdrop, tmdbId, mediaType, onNextEpisode, nextEpisodeInfo, isDraggingProgress]);

    const handlePlaybackEnded = useCallback(() => {
        // Trigger Smart Downloads bridge call when offline episode completes
        if (streamUrl && (streamUrl.includes('/local-video/') || streamUrl.startsWith('https://noxis.tech/local-video/'))) {
            const match = streamUrl.match(/\/local-video\/(\d+)/);
            const taskId = match ? match[1] : null;
            if (taskId) {
                console.log("[GlassPlayer] Offline video playback ended. Triggering onEpisodeFinished for task:", taskId);
                if (window.NoxisAppBridge && typeof window.NoxisAppBridge.onEpisodeFinished === 'function') {
                    window.NoxisAppBridge.onEpisodeFinished(taskId);
                } else if (window.AndroidBridge && typeof window.AndroidBridge.onEpisodeFinished === 'function') {
                    window.AndroidBridge.onEpisodeFinished(taskId);
                }
            }
        }

        if (onNextEpisode && nextEpisodeInfo && mediaType === 'tv') {
            setShowControls(true);
            setShowNextEpisode(true);
            setIsPlaying(false);
            return;
        }
        onClose();
    }, [onClose, onNextEpisode, nextEpisodeInfo, mediaType, streamUrl]);

    // PERFORMANCE: 250ms throttle = saniyede max 4 çağrı (60fps yerine)
    const onTimeUpdate = useThrottledCallback(onTimeUpdateCore, 250, [onTimeUpdateCore]);

    const toggleFullscreen = useCallback(async (e) => {
        if (e) e.stopPropagation();
        const container = containerRef.current;
        const video = videoRef.current;

        // iOS Detection
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        const isFullscreenActive = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || (video && video.webkitDisplayingFullscreen);

        if (!isFullscreenActive) {
            try {
                if (isIOS && video && video.webkitEnterFullscreen) {
                    video.webkitEnterFullscreen();
                } else if (container.requestFullscreen) {
                    await container.requestFullscreen();
                } else if (container.webkitRequestFullscreen) {
                    await container.webkitRequestFullscreen();
                } else if (container.mozRequestFullScreen) {
                    await container.mozRequestFullScreen();
                } else if (container.msRequestFullscreen) {
                    await container.msRequestFullscreen();
                }
                setIsFullscreen(true);
                document.body.classList.add('player-fullscreen');
            } catch (err) {
                console.warn("Fullscreen API failed (likely iOS)", err);
                // Fallback for iOS if API fails
                if (video && video.webkitEnterFullscreen) {
                    video.webkitEnterFullscreen();
                }
                setIsFullscreen(true);
                document.body.classList.add('player-fullscreen');
            }
        } else {
            try {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    await document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    await document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    await document.msExitFullscreen();
                }
            } catch (err) { console.warn("Exit Fullscreen Error:", err); }
            setIsFullscreen(false);
            document.body.classList.remove('player-fullscreen');
        }
        handleInteraction();
    }, [handleInteraction]);

    const audioContextRef = useRef(null);
    useEffect(() => {
        if (isEmbedded || !videoRef.current) return;
        // Skip AudioContext on iOS — createMediaElementSource breaks native HLS playback
        if (IS_IOS) return;
        const initAudioIsolation = () => {
            try {
                if (audioContextRef.current) return;
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                const ctx = new AudioContext();
                audioContextRef.current = ctx;
                const source = ctx.createMediaElementSource(videoRef.current);
                source.connect(ctx.destination);
            } catch (e) { }
        };
        const handlePlay = () => {
            initAudioIsolation();
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }
        };
        const vid = videoRef.current;
        vid.addEventListener('play', handlePlay);
        if (!vid.paused) handlePlay();
        return () => {
            vid.removeEventListener('play', handlePlay);
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => { });
                audioContextRef.current = null;
            }
        };
    }, [isEmbedded]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            switch (e.key) {
                case ' ':
                case 'k':
                case 'Enter':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowRight':
                    if (videoRef.current) {
                        videoRef.current.currentTime += 10;
                        party.broadcastState(true);
                    }
                    handleInteraction();
                    break;
                case 'ArrowLeft':
                    if (videoRef.current) {
                        videoRef.current.currentTime -= 10;
                        party.broadcastState(true);
                    }
                    handleInteraction();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(v => {
                        const newV = Math.min(v + 0.1, 1);
                        if (videoRef.current) videoRef.current.volume = newV;
                        setIsMuted(false);
                        return newV;
                    });
                    handleInteraction();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(v => {
                        const newV = Math.max(v - 0.1, 0);
                        if (videoRef.current) videoRef.current.volume = newV;
                        return newV;
                    });
                    handleInteraction();
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
                case 'Escape':
                    onClose();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, toggleFullscreen, onClose, handleInteraction, party]);

    // Close menus on click-outside
    useEffect(() => {
        if (!showAudioMenu && !showQualityMenu && !showSubMenu) return;
        const onClickOutside = (e) => {
            if (!e.target.closest('[data-menu]')) {
                setShowAudioMenu(false);
                setShowQualityMenu(false);
                setShowSubMenu(false);
            }
        };
        document.addEventListener('pointerdown', onClickOutside);
        return () => document.removeEventListener('pointerdown', onClickOutside);
    }, [showAudioMenu, showQualityMenu, showSubMenu]);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            setShowPlayButton(false);
            setVideoError(null);
            let url = currentStreamUrl;
            if (!url || !videoRef.current) return;

            const video = videoRef.current;

            // ============================================================
            // iOS Safari — Production-Grade Native HLS
            // ============================================================
            if (IS_IOS || (IS_SAFARI && !Hls.isSupported())) {
                console.log('[iOS] Native HLS init:', url.substring(0, 80));
                iosRetryCountRef.current = 0;
                video._iosPlayed = false;

                // ── 1. Configure video element ──
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', 'true');
                video.setAttribute('x-webkit-airplay', 'allow');
                video.preload = 'auto';

                // iOS CRITICAL: NEVER set crossorigin on iOS/Safari native HLS.
                // iOS native HLS player handles CORS at the OS/AVFoundation level.
                // Setting crossorigin='anonymous' forces the browser to require
                // Access-Control-Allow-Origin headers on every .ts segment request.
                // If ANY segment server doesn't return CORS headers, the entire
                // video silently fails with a black screen (no error fired).
                video.removeAttribute('crossorigin');

                // ── 2. Load source ──
                video.src = url;
                video.load();

                // ── 3. State tracking ──
                let isSeeking = false;
                let lastProgressTime = Date.now();

                // ── 4. Event handlers ──

                // Metadata ready → set duration, restore watch position
                const onLoadedMetadata = () => {
                    console.log('[iOS] Metadata loaded, duration:', video.duration);
                    setDuration(video.duration || 0);
                    restorePlaybackPosition(video.duration || 0);
                };

                // Ready to play → attempt autoplay
                const onCanPlay = () => {
                    if (video._iosPlayed) return;
                    video._iosPlayed = true;
                    setIsLoading(false);

                    const shouldAutoplay = pendingAutoplayRef.current;
                    pendingAutoplayRef.current = null;
                    if (shouldAutoplay === false) {
                        setIsPlaying(false);
                        setShowPlayButton(false);
                        return;
                    }

                    const p = video.play();
                    if (p && p.then) {
                        p.then(() => {
                            setIsPlaying(true);
                            setShowPlayButton(false);
                        }).catch(() => {
                            setIsPlaying(false);
                            setShowPlayButton(true);
                        });
                    }
                };

                // Buffering started
                const onWaiting = () => {
                    if (!isSeeking) setIsLoading(true);
                };

                // Playback resumed after buffer
                const onPlaying = () => {
                    setIsLoading(false);
                    setIsPlaying(true);
                    setShowPlayButton(false);
                    lastProgressTime = Date.now();
                };

                // Track download progress for watchdog
                const onProgress = () => { lastProgressTime = Date.now(); };
                const onTimeUpdate = () => { lastProgressTime = Date.now(); };

                // Seek state tracking (prevents false stall detection during seeks)
                const onSeeking = () => { isSeeking = true; };
                const onSeeked = () => {
                    isSeeking = false;
                    lastProgressTime = Date.now();
                };

                // ── 5. Error recovery with classification ──
                const onError = () => {
                    const err = video.error;
                    if (!err) return;

                    const code = err.code;
                    const msg = err.message || '';
                    console.error(`[iOS] Error [${code}]: ${msg}`);

                    // MediaError codes:
                    // 1 = MEDIA_ERR_ABORTED — user/script aborted, ignore
                    // 2 = MEDIA_ERR_NETWORK — network failure, retry
                    // 3 = MEDIA_ERR_DECODE — decode failure, retry without CORS
                    // 4 = MEDIA_ERR_SRC_NOT_SUPPORTED — bad source, retry then give up
                    if (code === 1) return;

                    if (iosRetryCountRef.current < 3) {
                        iosRetryCountRef.current++;
                        const delay = Math.min(iosRetryCountRef.current * 1500, 5000);
                        console.log(`[iOS] Retry ${iosRetryCountRef.current}/3 in ${delay}ms`);

                        const retryId = setTimeout(() => {
                            if (!isMounted.current || !videoRef.current) return;
                            const v = videoRef.current;
                            const pos = v.currentTime || 0;

                            // iOS: ALWAYS strip crossorigin - native HLS handles CORS at OS level
                            v.removeAttribute('crossorigin');

                            v._iosPlayed = false;
                            v.src = url;
                            v.load();

                            // Restore position after reload
                            const restorePos = () => {
                                if (pos > 2) v.currentTime = pos;
                                v.removeEventListener('loadedmetadata', restorePos);
                            };
                            v.addEventListener('loadedmetadata', restorePos);
                        }, delay);
                        timeoutsRef.current.push(retryId);
                    } else {
                        setIsLoading(false);
                        setShowPlayButton(true);
                        setVideoError('Video yüklenirken bağlantı hatası oluştu.');
                        notifyPlaybackError('ios-native-hls-error');
                    }
                };

                // ── 6. Stall recovery ──
                const onStalled = () => {
                    if (isSeeking || video.paused) return;
                    console.warn('[iOS] Stall detected');
                    const id = setTimeout(() => {
                        if (!isMounted.current || !videoRef.current) return;
                        const v = videoRef.current;
                        if (v.readyState < 3 && !v.paused && !v.ended) {
                            const ct = v.currentTime;
                            v.currentTime = ct + 0.01;
                        }
                    }, 2000);
                    timeoutsRef.current.push(id);
                };

                // ── 7. Watchdog — recovers frozen playback ──
                if (iosWatchdogRef.current) clearInterval(iosWatchdogRef.current);
                iosWatchdogRef.current = setInterval(() => {
                    if (!isMounted.current || !videoRef.current) return;
                    const v = videoRef.current;
                    if (v.paused || v.ended || isSeeking) return;
                    // No progress for 15s → force reload
                    if (Date.now() - lastProgressTime > 15000) {
                        console.warn('[iOS] Watchdog: frozen, reloading');
                        const pos = v.currentTime;
                        v.removeAttribute('crossorigin');
                        v._iosPlayed = false;
                        v.src = url;
                        v.load();
                        const restore = () => {
                            if (pos > 2) v.currentTime = pos;
                            v.removeEventListener('loadedmetadata', restore);
                        };
                        v.addEventListener('loadedmetadata', restore);
                        lastProgressTime = Date.now();
                    }
                }, 5000);

                // ── 8. Network recovery — auto-resume on reconnect ──
                const onOnline = () => {
                    console.log('[iOS] Network reconnected, resuming');
                    if (videoRef.current && videoRef.current.paused && !videoRef.current.ended) {
                        videoRef.current.removeAttribute('crossorigin');
                        videoRef.current._iosPlayed = false;
                        const pos = videoRef.current.currentTime;
                        videoRef.current.src = url;
                        videoRef.current.load();
                        const restore = () => {
                            if (pos > 2) videoRef.current.currentTime = pos;
                            videoRef.current.removeEventListener('loadedmetadata', restore);
                        };
                        videoRef.current.addEventListener('loadedmetadata', restore);
                    }
                };
                window.addEventListener('online', onOnline);

                // ── 9. Visibility API — clean pause/resume on tab switch ──
                const onVisibilityChange = () => {
                    if (!videoRef.current) return;
                    if (document.hidden) {
                        videoRef.current.pause();
                    } else if (!videoRef.current.paused) {
                        // Already playing, no action needed
                    } else if (videoRef.current.currentTime > 0) {
                        // Was playing before tab switch, try to resume
                        videoRef.current.play().catch(() => { });
                    }
                };
                document.addEventListener('visibilitychange', onVisibilityChange);

                // ── 10. Attach all listeners ──
                video.addEventListener('loadedmetadata', onLoadedMetadata);
                video.addEventListener('canplay', onCanPlay);
                video.addEventListener('waiting', onWaiting);
                video.addEventListener('playing', onPlaying);
                video.addEventListener('progress', onProgress);
                video.addEventListener('timeupdate', onTimeUpdate);
                video.addEventListener('seeking', onSeeking);
                video.addEventListener('seeked', onSeeked);
                video.addEventListener('error', onError);
                video.addEventListener('stalled', onStalled);

                // Loading timeout (10s) — if native HLS hasn't started, show manual play button
                const loadTimeout = setTimeout(() => {
                    if (isMounted.current && !video._iosPlayed) {
                        console.warn('[iOS] Load timeout reached, showing play button');
                        setIsLoading(false);
                        setShowPlayButton(true);
                    }
                }, 10000);
                timeoutsRef.current.push(loadTimeout);

                // ── 11. Cleanup ──
                return () => {
                    video.removeEventListener('loadedmetadata', onLoadedMetadata);
                    video.removeEventListener('canplay', onCanPlay);
                    video.removeEventListener('waiting', onWaiting);
                    video.removeEventListener('playing', onPlaying);
                    video.removeEventListener('progress', onProgress);
                    video.removeEventListener('timeupdate', onTimeUpdate);
                    video.removeEventListener('seeking', onSeeking);
                    video.removeEventListener('seeked', onSeeked);
                    video.removeEventListener('error', onError);
                    video.removeEventListener('stalled', onStalled);
                    window.removeEventListener('online', onOnline);
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                    if (iosWatchdogRef.current) {
                        clearInterval(iosWatchdogRef.current);
                        iosWatchdogRef.current = null;
                    }
                };
            }

            // Non-iOS: Use HLS.js
            if (Hls.isSupported() && shouldUseHlsForUrl(url)) {
                const hls = new Hls({
                    ...hlsConfig,
                    xhrSetup: function (xhr, url) {
                        xhr.withCredentials = false;
                        const lowerUrl = String(url || '').toLowerCase();
                        if (lowerUrl.includes('vidmody.com') && !lowerUrl.includes('mode=proxy') && !lowerUrl.includes('workers.dev') && !lowerUrl.includes('video-proxy')) {
                            const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(url)}&mode=proxy`;
                            const rt = xhr.responseType;
                            const timeout = xhr.timeout;
                            xhr.open('GET', proxyUrl, true);
                            if (rt) xhr.responseType = rt;
                            if (timeout) xhr.timeout = timeout;
                        }
                    },
                    enableWorker: hlsConfig.enableWorker ?? true,
                    lowLatencyMode: false,
                    backBufferLength: 30,
                    maxFragLookUpTolerance: 0.5,
                    maxBufferHole: 2.5,
                    highBufferWatchdogPeriod: 3,
                    manifestLoadingMaxRetry: 6,
                    manifestLoadingRetryDelay: 1000,
                    manifestLoadingTimeOut: 20000,
                    levelLoadingMaxRetry: 6,
                    levelLoadingRetryDelay: 1000,
                    fragLoadingMaxRetry: 12,
                    fragLoadingRetryDelay: 1000,
                    fragLoadingTimeOut: 30000,
                    startFragPrefetch: true
                });
                hls.loadSource(url);
                hls.attachMedia(videoRef.current);
                hlsRef.current = hls;

                // Error recovery handler
                hls.on(Hls.Events.ERROR, (event, data) => {
                    console.warn('[HLS Error]', data.type, data.details);
                    if (data.fatal) {
                        const recoveryPosition = preservePlaybackPosition();
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.warn('[HLS] Network error, attempting recovery...');
                                schedulePlaybackFallback('hls-network-error', data, 12000);
                                const recoverId = setTimeout(() => {
                                    if (hlsRef.current !== hls) return;
                                    const resumeAt = videoRef.current?.currentTime || recoveryPosition || currentTimeRef.current || 0;
                                    hls.startLoad(resumeAt > 0 ? resumeAt : -1);
                                }, 1000);
                                timeoutsRef.current.push(recoverId);
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.warn('[HLS] Media error, attempting recovery...');
                                hls.recoverMediaError();
                                if (recoveryPosition > 0) {
                                    const restoreId = setTimeout(() => {
                                        if (hlsRef.current !== hls || !videoRef.current) return;
                                        if (Math.abs(videoRef.current.currentTime - recoveryPosition) > 1) {
                                            videoRef.current.currentTime = recoveryPosition;
                                        }
                                    }, 500);
                                    timeoutsRef.current.push(restoreId);
                                }
                                break;
                            default:
                                console.error('[HLS] Unrecoverable error', data.details);
                                setVideoError('Video yüklenirken hata oluştu (Kaynak bozuk veya ulaşılamaz).');
                                setIsLoading(false);
                                schedulePlaybackFallback('hls-unrecoverable-error', data, 1500);
                                break;
                        }
                    }
                });

	                hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
	                    hlsManifestReadyRef.current = true;
	                    if (playbackFallbackTimerRef.current) {
	                        clearTimeout(playbackFallbackTimerRef.current);
	                        playbackFallbackTimerRef.current = null;
	                    }
	                    setIsLoading(false);
                    const shouldAutoplay = pendingAutoplayRef.current;
                    pendingAutoplayRef.current = null;

                    if (shouldAutoplay === false) {
                        setIsPlaying(false);
                    } else {
                        videoRef.current.play()
                            .then(() => setIsPlaying(true))
                            .catch(() => {
                                setIsPlaying(false);
                                setShowPlayButton(true);
                            });
                    }

	                    if (data.levels && data.levels.length > 0) {
	                        setQualityLevels(data.levels);
	                    }
	                });
	                hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
	                    const levelDuration = Number(data?.details?.totalduration);
	                    if (Number.isFinite(levelDuration) && levelDuration > 0) {
	                        setHlsPlaylistDuration(levelDuration);
	                        setDuration(prev => (Number.isFinite(prev) && prev >= 1800 ? prev : levelDuration));
	                    }
	                });
	                hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (event, data) => {
                    setHlsSubtitleTracks(data.subtitleTracks);
                    if (activeSubIndexRef.current !== -1) {
                        disableHlsSubtitles();
                    }
                });
            } else {
                // Native playback (direct MP4s, non-HLS streams)
                if (videoRef.current) {
                    // Handle crossOrigin for non-CORS sources
                    if (!needsCORS(url)) {
                        videoRef.current.removeAttribute('crossorigin');
                    }
                    videoRef.current.src = url;
                    videoRef.current.load();
                    const shouldAutoplay = pendingAutoplayRef.current;
                    pendingAutoplayRef.current = null;

                    if (shouldAutoplay === false) {
                        setIsPlaying(false);
                        setIsLoading(false);
                    } else {
                        const playPromise = videoRef.current.play();
                        if (playPromise !== undefined) {
                            playPromise
                                .then(() => {
                                    setIsPlaying(true);
                                    setIsLoading(false);
                                })
                                .catch(e => {
                                    console.log('Autoplay prevented, user interaction needed:', e);
                                    setIsPlaying(false);
                                    setIsLoading(false);
                                    setShowPlayButton(true);
                                });
                        }
                    }
                }
            }
            setIsLoading(false);
        };
        init();

        return () => {
            if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
            if (playbackFallbackTimerRef.current) {
                clearTimeout(playbackFallbackTimerRef.current);
                playbackFallbackTimerRef.current = null;
            }

            // Clear all tracked timeouts
            timeoutsRef.current.forEach(id => clearTimeout(id));
            timeoutsRef.current = [];

            if (hlsRef.current) {
                hlsRef.current.off(Hls.Events.ERROR);
                hlsRef.current.off(Hls.Events.MANIFEST_PARSED);
                hlsRef.current.off(Hls.Events.LEVEL_LOADED);
                hlsRef.current.off(Hls.Events.SUBTITLE_TRACKS_UPDATED);
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            if (videoRef.current) {
                if (IS_IOS && iosNativeTrackRef.current) {
                    iosNativeTrackRef.current.mode = 'disabled';
                }
                if (!videoRef.current.ended) {
                    preservePlaybackPosition();
                }
                videoRef.current.src = "";
                videoRef.current.load();
            }
        };
    }, [currentStreamUrl, disableHlsSubtitles, notifyPlaybackError, preservePlaybackPosition, schedulePlaybackFallback]);

    useEffect(() => {
        if (availableSubtitles.length === 0 || activeSubIndex === -1) return;

        const subTimeoutId = setTimeout(() => {
            if (videoRef.current?.textTracks) {
                const tracks = videoRef.current.textTracks;
                const activeIosTrack = IS_IOS ? iosTrackElementRefs.current[activeSubIndex]?.track : null;
                for (let i = 0; i < tracks.length; i++) {
                    if (IS_IOS) {
                        if (activeIosTrack && tracks[i] === activeIosTrack) {
                            tracks[i].mode = 'showing';
                        } else if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') {
                            tracks[i].mode = 'disabled';
                        }
                    } else {
                        tracks[i].mode = 'disabled';
                    }
                }
            }
        }, 500);
        timeoutsRef.current.push(subTimeoutId);

        return () => {
            clearTimeout(subTimeoutId);
        };
    }, [availableSubtitles, activeSubIndex]);

    const handleWrapperClick = (e) => {
        if (e) e.stopPropagation();
        const now = Date.now();

        if (now - lastTapRef.current < 300) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
            const relativeX = (clickX - rect.left) / rect.width;

            if (relativeX < 0.33) {
                if (videoRef.current) {
                    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 30);
                    setSeekAnimation({ show: true, direction: 'left', seconds: 30 });

                    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
                    seekTimeoutRef.current = setTimeout(() => {
                        if (isMounted.current) {
                            setSeekAnimation({ show: false, direction: null, seconds: 0 });
                        }
                    }, 800);

                    party.broadcastState(true);
                }
            } else if (relativeX > 0.66) {
                if (videoRef.current) {
                    videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 30);
                    setSeekAnimation({ show: true, direction: 'right', seconds: 30 });

                    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
                    seekTimeoutRef.current = setTimeout(() => {
                        if (isMounted.current) {
                            setSeekAnimation({ show: false, direction: null, seconds: 0 });
                        }
                    }, 800);

                    party.broadcastState(true);
                }
            } else {
                toggleFullscreen();
            }
            lastTapRef.current = 0;
        } else {
            lastTapRef.current = now;
            togglePlay();
        }
    };

    const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            initialPinchDistanceRef.current = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length === 2 && initialPinchDistanceRef.current) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            if (currentDist - initialPinchDistanceRef.current > 50) {
                if (resizeMode !== 'cover') { setResizeMode('cover'); initialPinchDistanceRef.current = null; }
            } else if (initialPinchDistanceRef.current - currentDist > 50) {
                if (resizeMode !== 'contain') { setResizeMode('contain'); initialPinchDistanceRef.current = null; }
            }
        }
    };

    const handleTouchEnd = (e) => {
        initialPinchDistanceRef.current = null;

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (!isIOS) return;

        const now = Date.now();
        const touch = e.changedTouches[0];
        if (!touch) return;

        if (now - lastTapRef.current < 300) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = touch.clientX;
            const relativeX = (clickX - rect.left) / rect.width;

            if (relativeX < 0.33) {
                if (videoRef.current) {
                    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 30);
                    setSeekAnimation({ show: true, direction: 'left', seconds: 30 });
                    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
                    seekTimeoutRef.current = setTimeout(() => {
                        if (isMounted.current) setSeekAnimation({ show: false, direction: null, seconds: 0 });
                    }, 800);
                    party.broadcastState(true);
                }
            } else if (relativeX > 0.66) {
                if (videoRef.current) {
                    videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 30);
                    setSeekAnimation({ show: true, direction: 'right', seconds: 30 });
                    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
                    seekTimeoutRef.current = setTimeout(() => {
                        if (isMounted.current) setSeekAnimation({ show: false, direction: null, seconds: 0 });
                    }, 800);
                    party.broadcastState(true);
                }
            } else {
                const video = videoRef.current;
                if (video && video.webkitEnterFullscreen) {
                    video.webkitEnterFullscreen();
                }
            }
            lastTapRef.current = 0;
            e.preventDefault();
        } else {
            lastTapRef.current = now;
        }
    };

    // --- BUTTON COMPONENT TO PREVENT REPETITION AND ENFORCE STYLE ---
    const PlayerButton = ({ onClick, children, className = '', title, style = {} }) => (
        <button
            className={`glass-btn ${className}`}
            onClick={onClick}
            title={title}
            style={{ ...styles.button, ...style }}
        >
            {children}
        </button>
    );

    return (
        <div ref={containerRef} style={isEmbedded ? styles.embeddedContainer : styles.container} onMouseMove={handleInteraction} onClick={() => { setShowSubMenu(false); setShowAudioMenu(false); setShowQualityMenu(false); }}>
            <style>{`
                video::-webkit-media-text-track-container {
                    position: absolute !important;
                    bottom: 4% !important;
                    left: 0 !important;
                    right: 0 !important;
                    overflow: visible !important;
                }
                
                @supports (padding-bottom: env(safe-area-inset-bottom)) {
                    video::-webkit-media-text-track-container {
                        bottom: calc(4% + env(safe-area-inset-bottom)) !important;
                    }
                }

                video::-webkit-media-text-track-container {
                    bottom: 4% !important;
                }
                video::-webkit-media-text-track-background {
                    background: transparent !important;
                    background-color: transparent !important;
                }
                video::-webkit-media-text-track-display {
                    position: relative !important;
                    bottom: 0 !important;
                    background: transparent !important;
                    background-color: transparent !important;
                }
                video::cue {
                    font-family: 'Netflix Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
                    color: #ffffff !important;
                    background: transparent !important;
                    background-color: transparent !important;
                    text-shadow: 
                        2px 2px 4px rgba(0,0,0,0.95),
                        -1px -1px 2px rgba(0,0,0,0.8),
                        1px -1px 2px rgba(0,0,0,0.8),
                        -1px 1px 2px rgba(0,0,0,0.8),
                        0 0 8px rgba(0,0,0,0.6) !important;
                    font-weight: 700;
                    line-height: 1.4;
                    font-size: clamp(20px, 2.8vw, 42px);
                    letter-spacing: 0.02em;
                    -webkit-font-smoothing: antialiased;
                }
                video::cue(b) {
                    font-weight: 800;
                    color: #ffffff;
                }
                video::cue(i) {
                    font-style: italic;
                    color: #f0f0f0;
                }
                .glass-btn { 
                    position: relative;
                    overflow: hidden;
                }
                .glass-btn:hover { 
                    background: rgba(255,255,255,0.15) !important; 
                    transform: scale(1.05); 
                }
                .glass-btn:active { 
                    transform: scale(0.95); 
                    background: rgba(255,255,255,0.1) !important; 
                }
                /* Remove ugly focus ring */
                .glass-btn:focus, .glass-btn:focus-visible {
                    outline: none !important;
                    box-shadow: none !important;
                }
                /* Ripple effect mock */
                .glass-btn::after {
                    content: '';
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.3);
                    opacity: 0;
                    transform: scale(0);
                    transition: all 0.4s;
                }
                .glass-btn:active::after {
                    opacity: 1;
                    transform: scale(2);
                    transition: 0s;
                }
            `}</style>

            <PartyModal
                isOpen={showPartyModal}
                onClose={() => setShowPartyModal(false)}
                roomCode={party.roomCode}
                isHost={party.isHost}
                partyViewers={party.partyViewers}
                syncStatus={party.syncStatus}
                onCreateRoom={party.createRoom}
                onJoinRoom={party.joinRoom}
                onLeaveRoom={party.leaveRoom}
                currentStreamUrl={currentStreamUrl}
            />

            <div
                style={styles.videoWrapper}
                onClick={handleWrapperClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {videoError && (
                    <div style={{ position: 'absolute', zIndex: 30, background: 'rgba(0,0,0,0.8)', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fas fa-exclamation-triangle" style={{ fontSize: '48px', color: '#ff4f58', marginBottom: '16px' }} />
                        <div style={{ color: 'white', fontWeight: '600', fontSize: '18px', textAlign: 'center', padding: '0 20px' }}>{videoError}</div>
                        <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Geri Dön</button>
                    </div>
                )}
                {isLoading && (
                    <div style={{ position: 'absolute', zIndex: 5, pointerEvents: 'none' }}>
                        <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#E50914', borderRadius: '50%', width: '64px', height: '64px', animation: 'spin 0.8s linear infinite' }} />
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {party.isHostBuffering && !isLoading && (
                    <div style={{ position: 'absolute', zIndex: 15, background: 'rgba(0,0,0,0.6)', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#E50914', borderRadius: '50%', width: '48px', height: '48px', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }} />
                        <div style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>Host Bekleniyor...</div>
                        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '4px' }}>Video senkronize ediliyor</div>
                    </div>
                )}

                <AnimatePresence>
                    {showCenterPlay && (
                        <motion.div
                            style={styles.centerAnimation}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.5 }}
                            transition={{ duration: 0.3 }}
                        >
                            <i className={`fas ${isPlaying ? 'fa-play' : 'fa-pause'}`} style={{ color: 'white', fontSize: '48px' }} />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {seekAnimation.show && (
                        <motion.div
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: seekAnimation.direction === 'left' ? '20%' : '80%',
                                transform: 'translate(-50%, -50%)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                zIndex: 10,
                                pointerEvents: 'none'
                            }}
                            initial={{ opacity: 0, scale: 0.5, x: seekAnimation.direction === 'left' ? 30 : -30 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        >
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.6)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                borderRadius: '50%',
                                width: '80px',
                                height: '80px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid rgba(255, 255, 255, 0.2)'
                            }}>
                                <i className={`fas fa-${seekAnimation.direction === 'left' ? 'backward' : 'forward'}`}
                                    style={{ color: 'white', fontSize: '28px' }} />
                            </div>
                            <span style={{
                                color: 'white',
                                fontSize: '16px',
                                fontWeight: '700',
                                textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                            }}>
                                {seekAnimation.direction === 'left' ? '-' : '+'}{seekAnimation.seconds}s
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <video
                    ref={videoRef}
                    className={!IS_IOS && activeSubIndex !== -1 ? 'noxis-hide-native-cues' : undefined}
                    style={{ ...styles.video, objectFit: resizeMode }}
                    onWaiting={() => { setIsLoading(true); if (party.isHost) party.handleBufferStart(); }}
                    onPlaying={() => { setIsLoading(false); setIsPlaying(true); setShowPlayButton(false); if (party.isHost) party.handleBufferEnd(); }}
                    onStalled={() => { if (IS_IOS) console.warn('[iOS] stalled event on video element'); }}
                            onTimeUpdate={onTimeUpdate} onEnded={handlePlaybackEnded} muted={isMuted}
                    crossOrigin={IS_IOS ? undefined : (needsCORS(currentStreamUrl) ? "anonymous" : undefined)}
                    playsInline
                    webkit-playsinline="true"
                    x-webkit-airplay="allow"
                    preload="auto"
                    autoPlay
                    onLoadedMetadata={handleLoadedMetadata}
                >
                    {IS_IOS && availableSubtitles.map((s, i) => (
                        <track
                            key={`${i}-${subtitleOffset}`}
                            ref={(el) => { iosTrackElementRefs.current[i] = el; }}
                            kind="subtitles"
                            src={resolveSubtitleTrackUrl(s, subtitleOffset)}
                            label={s.label || s.name || s.lang}
                            srcLang={s.lang}
                            default={i === activeSubIndex}
                        />
                    ))}
                </video>
                {!IS_IOS && (
                    <style>{`.noxis-hide-native-cues::cue{color:transparent;background:transparent;text-shadow:none;}`}</style>
                )}

                {/* iOS Autoplay Fallback: Big centered Play button */}
                {showPlayButton && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            if (videoRef.current) {
                                videoRef.current.play().then(() => {
                                    setIsPlaying(true);
                                    setShowPlayButton(false);
                                }).catch(() => { });
                            }
                        }}
                        style={{
                            position: 'absolute', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '88px', height: '88px', borderRadius: '50%',
                            background: 'rgba(229, 9, 20, 0.85)',
                            backdropFilter: 'blur(12px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', zIndex: 9999,
                            boxShadow: '0 8px 32px rgba(229, 9, 20, 0.4), 0 0 0 4px rgba(255,255,255,0.15)',
                            transition: 'transform 0.2s',
                            border: '2px solid rgba(255,255,255,0.2)'
                        }}
                    >
                        <i className="fas fa-play" style={{ color: 'white', fontSize: '32px', marginLeft: '4px' }} />
                    </div>
                )}

                {/* Netflix-style subtitle overlay */}
                {!IS_IOS && currentSubtitle && (
                    <div style={{
                        position: 'absolute',
                        bottom: '10%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        maxWidth: '85%',
                        textAlign: 'center',
                        zIndex: 10,
                        pointerEvents: 'none',
                    }}>
                        <span 
                            dangerouslySetInnerHTML={{ __html: currentSubtitle }}
                            style={{
                                color: '#fff',
                                fontSize: 'clamp(18px, 3vw, 32px)',
                                fontWeight: '400',
                                lineHeight: '1.35',
                                letterSpacing: '0.02em',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                textShadow: '1px 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)',
                                whiteSpace: 'pre-wrap',
                                display: 'inline',
                            }}
                        />
                    </div>
                )}

                <AnimatePresence>
                    {showControls && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.topGradient}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                                    <i className="fas fa-arrow-left" style={{ color: 'white', fontSize: '18px' }} />
                                </div>
                                <h2 style={styles.movieTitle}>{displayTitle}</h2>
                            </div>
                            {party.roomCode && (
                                <div style={{ color: '#4CAF50', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(76, 175, 80, 0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 8px #4CAF50' }}></span>
                                    Party: {party.roomCode}
                                </div>
                            )}
                        </div>
                    </motion.div>}
                </AnimatePresence>
                <AnimatePresence>
                    {showControls && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.gradientOverlay} />}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {showNextEpisode && onNextEpisode && nextEpisodeInfo && (
                    <motion.button
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        transition={{ duration: 0.3 }}
                        onClick={(e) => { e.stopPropagation(); onNextEpisode(); }}
                        style={{
                            position: 'absolute',
                            bottom: 'calc(140px + env(safe-area-inset-bottom))',
                            right: '24px',
                            background: 'rgba(255, 255, 255, 0.15)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            borderRadius: '12px',
                            padding: '14px 24px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            zIndex: 25,
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                        }}
                    >
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '2px' }}>Sonraki Bölüm</div>
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>{nextEpisodeInfo.title || `${nextEpisodeInfo.episode}. Bölüm`}</div>
                        </div>
                        <i className="fas fa-forward-step" style={{ fontSize: '20px' }} />
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showControls && (
                    <motion.div style={styles.controlsContainer} initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                        <div style={styles.controlsGlass} onClick={e => e.stopPropagation()}>

                            {/* Progress Bar */}
                            <div
                                ref={progressBarRef}
                                style={{ ...styles.progressWrapper }}
                                onMouseDown={startProgressDrag}
                                onTouchStart={startProgressDrag}
                                onMouseMove={handleProgressHover}
                                onMouseEnter={() => setHoverProgress(true)}
                                onMouseLeave={() => { setHoverProgress(false); setHoverTime(null); }}
                            >
                                {/* Tooltip */}
                                <AnimatePresence>
                                    {(hoverTime !== null || isDraggingProgress) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                            transition={{ duration: 0.15 }}
                                            style={{
                                                position: 'absolute',
                                                bottom: '24px',
                                                left: `${tooltipPos}%`,
                                                transform: 'translateX(-50%)',
                                                background: 'rgba(20, 20, 20, 0.85)',
                                                backdropFilter: 'blur(8px)',
                                                WebkitBackdropFilter: 'blur(8px)',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                color: '#fff',
                                                pointerEvents: 'none',
                                                whiteSpace: 'nowrap',
                                                zIndex: 20,
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                fontWeight: '600',
                                                fontFamily: '"Inter", sans-serif'
                                            }}
                                        >
                                            {formatTime(hoverTime)}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div style={{ ...styles.progressRail, height: hoverProgress || isDraggingProgress ? '6px' : '4px', background: hoverProgress || isDraggingProgress ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)' }}>
                                    <div style={{ ...styles.bufferBar, width: `${buffered}%` }} />
                                    <div style={{ ...styles.progressBar, width: `${progress}%`, boxShadow: hoverProgress || isDraggingProgress ? '0 0 16px rgba(229, 9, 20, 0.8)' : '0 0 8px rgba(229, 9, 20, 0.4)' }} />
                                </div>
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: hoverProgress || isDraggingProgress ? 1 : 0 }}
                                    style={{ ...styles.scrubber, left: `${progress}%` }}
                                />
                            </div>

                            <div style={styles.bottomBar}>
                                <div style={styles.leftControls}>
                                    <PlayerButton onClick={togglePlay}>
                                        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} style={{ fontSize: '20px' }} />
                                    </PlayerButton>

                                    {(mediaType === 'tv' || onNextEpisode) && (
                                        <PlayerButton
                                            onClick={() => {
                                                if (onNextEpisode) {
                                                    onNextEpisode();
                                                }
                                            }}
                                            title="Sonraki Bölüm"
                                            style={{ opacity: onNextEpisode ? 1 : 0.4 }}
                                        >
                                            <i className="fas fa-forward-step" style={{ fontSize: '18px' }} />
                                        </PlayerButton>
                                    )}

                                    {/* Custom Volume Control */}
                                    <div
                                        style={styles.volumeContainer}
                                        onMouseEnter={() => setShowVolumeSlider(true)}
                                        onMouseLeave={() => { if (!isDraggingVolume) setShowVolumeSlider(false) }}
                                    >
                                        <PlayerButton onClick={() => setIsMuted(!isMuted)}>
                                            <i className={`fas ${isMuted ? 'fa-volume-mute' : (volume > 0.5 ? 'fa-volume-up' : 'fa-volume-down')}`} style={{ fontSize: '20px' }} />
                                        </PlayerButton>

                                        <div
                                            ref={volumeSliderRef}
                                            style={{
                                                ...styles.volumeSliderContainer,
                                                width: (showVolumeSlider || isDraggingVolume) ? '100px' : '0',
                                                opacity: (showVolumeSlider || isDraggingVolume) ? 1 : 0,
                                                padding: (showVolumeSlider || isDraggingVolume) ? '12px 0' : '0' // Increase hit area
                                            }}
                                            onMouseDown={(e) => { setIsDraggingVolume(true); handleVolumeDrag(e); }}
                                            onTouchStart={(e) => { setIsDraggingVolume(true); handleVolumeDrag(e); }}
                                        >
                                            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', position: 'relative' }}>
                                                <div style={{ ...styles.volumeFill, width: `${isMuted ? 0 : volume * 100}%` }} />
                                                <div style={{
                                                    position: 'absolute',
                                                    left: `${isMuted ? 0 : volume * 100}%`,
                                                    top: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    width: '12px',
                                                    height: '12px',
                                                    background: '#fff',
                                                    borderRadius: '50%',
                                                    boxShadow: '0 0 10px rgba(0,0,0,0.3)',
                                                    pointerEvents: 'none'
                                                }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={styles.timeDisplay}>{formatTime(currentTime)} / {formatTime(duration)}</div>
                                </div>

                                <div style={styles.rightControls}>
                                    <PlayerButton onClick={() => setShowPartyModal(true)} title="Watch Party" style={{ color: party.roomCode ? '#4CAF50' : '#fff' }}>
                                        <i className="fas fa-users" style={{ fontSize: '18px' }} />
                                    </PlayerButton>

                                    <PlayerButton
                                        onClick={() => {
                                            if (casting.isChecking) {
                                                return; // Still checking
                                            }
                                            if (casting.canCast) {
                                                casting.isCasting ? casting.stopCasting() : casting.showCastPicker();
                                            } else {
                                                alert('Cast cihazı bulunamadı.\n\nOlası nedenler:\n• Chromecast/Smart TV aynı WiFi ağında değil\n• Tarayıcı desteklemiyor (Chrome, Edge önerilir)\n• HTTPS gerekiyor (aktif)\n\nNot: Bazı Android TV\'ler Remote Playback destekler.');
                                            }
                                        }}
                                        title={casting.isChecking ? 'Cast kontrol ediliyor...' : casting.isCasting ? `${casting.receiverName || 'TV'}'ye yayınlanıyor` : casting.canCast ? 'Ekrana Yayınla' : 'Cast yok'}
                                        style={{ color: casting.isCasting ? '#4CAF50' : casting.canCast ? '#fff' : casting.isChecking ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)' }}
                                    >
                                        <i className={casting.isChecking ? "fas fa-spinner fa-spin" : "fas fa-tv"} style={{ fontSize: '18px' }} />
                                    </PlayerButton>

                                    {(audioTracks.length > 1 || isDualAudio || isDiziyouDual) && (
                                        <div data-menu style={{ position: 'relative' }}>
                                            <PlayerButton onClick={() => setShowAudioMenu(!showAudioMenu)}>
                                                <i className="fas fa-headphones" style={{ fontSize: '20px' }} />
                                            </PlayerButton>
                                            <AnimatePresence>
                                                {showAudioMenu && (
                                                    <motion.div initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 15, scale: 0.95 }} style={styles.menu}>
                                                        {isDiziyouDual ? (
                                                            <>
                                                                <button style={{ ...styles.menuItem, ...(currentAudio === 'tr' ? styles.activeItem : {}) }} onClick={() => switchSourceAudio('tr')}>
                                                                    TR Dublaj {currentAudio === 'tr' && <i className="fas fa-check" />}
                                                                </button>
                                                                <button style={{ ...styles.menuItem, ...(currentAudio === 'original' ? styles.activeItem : {}) }} onClick={() => switchSourceAudio('original')}>
                                                                    Orijinal {currentAudio === 'original' && <i className="fas fa-check" />}
                                                                </button>
                                                            </>
                                                        ) : isDualAudio ? (
                                                            <>
                                                                <button style={{ ...styles.menuItem, ...(currentAudio === 'a1' ? styles.activeItem : {}) }} onClick={() => switchVidmodyAudio('a1')}>
                                                                    TR Dublaj {currentAudio === 'a1' && <i className="fas fa-check" />}
                                                                </button>
                                                                <button style={{ ...styles.menuItem, ...(currentAudio === 'a2' ? styles.activeItem : {}) }} onClick={() => switchVidmodyAudio('a2')}>
                                                                    Orijinal {currentAudio === 'a2' && <i className="fas fa-check" />}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            audioTracks.map((track, i) => (
                                                                <button key={i} style={{ ...styles.menuItem, ...(selectedAudioIndex === i ? styles.activeItem : {}) }} onClick={() => switchAudio(i)}>
                                                                    {track.title || `Track ${i + 1}`} ({track.codec}) {selectedAudioIndex === i && <i className="fas fa-check" />}
                                                                </button>
                                                            ))
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                    <div data-menu style={{ position: 'relative' }}>
                                        <PlayerButton onClick={() => setShowQualityMenu(!showQualityMenu)}>
                                            <i className="fas fa-cog" style={{ fontSize: '20px' }} />
                                        </PlayerButton>
                                        <AnimatePresence>
                                            {showQualityMenu && (
                                                <motion.div initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 15, scale: 0.95 }} style={styles.menu}>
                                                    <div style={{ padding: '8px', borderBottom: qualityLevels.length > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', marginBottom: '4px' }}>
                                                        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px', paddingLeft: '4px', fontWeight: '600' }}>Hız</div>
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                            {[0.5, 1, 1.25, 1.5, 2].map(speed => (
                                                                <button
                                                                    key={speed}
                                                                    onClick={() => changeSpeed(speed)}
                                                                    style={{
                                                                        flex: 1,
                                                                        background: playbackSpeed === speed ? 'rgba(229, 9, 20, 0.8)' : 'rgba(255,255,255,0.1)',
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        color: 'white',
                                                                        padding: '6px 4px',
                                                                        fontSize: '12px',
                                                                        cursor: 'pointer',
                                                                        minWidth: '36px',
                                                                        fontWeight: '500',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    {speed}x
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {qualityLevels.length > 0 && (
                                                        <>
                                                            <div style={{ fontSize: '12px', color: '#aaa', margin: '8px 0 4px', paddingLeft: '12px', fontWeight: '600' }}>Kalite</div>
                                                            <button style={{ ...styles.menuItem, ...(currentQuality === -1 ? styles.activeItem : {}) }} onClick={() => switchQuality(-1)}>
                                                                Otomatik {currentQuality === -1 && <i className="fas fa-check" />}
                                                            </button>
                                                            {qualityLevels.map((level, i) => (
                                                                <button key={i} style={{ ...styles.menuItem, ...(currentQuality === i ? styles.activeItem : {}) }} onClick={() => switchQuality(i)}>
                                                                    {level.height}p {currentQuality === i && <i className="fas fa-check" />}
                                                                </button>
                                                            ))}
                                                        </>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div data-menu style={{ position: 'relative' }}>
                                        <PlayerButton onClick={() => setShowSubMenu(!showSubMenu)} style={{ color: activeSubIndex !== -1 ? '#E50914' : '#fff' }}>
                                            <i className="fas fa-closed-captioning" style={{ fontSize: '22px' }} />
                                        </PlayerButton>
                                        <AnimatePresence>
                                            {showSubMenu && (
                                                <motion.div initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 15, scale: 0.95 }} style={styles.menu}>
                                                    <button style={{ ...styles.menuItem }} onClick={() => { switchSubtitle(-1); switchHlsSubtitle(-1); }}>Kapalı</button>
                                                    {visibleHlsSubtitleTracks.map((s, i) => (
                                                        <button key={`hls-${s.trackIndex ?? i}`} style={{ ...styles.menuItem, ...(selectedHlsSub === s.trackIndex ? styles.activeItem : {}) }} onClick={() => switchHlsSubtitle(s.trackIndex)}>
                                                            {getSubtitleMenuLabel({ lang: s.lang, name: s.name }, getSubtitleSourceName())}
                                                        </button>
                                                    ))}
                                                    {availableSubtitles.map((s, i) => (
                                                        <button key={`ext-${i}`} style={{ ...styles.menuItem, ...(activeSubIndex === i ? styles.activeItem : {}) }} onClick={() => switchSubtitle(i)}>
                                                            {getSubtitleMenuLabel(s)}
                                                        </button>
                                                    ))}
                                                    <button style={{ ...styles.menuItem, borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '4px' }} onClick={(e) => { e.stopPropagation(); setShowSubtitleSyncTools(prev => !prev); }}>
                                                        {showSubtitleSyncTools ? 'Senkron ayarını gizle' : 'Senkronu düzelt'}
                                                    </button>
                                                    {showSubtitleSyncTools && (
                                                        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                            <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px', paddingLeft: '4px', fontWeight: '600' }}>
                                                                Süre {subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button onClick={(e) => { e.stopPropagation(); adjustSubtitleOffset(-0.5) }} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', padding: '6px' }}>-0.5s</button>
                                                                <button onClick={(e) => { e.stopPropagation(); resetSubtitleSync() }} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', padding: '6px' }}>Sıfırla</button>
                                                                <button onClick={(e) => { e.stopPropagation(); adjustSubtitleOffset(0.5) }} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', padding: '6px' }}>+0.5s</button>
                                                            </div>
                                                            {!IS_IOS && (
                                                                <>
                                                                    <div style={{ fontSize: '12px', color: '#aaa', margin: '8px 0 6px', paddingLeft: '4px', fontWeight: '600' }}>
                                                                        Tempo {subtitleScalePercent > 0 ? '+' : ''}{subtitleScalePercent}%
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                                        <button onClick={(e) => { e.stopPropagation(); adjustSubtitleTimeScale(-0.01) }} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', padding: '6px' }}>-1%</button>
                                                                        <button onClick={(e) => { e.stopPropagation(); adjustSubtitleTimeScale(0.01) }} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', padding: '6px' }}>+1%</button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <PlayerButton onClick={toggleFullscreen}>
                                        <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} style={{ fontSize: '20px' }} />
                                    </PlayerButton>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
