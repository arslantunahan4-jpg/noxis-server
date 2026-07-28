import { getApiBaseUrl } from '../utils/apiBaseUrl';

// %100 Yüksek Çözünürlüklü Özel Tasarım Karakter Avatarları
export const AVATAR_CATEGORIES = [
    { id: 'all', label: 'Tümü' },
    { id: 'series', label: 'Dizi Karakterleri' },
    { id: 'cinema', label: 'Sinema Devleri' }
];

export const AVATARS = [
    // ═══════ Dizi Karakterleri ═══════
    {
        id: 'tommy_shelby',
        name: 'Tommy Shelby (Peaky Blinders)',
        category: 'series',
        url: '/avatars/tommy_shelby.png',
        gradient: 'linear-gradient(135deg, #1c2541, #0b0c10)'
    },
    {
        id: 'heisenberg',
        name: 'Walter White (Breaking Bad)',
        category: 'series',
        url: '/avatars/walter_white.png',
        gradient: 'linear-gradient(135deg, #f39c12, #2c3e50)'
    },
    {
        id: 'eleven_stranger',
        name: 'Eleven (Stranger Things)',
        category: 'series',
        url: '/avatars/eleven.png',
        gradient: 'linear-gradient(135deg, #e50914, #141414)'
    },
    {
        id: 'got_daenerys',
        name: 'Daenerys Targaryen (GoT)',
        category: 'series',
        url: '/avatars/daenerys.png',
        gradient: 'linear-gradient(135deg, #8e44ad, #2c3e50)'
    },
    {
        id: 'wednesday_addams',
        name: 'Wednesday Addams',
        category: 'series',
        url: '/avatars/wednesday.jpg',
        gradient: 'linear-gradient(135deg, #334155, #0f172a)'
    },
    {
        id: 'sherlock_holmes',
        name: 'Sherlock Holmes',
        category: 'series',
        url: '/avatars/sherlock.png',
        gradient: 'linear-gradient(135deg, #2563eb, #0f172a)'
    },
    {
        id: 'nikki_freeman',
        name: 'Nikki Freeman (Obsession)',
        category: 'series',
        url: '/avatars/nikki_freeman.jpg',
        gradient: 'linear-gradient(135deg, #b91c1c, #1e1b4b)'
    },
    {
        id: 'professor_lcpdp',
        name: 'Profesör (La Casa de Papel)',
        category: 'series',
        url: '/avatars/professor.jpg',
        gradient: 'linear-gradient(135deg, #dc2626, #450a0a)'
    },
    {
        id: 'geralt_witcher',
        name: 'Geralt (The Witcher)',
        category: 'series',
        url: '/avatars/geralt.jpg',
        gradient: 'linear-gradient(135deg, #78716c, #1c1917)'
    },
    {
        id: 'ragnar_vikings',
        name: 'Ragnar Lothbrok (Vikings)',
        category: 'series',
        url: '/avatars/ragnar.jpg',
        gradient: 'linear-gradient(135deg, #1e40af, #0c0a09)'
    },
    {
        id: 'jon_snow',
        name: 'Jon Snow (GoT)',
        category: 'series',
        url: '/avatars/jon_snow.jpg',
        gradient: 'linear-gradient(135deg, #1e293b, #020617)'
    },
    {
        id: 'dexter_morgan',
        name: 'Dexter Morgan (Dexter)',
        category: 'series',
        url: '/avatars/dexter.jpg',
        gradient: 'linear-gradient(135deg, #991b1b, #1c1917)'
    },
    {
        id: 'lucifer_morning',
        name: 'Lucifer Morningstar',
        category: 'series',
        url: '/avatars/lucifer.jpg',
        gradient: 'linear-gradient(135deg, #dc2626, #0f172a)'
    },
    {
        id: 'saul_goodman',
        name: 'Saul Goodman (Better Call Saul)',
        category: 'series',
        url: '/avatars/saul_goodman.jpg',
        gradient: 'linear-gradient(135deg, #ca8a04, #1e3a5f)'
    },

    // ═══════ Sinema Devleri ═══════
    {
        id: 'dark_knight',
        name: 'Batman (Kara Şövalye)',
        category: 'cinema',
        url: '/avatars/batman.png',
        gradient: 'linear-gradient(135deg, #1a1a24, #000000)'
    },
    {
        id: 'joker_movie',
        name: 'The Joker (Dark Knight)',
        category: 'cinema',
        url: '/avatars/joker.png',
        gradient: 'linear-gradient(135deg, #7b1fa2, #2e7d32)'
    },
    {
        id: 'spiderman_movie',
        name: 'Spider-Man',
        category: 'cinema',
        url: '/avatars/spiderman.jpg',
        gradient: 'linear-gradient(135deg, #e50914, #8b0000)'
    },
    {
        id: 'interstellar_movie',
        name: 'Interstellar Gezgin (Cooper)',
        category: 'cinema',
        url: '/avatars/interstellar.jpg',
        gradient: 'linear-gradient(135deg, #0288d1, #01579b)'
    },
    {
        id: 'tyler_durden',
        name: 'Tyler Durden (Fight Club)',
        category: 'cinema',
        url: '/avatars/tyler_durden.png',
        gradient: 'linear-gradient(135deg, #ec4899, #0f172a)'
    },
    {
        id: 'matrix_neo',
        name: 'Neo (The Matrix)',
        category: 'cinema',
        url: '/avatars/neo.png',
        gradient: 'linear-gradient(135deg, #16a34a, #020617)'
    },
    {
        id: 'john_wick',
        name: 'John Wick',
        category: 'cinema',
        url: '/avatars/john_wick.jpg',
        gradient: 'linear-gradient(135deg, #1e293b, #000000)'
    },
    {
        id: 'darth_vader',
        name: 'Darth Vader (Star Wars)',
        category: 'cinema',
        url: '/avatars/darth_vader.jpg',
        gradient: 'linear-gradient(135deg, #1e1b4b, #000000)'
    }
];

export const DEFAULT_AVATAR = AVATARS[0];

export const getStoredAvatarKey = () => {
    try {
        const userStr = localStorage.getItem('noxis_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            const id = user?.id || user?._id || user?.username;
            if (id) return `noxis_user_avatar_${id}`;
        }
    } catch (e) {}
    return 'noxis_user_avatar_guest';
};

export const getStoredAvatar = () => {
    try {
        const key = getStoredAvatarKey();
        const storedId = localStorage.getItem(key);
        if (storedId) {
            const found = AVATARS.find(a => a.id === storedId || a.url?.includes(storedId));
            if (found) return found;
        }
    } catch (e) {}
    return DEFAULT_AVATAR;
};

export const getAvatarData = (avatarId) => {
    if (!avatarId) return AVATARS[0];
    if (typeof avatarId === 'object' && avatarId.url) return avatarId;
    if (typeof avatarId === 'string' && (avatarId.startsWith('/') || avatarId.startsWith('http'))) {
        return { url: avatarId, name: 'Avatar', gradient: 'linear-gradient(135deg, #e50914, #ff3b47)' };
    }
    return AVATARS.find(a => a.id === avatarId || a.url?.includes(avatarId)) || AVATARS[0];
};

// Sync avatar ID with backend database so it updates across all devices
const syncAvatarWithBackend = async (avatarId) => {
    try {
        const token = localStorage.getItem('noxis_auth_token');
        if (!token) return;
        const API_URL = getApiBaseUrl();

        await fetch(`${API_URL}/api/profile/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ avatarId })
        });
    } catch (e) {
        // Fallback to local storage if offline
    }
};

export const setStoredAvatar = (avatarId) => {
    try {
        const key = getStoredAvatarKey();
        localStorage.setItem(key, avatarId);
        syncAvatarWithBackend(avatarId);
    } catch (e) {
        // Fallback
    }
};
