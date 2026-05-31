const normalizeValue = (value) => (value || '').toLowerCase();

const includesAny = (value, patterns) => patterns.some(pattern => value.includes(pattern));

const normalizeWorkerUrl = (workerUrl) => {
    const trimmed = (workerUrl || '').replace(/\/+$/, '');
    return trimmed.replace(/\/(?:master(?:\.m3u8)?|proxy(?:\.m3u8)?)$/i, '');
};

export const isVidmodyTurkishAudio = (audio) => {
    const lang = normalizeValue(audio?.lang);
    const name = normalizeValue(audio?.name);
    return lang === 'tr' || lang === 'tur' || includesAny(name, ['turk', 'türk', 'turkish', 'dublaj']);
};

export const isVidmodyOriginalAudio = (audio) => {
    const lang = normalizeValue(audio?.lang);
    const name = normalizeValue(audio?.name);
    return lang === 'en' || lang === 'eng' || includesAny(name, ['english', 'ingilizce', 'orijinal', 'original']);
};

export const getVidmodyAudioSwitchStrategy = (audioSwitchStrategy, audios = []) => {
    if (audioSwitchStrategy) return audioSwitchStrategy;
    return audios.length > 1 ? 'hls-track' : 'none';
};

export const buildVidmodyMasterUrl = ({
    workerUrl,
    videos = [],
    audios = [],
    subtitles = [],
    workingAudio = 'a1',
    audioSwitchStrategy
}) => {
    const baseWorkerUrl = normalizeWorkerUrl(workerUrl);
    const sources = videos.map(video => ({
        quality: video.resolution || video.quality || 'HD',
        url: video.url
    }));
    const strategy = getVidmodyAudioSwitchStrategy(audioSwitchStrategy, audios);
    const trSubtitle = subtitles.find(subtitle => subtitle.lang === 'tr');
    const params = new URLSearchParams({
        mode: 'master',
        sources: JSON.stringify(sources),
        dual: strategy === 'none' ? 'false' : 'true',
        defaultAudio: workingAudio || 'a1',
        audioSwitchStrategy: strategy
    });

    if (audios.length > 0) {
        params.set('audios', JSON.stringify(audios.map(audio => ({
            name: audio.name,
            lang: audio.lang,
            url: audio.url,
            trackId: audio.trackId
        }))));
    }

    if (trSubtitle?.url) {
        params.set('subtitleUrl', trSubtitle.url);
    }

    return `${baseWorkerUrl}?${params.toString()}`;
};

export const buildVidmodyExternalAudioTracks = (
    audios = [],
    { audioSwitchStrategy = 'none', workingAudio = null } = {}
) => {
    const original = audios.find(isVidmodyOriginalAudio);
    const dub = audios.find(isVidmodyTurkishAudio);

    if (!original && !dub) return null;

    return {
        provider: 'vidmody',
        switchStrategy: getVidmodyAudioSwitchStrategy(audioSwitchStrategy, audios),
        original: original?.url || null,
        dub: dub?.url || null,
        active: workingAudio && original?.trackId === workingAudio
            ? 'original'
            : workingAudio && dub?.trackId === workingAudio
                ? 'dub'
                : dub
                    ? 'dub'
                    : 'original'
    };
};
