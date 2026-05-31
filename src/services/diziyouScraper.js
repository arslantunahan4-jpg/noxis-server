import { getApiBaseUrl } from '../utils/apiBaseUrl';

const WORKER_URL = (import.meta.env.VITE_WORKER_URL || 'https://ancient-math-1d1b.arslab.workers.dev')
    .replace(/\/+$/, '')
    .replace(/\/(?:master(?:\.m3u8)?|proxy(?:\.m3u8)?|diziyou-resolve)$/i, '');

const DIZIYOU_REFERER = 'https://www.diziyou.one/';

const normalizeWorkerUrl = (value = '') => String(value || '')
    .replace(/\/+$/, '')
    .replace(/\/(?:master(?:\.m3u8)?|proxy(?:\.m3u8)?|diziyou-resolve)$/i, '');

const tryParseUrl = (value) => {
    try {
        return new URL(value);
    } catch (error) {
        return null;
    }
};

const extractWrappedSource = (value = '') => {
    const parsed = tryParseUrl(value);
    if (!parsed) {
        return {
            rawUrl: value,
            workerUrl: null,
            referer: null
        };
    }

    const wrappedUrl = parsed.searchParams.get('url');
    if (!wrappedUrl) {
        return {
            rawUrl: parsed.toString(),
            workerUrl: null,
            referer: null
        };
    }

    return {
        rawUrl: wrappedUrl,
        workerUrl: parsed.searchParams.get('mode') === 'proxy'
            ? normalizeWorkerUrl(`${parsed.origin}${parsed.pathname}`)
            : null,
        referer: parsed.searchParams.get('referer') || null
    };
};

const extractDiziyouVideoId = (...candidates) => {
    for (const candidate of candidates) {
        const { rawUrl } = extractWrappedSource(candidate);
        const match = String(rawUrl || '').match(/storage\.diziyou\.one\/episodes\/(\d+)(?:_tr)?\/[^/?#]+\.m3u8(?:[?#].*)?$/i);
        if (match?.[1]) {
            return match[1];
        }
    }

    return null;
};

const buildWorkerProxyUrl = (workerUrl, targetUrl, referer = DIZIYOU_REFERER) => {
    const normalizedWorkerUrl = normalizeWorkerUrl(workerUrl || WORKER_URL);
    const params = new URLSearchParams({
        url: targetUrl,
        mode: 'proxy'
    });

    if (referer) {
        params.set('referer', referer);
    }

    return `${normalizedWorkerUrl}?${params.toString()}`;
};

const buildDerivedDiziyouSubtitles = (data = {}) => {
    const videoId = extractDiziyouVideoId(data.original, data.turkish_dub);
    if (!videoId) return [];

    const originalSource = extractWrappedSource(data.original);
    const dubSource = extractWrappedSource(data.turkish_dub);
    const workerUrl = originalSource.workerUrl || dubSource.workerUrl || null;
    const referer = originalSource.referer || dubSource.referer || DIZIYOU_REFERER;

    const baseSubtitles = [
        { lang: 'tr', label: 'Turkce', url: `https://storage.diziyou.one/subtitles/${videoId}/tr.vtt` },
        { lang: 'en', label: 'English', url: `https://storage.diziyou.one/subtitles/${videoId}/en.vtt` }
    ];

    if (!workerUrl) {
        return baseSubtitles;
    }

    return baseSubtitles.map((subtitle) => ({
        ...subtitle,
        url: buildWorkerProxyUrl(workerUrl, subtitle.url, referer)
    }));
};

const mergeDiziyouSubtitles = (...lists) => {
    const merged = [];
    const seen = new Set();

    lists.flat().forEach((subtitle) => {
        if (!subtitle?.url) return;
        if (seen.has(subtitle.url)) return;

        seen.add(subtitle.url);
        merged.push(subtitle);
    });

    return merged;
};

const normalizeDiziyouPayload = (data) => {
    if (!data?.success) return null;

    const derivedSubtitles = buildDerivedDiziyouSubtitles(data);

    return {
        original: data.original,
        turkish_dub: data.turkish_dub,
        hasOriginal: data.hasOriginal,
        hasDub: data.hasDub,
        subtitles: mergeDiziyouSubtitles(data.subtitles || [], derivedSubtitles),
        resolvedBy: data.resolvedBy || 'backend'
    };
};

const fetchDiziyouPayload = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        return normalizeDiziyouPayload(data);
    } catch (error) {
        return null;
    }
};

export const findDiziyouSource = async (title, season, episode, originalTitle = null) => {
    const serverUrl = getApiBaseUrl();
    const params = new URLSearchParams({
        title: title,
        season: season.toString(),
        episode: episode.toString()
    });

    if (originalTitle) {
        params.append('originalTitle', originalTitle);
    }

    const backendResult = await fetchDiziyouPayload(`${serverUrl}/api/diziyou?${params}`);
    if (backendResult) {
        return backendResult;
    }

    return fetchDiziyouPayload(`${WORKER_URL}?mode=diziyou-resolve&${params}`);
};
