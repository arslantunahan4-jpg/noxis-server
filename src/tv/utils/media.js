export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';
export const TV_BACKDROP_SIZE = 'original';
export const TV_PREVIEW_SIZE = 'w1280';

export const imageUrl = (path, size = 'w1280') => {
    if (!path) return '';
    return `${TMDB_IMAGE_BASE}${size}${path}`;
};

export const tvBackdropUrl = (path) => imageUrl(path, TV_BACKDROP_SIZE);
export const tvPreviewUrl = (path) => imageUrl(path, TV_PREVIEW_SIZE);

export const mediaTitle = (item = {}) => item.title || item.name || item.original_title || item.original_name || 'İsimsiz içerik';

export const mediaType = (item = {}, fallback = 'movie') => {
    if (item.media_type) return item.media_type === 'tv' ? 'tv' : 'movie';
    if (item.first_air_date || item.name || item.original_name) return 'tv';
    return fallback;
};

export const mediaYear = (item = {}) => {
    const value = item.release_date || item.first_air_date || '';
    return value ? String(value).slice(0, 4) : '';
};

export const ratingText = (item = {}) => {
    const value = Number(item.vote_average || 0);
    return value > 0 ? value.toFixed(1) : null;
};

export const runtimeText = (minutes) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (!hours) return `${mins} dk`;
    return mins ? `${hours} sa ${mins} dk` : `${hours} sa`;
};

export const cleanItems = (items = []) => {
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    return items
        .filter((item) => item && item.id && (item.poster_path || item.backdrop_path))
        .filter((item) => {
            const title = String(item.name || item.title || item.original_name || item.original_title || '').toLowerCase();
            if (title.includes('tagesschau') || title.includes('rote rosen') || title.includes('zdf')) return false;
            const genreIds = Array.isArray(item.genre_ids) ? item.genre_ids : [];
            const isNewsOrTalk = genreIds.some((g) => [10763, 10767].includes(typeof g === 'object' ? g?.id : g));
            const voteCount = Number(item.vote_count || 0);
            if (isNewsOrTalk && voteCount < 300) return false;
            return true;
        })
        .filter((item) => {
            const key = `${mediaType(item)}-${item.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const normalizePage = (page) => {
    const parsed = Number.parseInt(page, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export const appendPage = (endpoint, page = 1) => {
    const safePage = normalizePage(page);
    const value = String(endpoint || '');

    if (/[?&]page=/i.test(value)) {
        return value.replace(/([?&])page=[^&]*/i, `$1page=${safePage}`);
    }

    const separator = value.includes('?') ? '&' : '?';
    return `${value}${separator}page=${safePage}`;
};

export const HOME_RAILS = [
    { key: 'trending', title: 'Trend Olanlar', endpoint: '/trending/all/week', layout: 'landscape' },
    { key: 'popularMovies', title: 'Popüler Filmler', endpoint: '/movie/popular', layout: 'portrait' },
    { key: 'popularTV', title: 'Popüler Diziler', endpoint: '/discover/tv?sort_by=popularity.desc&vote_count.gte=100&without_genres=10763,10767', layout: 'portrait' },
    { key: 'topMovies', title: 'Eleştirmenlerin Öne Çıkardıkları', endpoint: '/movie/top_rated?vote_count.gte=500', layout: 'landscape' },
    { key: 'actionMovies', title: 'Aksiyon ve Macera', endpoint: '/discover/movie?with_genres=28,12&sort_by=popularity.desc&vote_count.gte=100', layout: 'portrait' },
    { key: 'crimeSeries', title: 'Suç ve Gerilim Dizileri', endpoint: '/discover/tv?with_genres=80,9648&sort_by=popularity.desc&vote_count.gte=50', layout: 'portrait' },
    { key: 'scifi', title: 'Bilim Kurgu Evrenleri', endpoint: '/discover/movie?with_genres=878,14&sort_by=popularity.desc&vote_count.gte=100', layout: 'landscape' }
];

export const MOVIE_RAILS = [
    { key: 'popular', title: 'Popüler Filmler', endpoint: '/movie/popular', layout: 'landscape' },
    { key: 'topRated', title: 'Yüksek Puanlı Filmler', endpoint: '/movie/top_rated?vote_count.gte=500', layout: 'portrait' },
    { key: 'turkish', title: 'Türk Filmleri', endpoint: '/discover/movie?with_original_language=tr&sort_by=popularity.desc&vote_count.gte=10', layout: 'portrait' },
    { key: 'award', title: 'Ödüllü ve Güçlü Filmler', endpoint: '/discover/movie?sort_by=vote_average.desc&vote_count.gte=2000', layout: 'landscape' },
    { key: 'crime', title: 'Suç ve Gerilim', endpoint: '/discover/movie?with_genres=80,53&sort_by=popularity.desc&vote_count.gte=100', layout: 'portrait' },
    { key: 'short', title: '90 Dakika ve Altı', endpoint: '/discover/movie?with_runtime.lte=90&sort_by=popularity.desc&vote_count.gte=100', layout: 'portrait' }
];

export const SERIES_RAILS = [
    { key: 'popular', title: 'Popüler Diziler', endpoint: '/discover/tv?sort_by=popularity.desc&vote_count.gte=100&without_genres=10763,10767', layout: 'landscape' },
    { key: 'topRated', title: 'Yüksek Puanlı Diziler', endpoint: '/tv/top_rated?vote_count.gte=150', layout: 'portrait' },
    { key: 'turkish', title: 'Türk Dizileri', endpoint: '/discover/tv?with_original_language=tr&sort_by=popularity.desc&vote_count.gte=10', layout: 'portrait' },
    { key: 'crime', title: 'Suç ve Gizem', endpoint: '/discover/tv?with_genres=80,9648&sort_by=popularity.desc&vote_count.gte=50', layout: 'portrait' },
    { key: 'scifi', title: 'Bilim Kurgu ve Fantastik', endpoint: '/discover/tv?with_genres=10765&sort_by=popularity.desc&vote_count.gte=50', layout: 'landscape' },
    { key: 'mini', title: 'Mini Diziler', endpoint: '/discover/tv?with_type=2&sort_by=popularity.desc&vote_count.gte=50', layout: 'portrait' }
];
