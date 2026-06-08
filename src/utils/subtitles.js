const SOURCE_LABEL_PATTERN = /\((stremio|os|opensubtitles|kaynak|source|vidmody|streamimdb|diziyou|dizigom|dizimom)\)/i;

const normalizeLang = (lang = '') => {
    const normalized = String(lang || '').toLowerCase();
    if (normalized === 'tur') return 'tr';
    if (normalized === 'eng') return 'en';
    return normalized;
};
const SOURCE_PROVIDERS = new Set(['kaynak', 'source', 'vidmody', 'streamimdb', 'diziyou', 'dizigom', 'dizimom']);
const PROVIDER_LABELS = {
    kaynak: 'Kaynak',
    source: 'Kaynak',
    vidmody: 'Vidmody',
    streamimdb: 'StreamIMDb',
    diziyou: 'Diziyou',
    dizigom: 'Dizigom',
    dizimom: 'Dizimom',
    opensubtitles: 'OpenSubtitles',
    stremio: 'Stremio'
};

const getFallbackLabel = (lang = '') => {
    const normalized = normalizeLang(lang);
    if (normalized === 'tr' || normalized === 'tur') return 'Turkce';
    if (normalized === 'en' || normalized === 'eng') return 'English';
    return lang || 'Subtitle';
};

const getSubtitleKey = (subtitle = {}) => {
    if (subtitle.url) return `url:${subtitle.url}`;
    if (subtitle.id) return `id:${subtitle.id}`;
    return `meta:${subtitle.lang || ''}:${subtitle.label || subtitle.name || ''}`;
};

const normalizeProvider = (provider = '') => String(provider || '').trim().toLowerCase();

export const inferSubtitleProvider = (subtitle = {}, fallback = '') => {
    const explicitProvider = normalizeProvider(subtitle.provider || fallback);
    if (explicitProvider) return explicitProvider;

    const text = `${subtitle.label || ''} ${subtitle.name || ''}`.toLowerCase();
    const url = String(subtitle.url || '').toLowerCase();

    if (text.includes('diziyou') || url.includes('diziyou')) return 'diziyou';
    if (text.includes('dizigom') || url.includes('dizigom')) return 'dizigom';
    if (text.includes('dizimom') || url.includes('dizimom')) return 'dizimom';
    if (text.includes('vidmody') || url.includes('vidmody')) return 'vidmody';
    if (
        text.includes('streamimdb') ||
        url.includes('streamimdb') ||
        url.includes('vaplayer') ||
        url.includes('justhd.tv') ||
        url.includes('onlinecoachingacademy') ||
        url.includes('brightpathsignals') ||
        url.includes('nextgencloudfabric')
    ) return 'streamimdb';
    if (text.includes('stremio') || url.includes('strem.io')) return 'stremio';
    if (text.includes('opensubtitles') || text.includes('- os') || url.includes('opensubtitles')) return 'opensubtitles';
    if (text.includes('kaynak') || text.includes('source')) return 'source';
    return 'other';
};

const getSubtitleScore = (subtitle = {}) => {
    const numericScore = Number(subtitle.score);
    if (Number.isFinite(numericScore)) return numericScore;

    const label = `${subtitle.label || ''} ${subtitle.name || ''}`;
    const scoreMatch = label.match(/\(([\d.]+)\s*-\s*OS\)/i);
    return scoreMatch ? Number(scoreMatch[1]) : -1;
};

const sortSubtitleCandidates = (subtitles = []) => subtitles
    .slice()
    .sort((a, b) => {
        const providerA = inferSubtitleProvider(a);
        const providerB = inferSubtitleProvider(b);

        const priorityA = SOURCE_PROVIDERS.has(providerA) ? 0 : providerA === 'opensubtitles' ? 1 : providerA === 'stremio' ? 2 : 3;
        const priorityB = SOURCE_PROVIDERS.has(providerB) ? 0 : providerB === 'opensubtitles' ? 1 : providerB === 'stremio' ? 2 : 3;

        if (priorityA !== priorityB) return priorityA - priorityB;

        const scoreDiff = getSubtitleScore(b) - getSubtitleScore(a);
        if (scoreDiff !== 0) return scoreDiff;

        return (a.label || a.name || '').localeCompare(b.label || b.name || '');
    });

export const getSubtitleMenuLabel = (subtitle = {}, fallbackProvider = '') => {
    const langLabel = getFallbackLabel(subtitle.lang || subtitle.language || subtitle.srcLang);
    const provider = inferSubtitleProvider(subtitle, fallbackProvider);

    if (subtitle.preserveOption && subtitle.label) {
        return subtitle.label;
    }

    if (provider === 'stremio' || provider === 'streamimdb') {
        return `${langLabel} (Stremio)`;
    }

    const providerLabel = PROVIDER_LABELS[provider];
    if (!providerLabel) {
        return subtitle.label || subtitle.name || langLabel;
    }

    return langLabel;
};

export const optimizeSubtitleList = (subtitles = []) => {
    const grouped = new Map();

    subtitles.forEach((subtitle) => {
        if (!subtitle?.url) return;
        const lang = normalizeLang(subtitle.lang || 'und');
        const list = grouped.get(lang) || [];
        list.push(subtitle);
        grouped.set(lang, list);
    });

    const languageOrder = ['tr', 'en'];
    const orderedLanguages = [
        ...languageOrder.filter(lang => grouped.has(lang)),
        ...Array.from(grouped.keys()).filter(lang => !languageOrder.includes(lang))
    ];

    const optimized = [];

    orderedLanguages.forEach((lang) => {
        const items = sortSubtitleCandidates(grouped.get(lang) || []);
        const sourceItems = items.filter(item => SOURCE_PROVIDERS.has(inferSubtitleProvider(item)));
        const osItems = items.filter(item => inferSubtitleProvider(item) === 'opensubtitles');
        const stremioItems = items.filter(item => inferSubtitleProvider(item) === 'stremio');
        const otherItems = items.filter(item => {
            const provider = inferSubtitleProvider(item);
            return !SOURCE_PROVIDERS.has(provider) && provider !== 'opensubtitles' && provider !== 'stremio';
        });

        const bestSource = sourceItems[0] || null;
        const bestExternal = osItems[0] || (bestSource ? stremioItems[0] : stremioItems[0] || otherItems[0]) || null;
        const preservedOptions = items.filter(item => item.preserveOption);

        const pushUnique = (item) => {
            if (!item?.url || optimized.some(existing => existing.url === item.url)) return;
            optimized.push(item);
        };

        pushUnique(bestSource);
        pushUnique(bestExternal);

        if (!bestSource && !bestExternal && otherItems.length > 0) {
            pushUnique(otherItems[0]);
        }

        preservedOptions.forEach((item) => {
            if (!optimized.some(existing => existing.url === item.url)) {
                optimized.push(item);
            }
        });
    });

    return optimized;
};

export const normalizeSourceSubtitles = (subtitles = [], sourceName = 'Kaynak', extra = {}) =>
    optimizeSubtitleList(subtitles
        .filter(subtitle => subtitle?.url)
        .map(subtitle => {
            const provider = inferSubtitleProvider(subtitle, sourceName);
            const baseLabel = subtitle.label || subtitle.name || getFallbackLabel(subtitle.lang);
            const label = SOURCE_LABEL_PATTERN.test(baseLabel)
                ? getSubtitleMenuLabel({ ...subtitle, label: baseLabel }, provider)
                : getSubtitleMenuLabel(subtitle, sourceName);

            return {
                ...subtitle,
                ...extra,
                provider,
                label
            };
        }));

export const normalizeExternalSubtitles = (subtitles = [], extra = {}) =>
    optimizeSubtitleList(subtitles
        .filter(subtitle => subtitle?.url)
        .map(subtitle => {
            const provider = inferSubtitleProvider(subtitle);

            return {
                ...subtitle,
                ...extra,
                provider,
                label: getSubtitleMenuLabel(subtitle, provider)
            };
        }));

export const mergeSubtitleLists = (...lists) => {
    const merged = [];
    const seen = new Set();

    lists.flat().forEach(subtitle => {
        if (!subtitle?.url) return;

        const key = getSubtitleKey(subtitle);
        if (seen.has(key)) return;

        seen.add(key);
        merged.push(subtitle);
    });

    return optimizeSubtitleList(merged);
};
