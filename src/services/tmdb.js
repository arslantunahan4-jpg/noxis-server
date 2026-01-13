
// TMDB API Service
const TMDB_API_KEY = 'db8ab9e44da4236102fadf5d58a08a4b';
const BASE_URL = 'https://api.themoviedb.org/3';

export const fetchTMDB = async (endpoint) => {
    const symbol = endpoint.includes('?') ? '&' : '?';
    try {
        const res = await fetch(`${BASE_URL}${endpoint}${symbol}api_key=${TMDB_API_KEY}&language=tr-TR`);
        return res.ok ? await res.json() : null;
    } catch (e) {
        console.error('[TMDB Error]', e);
        return null;
    }
};

export const TV_CATEGORY_DEFINITIONS = [
    {
        key: 'crimeThriller',
        title: 'Suç Konulu Gerilim Dizileri',
        endpoint: '/discover/tv?with_genres=80,9648' // Crime + Mystery (Proxy for Thriller)
    },
    {
        key: 'usAction',
        title: 'Heyecan Verici Amerikan Dizileri',
        endpoint: '/discover/tv?with_origin_country=US&with_genres=10759' // Action & Adventure
    },
    {
        key: 'awardWinning',
        title: 'Ödüllü Diziler',
        endpoint: '/discover/tv?sort_by=vote_average.desc&vote_count.gte=1000'
    },
    {
        key: 'bookBased',
        title: 'Kitaplardan Uyarlanan Diziler',
        endpoint: '/discover/tv?with_keywords=818' // Based on novel or book
    },
    {
        key: 'exciting',
        title: 'Heyecanlı Diziler',
        endpoint: '/discover/tv?with_genres=10759'
    },
    {
        key: 'darkComedy',
        title: 'Ezber Bozan Karanlık Komedi Dizileri',
        endpoint: '/discover/tv?with_genres=35&with_keywords=10123'
    },
    {
        key: 'koreanDrama',
        title: 'Türkçe Dublajlı Kore Dramaları',
        endpoint: '/discover/tv?with_original_language=ko&with_genres=18' // Korean Drama (Dubbing inferred)
    },
    {
        key: 'uniqueComedy',
        title: 'Ezber Bozan Komedi Dizileri',
        endpoint: '/discover/tv?with_genres=35&sort_by=vote_average.desc&vote_count.gte=500'
    },
    {
        key: 'horror',
        title: 'Korku Temalı Diziler',
        endpoint: '/discover/tv?with_genres=9648&with_keywords=315058' // Mystery + Horror Keyword
    },
    {
        key: 'comingOfAge',
        title: 'Yetişkinliğe Geçiş Temalı Gençlik Drama Dizileri',
        endpoint: '/discover/tv?with_keywords=10683'
    },
    {
        key: 'violent',
        title: 'Şiddet İçerikli Diziler',
        endpoint: '/discover/tv?with_keywords=312898'
    },
    {
        key: 'europeanComedy',
        title: 'Avrupa Yapımı Komediler',
        endpoint: '/discover/tv?with_genres=35&with_origin_country=GB|FR|DE|ES|IT'
    },
    {
        key: 'crimeDrama',
        title: 'Suç Drama Dizileri',
        endpoint: '/discover/tv?with_genres=80,18'
    },
    {
        key: 'boredRecommendations',
        title: 'Çok Sıkıldım Diyenlere Özel Öneriler',
        endpoint: '/trending/tv/week'
    },
    {
        key: 'shortComedy',
        title: "30'ar Dakikalık Komediler",
        endpoint: '/discover/tv?with_genres=35&with_runtime.lte=35'
    },
    {
        key: 'shortTv',
        title: 'Acelen mi Var? 30 Dakikada Çabucak İzlenir',
        endpoint: '/discover/tv?with_runtime.lte=30'
    }
];

export const MOVIE_CATEGORY_DEFINITIONS = [
    {
        key: 'war',
        title: 'Savaş Filmleri',
        endpoint: '/discover/movie?with_genres=10752'
    },
    {
        key: 'history',
        title: 'Tarih Filmleri',
        endpoint: '/discover/movie?with_genres=36'
    },
    {
        key: 'crimeThriller',
        title: 'Suç Konulu Gerilim Filmleri',
        endpoint: '/discover/movie?with_genres=80,53'
    },
    {
        key: 'awardWinning',
        title: 'Ödüllü Filmler',
        endpoint: '/discover/movie?sort_by=vote_average.desc&vote_count.gte=2000'
    },
    {
        key: 'bookBased',
        title: 'Kitaplardan Uyarlanan Filmler',
        endpoint: '/discover/movie?with_keywords=818'
    },
    {
        key: 'darkComedy',
        title: 'Karanlık Komedi Filmleri',
        endpoint: '/discover/movie?with_genres=35&with_keywords=10123'
    },
    {
        key: 'korean',
        title: 'Kore Sineması',
        endpoint: '/discover/movie?with_original_language=ko'
    },
    {
        key: 'horror',
        title: 'Korku Filmleri',
        endpoint: '/discover/movie?with_genres=27'
    },
    {
        key: 'comingOfAge',
        title: 'Yetişkinliğe Geçiş Filmleri',
        endpoint: '/discover/movie?with_keywords=10683'
    },
    {
        key: 'european',
        title: 'Avrupa Sineması',
        endpoint: '/discover/movie?with_origin_country=GB|FR|DE|ES|IT'
    },
    {
        key: 'shortMovie',
        title: 'Acelen mi Var? 90 Dakikalık Filmler',
        endpoint: '/discover/movie?with_runtime.lte=90'
    },
    {
        key: 'scifiFantasy',
        title: 'Bilim Kurgu ve Fantastik',
        endpoint: '/discover/movie?with_genres=878,14'
    }
];

// For backward compatibility if needed, but better to update consumers
export const CATEGORY_DEFINITIONS = TV_CATEGORY_DEFINITIONS;
