import { ghostScrape } from './ghostScraper.js';

// Site tanimlari ve URL yapilari
const SITES = [
    {
        name: 'yabancidizibox',
        priority: 1,
        getUrl: (slug, s, e) => `https://yabancidizibox.com/dizi/${slug}-${s}-sezon-${e}-bolum-izle`
    },
    {
        name: 'hdfilmcehennemi',
        priority: 0,
        getUrl: (slug, s, e) => {
            if (s && e) {
                return `https://www.hdfilmcehennemi.nl/dizi/${slug}-sezon-${s}-bolum-${e}`;
            }

            return `https://www.hdfilmcehennemi.nl/film/${slug}`;
        }
    },
    {
        name: 'hdfilmizle',
        priority: 2,
        getUrl: (slug, s, e) => `https://www.hdfilmizle.life/dizi/${slug}/sezon-${s}/bolum-${e}/`
    }
];

const createSlug = (text) => String(text || '')
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/&/g, '-')
    .replace(/\+/g, '-')
    .replace(/\//g, '-')
    .replace(/\\/g, '-')
    .replace(/\|/g, '-')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const findSource = async (title, season, episode) => {
    const slug = createSlug(title);
    console.log(`[Scraper] Kaynak araniyor: ${title} (${slug}) S${season}E${episode}`);

    const sortedSites = [...SITES].sort((a, b) => a.priority - b.priority);

    for (const site of sortedSites) {
        const targetUrl = site.getUrl(slug, season, episode);
        console.log(`Attempting: ${site.name} -> ${targetUrl}`);

        const videoUrl = await ghostScrape(targetUrl);
        if (!videoUrl) continue;

        console.log(`[Scraper] Bulundu (${site.name}): ${videoUrl}`);
        return {
            source: site.name,
            url: videoUrl,
            originalUrl: targetUrl
        };
    }

    console.log('[Scraper] Hicbir kaynakta bulunamadi.');
    return null;
};
