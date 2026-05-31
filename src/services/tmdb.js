// TMDB Category Definitions
// Inspired by Netflix Categories

export const TV_CATEGORY_DEFINITIONS = [
    {
        key: 'turkish',
        title: 'Türk Dizileri',
        endpoint: '/discover/tv?with_original_language=tr'
    },
    {
        key: 'crimeThriller',
        title: 'Suç Konulu Gerilim Dizileri',
        endpoint: '/discover/tv?with_genres=80,9648'
    },
    {
        key: 'kdrama',
        title: 'Kore Dizileri',
        endpoint: '/discover/tv?with_original_language=ko'
    },
    {
        key: 'anime',
        title: 'Anime Dizileri',
        endpoint: '/discover/tv?with_genres=16&with_original_language=ja'
    },
    {
        key: 'actionAdv',
        title: 'Aksiyon ve Macera',
        endpoint: '/discover/tv?with_genres=10759'
    },
    {
        key: 'scifiFantasy',
        title: 'Bilim Kurgu ve Fantastik',
        endpoint: '/discover/tv?with_genres=10765'
    },
    {
        key: 'comedy',
        title: 'Komedi Dizileri',
        endpoint: '/discover/tv?with_genres=35'
    },
    {
        key: 'reality',
        title: 'Reality Programları',
        endpoint: '/discover/tv?with_genres=10764'
    },
    {
        key: 'docu',
        title: 'Belgesel Dizileri',
        endpoint: '/discover/tv?with_genres=99'
    },
    {
        key: 'family',
        title: 'Çocuk ve Aile',
        endpoint: '/discover/tv?with_genres=10751|10762'
    },
    {
        key: 'miniseries',
        title: 'Mini Diziler',
        endpoint: '/discover/tv?with_type=2'
    },
    {
        key: 'soap',
        title: 'Pembe Diziler',
        endpoint: '/discover/tv?with_genres=10766'
    },
    {
        key: 'politics',
        title: 'Politik ve Savaş',
        endpoint: '/discover/tv?with_genres=10768'
    },
    {
        key: 'drama',
        title: 'Drama Dizileri',
        endpoint: '/discover/tv?with_genres=18'
    },
    {
        key: 'western',
        title: 'Western Dizileri',
        endpoint: '/discover/tv?with_genres=37'
    },
    {
        key: 'mystery',
        title: 'Gizem Dizileri',
        endpoint: '/discover/tv?with_genres=9648'
    }
];

export const MOVIE_CATEGORY_DEFINITIONS = [
    {
        key: 'turkish',
        title: 'Türk Filmleri',
        endpoint: '/discover/movie?with_original_language=tr'
    },
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
        endpoint: '/discover/movie?with_genres=35,80'
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
        endpoint: '/discover/movie?with_origin_country=GB|FR|DE|ES|IT&with_original_language=en|fr|de|es|it'
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
    },
    {
        key: 'action',
        title: 'Aksiyon Filmleri',
        endpoint: '/discover/movie?with_genres=28'
    },
    {
        key: 'comedy',
        title: 'Komedi Filmleri',
        endpoint: '/discover/movie?with_genres=35'
    },
    {
        key: 'romance',
        title: 'Romantik Filmler',
        endpoint: '/discover/movie?with_genres=10749'
    },
    {
        key: 'animation',
        title: 'Animasyon Filmleri',
        endpoint: '/discover/movie?with_genres=16'
    },
    {
        key: 'documentary',
        title: 'Belgesel Filmler',
        endpoint: '/discover/movie?with_genres=99'
    },
    {
        key: 'family',
        title: 'Aile Filmleri',
        endpoint: '/discover/movie?with_genres=10751'
    },
    {
        key: 'western',
        title: 'Western Filmleri',
        endpoint: '/discover/movie?with_genres=37'
    }
];

// For backward compatibility if needed, but better to update consumers
export const CATEGORY_DEFINITIONS = TV_CATEGORY_DEFINITIONS;
