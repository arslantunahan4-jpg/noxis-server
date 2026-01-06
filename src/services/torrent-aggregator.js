/**
 * Torrent Aggregator Service
 * 
 * Multi-source torrent search with health filtering and caching.
 * Sources: Torrentio API, YTS API, 1337x (fallback)
 */

import axios from 'axios';

// --- CONFIGURATION ---
const CONFIG = {
    TORRENTIO_BASE: 'https://torrentio.strem.fun',
    YTS_MIRRORS: ['https://yts.mx', 'https://yts.lt', 'https://yts.ag'],
    EZTV_API: 'https://eztvx.to/api/get-torrents',
    APIBAY_API: 'https://apibay.org/q.php',
    USE_PROXY: true, // Force use of backend proxy for APIs
    CACHE_TTL: 5 * 60 * 1000, // 5 minutes
    MIN_SEEDS: 1, // Minimum seeds for quality filter
    REQUEST_TIMEOUT: 15000,
    TRACKERS: [
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://open.stealth.si:80/announce',
        'udp://tracker.openbittorrent.com:6969/announce',
        'udp://p4p.arenabg.com:1337',
        'udp://tracker.torrent.eu.org:451/announce',
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.btorrent.xyz'
    ]
};

// --- IN-MEMORY CACHE ---
const cache = new Map();

function getCached(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
        cache.delete(key);
        return null;
    }
    return item.data;
}

function setCache(key, data) {
    cache.set(key, {
        data,
        expiry: Date.now() + CONFIG.CACHE_TTL
    });
}

// --- TORRENT RESULT FORMAT ---
/**
 * @typedef {Object} TorrentResult
 * @property {string} infoHash - BitTorrent info hash
 * @property {string} title - Torrent title
 * @property {string} quality - Video quality (720p, 1080p, 4K, etc.)
 * @property {number} seeds - Number of seeders
 * @property {number} leechers - Number of leechers
 * @property {string} size - File size string
 * @property {string} source - Source name (Torrentio, YTS, 1337x)
 * @property {string} magnetUri - Complete magnet URI with trackers
 */

// --- MAGNET URI BUILDER ---
function buildMagnetUri(infoHash, title = 'Video') {
    const trackerQuery = CONFIG.TRACKERS
        .map(t => `&tr=${encodeURIComponent(t)}`)
        .join('');
    return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}${trackerQuery}`;
}

// --- TORRENTIO API ---
async function searchTorrentio(imdbId, type = 'movie', season = null, episode = null) {
    try {
        let endpoint;
        if (type === 'series' || type === 'tv') {
            endpoint = `${CONFIG.TORRENTIO_BASE}/stream/series/${imdbId}:${season}:${episode}.json`;
        } else {
            endpoint = `${CONFIG.TORRENTIO_BASE}/stream/movie/${imdbId}.json`;
        }

        console.log(`[Torrentio] Fetching: ${endpoint}`);
        const response = await axios.get(endpoint, { timeout: CONFIG.REQUEST_TIMEOUT });

        if (!response.data?.streams?.length) {
            console.log('[Torrentio] No streams found');
            return [];
        }

        return response.data.streams.map(stream => {
            const name = stream.name || '';
            const title = stream.title || '';

            // Parse quality from name (e.g., "Torrentio\n1080p")
            const qualityMatch = name.match(/(\d{3,4}p|4K|2160p)/i);
            let quality = qualityMatch ? qualityMatch[1].toUpperCase() : 'Unknown';

            // Detect MP4
            // Strict check: Must end with .mp4 (handling potential metadata after newline in Torrentio titles)
            const cleanTitle = title.split('\n')[0].trim();
            if (/\.mp4$/i.test(cleanTitle)) {
                quality += ' MP4';
            }

            // Parse seeds from title emoji format 👤 123
            const seedMatch = title.match(/👤\s*(\d+)/);
            const seeds = seedMatch ? parseInt(seedMatch[1]) : 0;

            // Parse size from title 💾 2.1 GB
            const sizeMatch = title.match(/💾\s*([\d.]+\s*(?:GB|MB))/i);
            const size = sizeMatch ? sizeMatch[1] : 'Unknown';

            return {
                infoHash: stream.infoHash,
                title: title.split('\n')[0] || name,
                quality,
                seeds,
                leechers: 0,
                size,
                source: 'Torrentio',
                magnetUri: buildMagnetUri(stream.infoHash, title)
            };
        }).filter(t => t.infoHash && t.seeds >= CONFIG.MIN_SEEDS);

    } catch (error) {
        console.log(`[Torrentio] Error: ${error.message}`);
        return [];
    }
}

// --- EZTV API (Series Only) ---
async function searchEZTV(imdbId, season, episode) {
    try {
        const cleanId = imdbId.replace('tt', '');
        const url = `${CONFIG.EZTV_API}?imdb_id=${cleanId}&limit=100`;
        console.log(`[EZTV] Fetching: ${url}`);
        
        const response = await axios.get(url, { timeout: CONFIG.REQUEST_TIMEOUT });
        
        if (!response.data?.torrents) return [];

        return response.data.torrents
            .filter(t => {
                if (!t.season || !t.episode) return false;
                return parseInt(t.season) === parseInt(season) && parseInt(t.episode) === parseInt(episode);
            })
            .map(t => {
                // Detect quality from title/filename
                const qualityMatch = (t.title || '').match(/(\d{3,4}p|4K|2160p)/i);
                let quality = qualityMatch ? qualityMatch[1].toUpperCase() : 'HD';
                
                // Strict MP4 check
                if (/\.mp4$/i.test(t.filename) || /\.mp4$/i.test(t.title)) quality += ' MP4';

                return {
                    infoHash: t.hash,
                    title: t.title || t.filename,
                    quality,
                    seeds: t.seeds || 0,
                    leechers: t.peers || 0,
                    size: t.size_bytes ? (t.size_bytes / 1024 / 1024).toFixed(0) + ' MB' : 'Unknown',
                    source: 'EZTV',
                    magnetUri: t.magnet_url || buildMagnetUri(t.hash, t.title)
                };
            })
            .filter(t => t.seeds >= CONFIG.MIN_SEEDS);

    } catch (error) {
        console.log(`[EZTV] Error: ${error.message}`);
        return [];
    }
}

// --- THE PIRATE BAY (via APIBAY) ---
async function searchPirateBay(imdbId, type = 'movie', season = null, episode = null) {
    try {
        // APIBay usually works best with IMDB ID (e.g., tt1234567)
        // For series, we might need to filter manually if the API returns mixed results
        const url = `${CONFIG.APIBAY_API}?q=${imdbId}`;
        console.log(`[TPB] Fetching: ${url}`);
        
        const response = await axios.get(url, { timeout: CONFIG.REQUEST_TIMEOUT });
        const results = response.data;

        if (!Array.isArray(results) || results.length === 0 || results[0].id === '0') return [];

        let matches = results;

        // If Series, Filter by SxxExx
        if ((type === 'series' || type === 'tv') && season && episode) {
            const s = season.toString().padStart(2, '0');
            const e = episode.toString().padStart(2, '0');
            const regex = new RegExp(`S${s}E${e}|${season}x${e}|Season\\s*${season}`, 'i');
            matches = matches.filter(item => regex.test(item.name));
        }

        return matches.map(item => {
             const qualityMatch = item.name.match(/(\d{3,4}p|4K|2160p)/i);
             let quality = qualityMatch ? qualityMatch[1].toUpperCase() : 'Unknown';
             // Strict MP4 Check
             if (/\.mp4$/i.test(item.name)) quality += ' MP4';

             return {
                 infoHash: item.info_hash,
                 title: item.name,
                 quality,
                 seeds: parseInt(item.seeders),
                 leechers: parseInt(item.leechers),
                 size: (parseInt(item.size) / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                 source: 'TPB',
                 magnetUri: buildMagnetUri(item.info_hash, item.name)
             };
        }).filter(t => t.seeds >= CONFIG.MIN_SEEDS);

    } catch (error) {
        console.log(`[TPB] Error: ${error.message}`);
        return [];
    }
}

// --- YTS API (Movies Only) ---
async function searchYTS(imdbId) {
    let movies = [];
    const proxyBase = localStorage.getItem('noxis_api_url') || import.meta.env.VITE_API_URL || "http://localhost:3000";

    for (const domain of CONFIG.YTS_MIRRORS) {
        try {
            const rawUrl = `${domain}/api/v2/list_movies.json?query_term=${imdbId}`;
            const targetUrl = `${proxyBase}/api/proxy?url=${encodeURIComponent(rawUrl)}`;

            console.log(`[YTS] Fetching via Proxy: ${targetUrl}`);
            const response = await axios.get(targetUrl, { timeout: CONFIG.REQUEST_TIMEOUT });

            if (response.data?.data?.movies?.[0]) {
                const movie = response.data.data.movies[0];
                const torrents = movie.torrents || [];

                return torrents.map(t => ({
                    infoHash: t.hash,
                    title: movie.title,
                    quality: (t.quality || 'Unknown') + ' YTS',
                    seeds: t.seeds || 0,
                    leechers: t.peers || 0,
                    size: t.size || 'Unknown',
                    source: 'YTS',
                    magnetUri: buildMagnetUri(t.hash, movie.title)
                })).filter(t => t.seeds >= CONFIG.MIN_SEEDS);
            }
        } catch (error) {
            console.log(`[YTS] Error on ${domain}: ${error.message}`);
        }
    }
    return [];
}

// --- MAIN AGGREGATOR FUNCTION ---
/**
 * Search for torrents across multiple sources
 * @param {string} imdbId - IMDB ID (e.g., tt0816692)
 * @param {string} type - Content type: 'movie' or 'tv'
 * @param {number} season - Season number (for TV)
 * @param {number} episode - Episode number (for TV)
 * @returns {Promise<TorrentResult[]>} - Sorted array of torrent results
 */
export async function searchTorrents(imdbId, type = 'movie', season = null, episode = null) {
    // Check cache first
    const cacheKey = `${imdbId}:${type}:${season}:${episode}`;
    const cached = getCached(cacheKey);
    if (cached) {
        console.log(`[Aggregator] Cache hit for ${cacheKey}`);
        return cached;
    }

    console.log(`[Aggregator] Starting search for ${imdbId} (${type})`);
    const isSeries = type === 'tv' || type === 'series';

    // Parallel search
    const searchPromises = [
        searchTorrentio(imdbId, type, season, episode),
        searchPirateBay(imdbId, type, season, episode)
    ];

    // YTS only for movies
    if (!isSeries) {
        searchPromises.push(searchYTS(imdbId));
    } else {
        // EZTV only for Series
        searchPromises.push(searchEZTV(imdbId, season, episode));
    }

    const results = await Promise.allSettled(searchPromises);

    // Flatten and combine results
    let allTorrents = [];
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            allTorrents = [...allTorrents, ...result.value];
        }
    }

    // Remove duplicates by infoHash
    const seen = new Set();
    allTorrents = allTorrents.filter(t => {
        if (seen.has(t.infoHash)) return false;
        seen.add(t.infoHash);
        return true;
    });

    // === SMART SORTING ALGORITHM ===
    // Priority Order:
    // 1. MP4 format (direct play, no transcoding)
    // 2. H.264/x264 codec (universal compatibility)
    // 3. High seeds
    // 4. 1080p quality preferred
    // 5. For movies: YTS source priority
    
    allTorrents.sort((a, b) => {
        const titleA = (a.title || '').toUpperCase();
        const titleB = (b.title || '').toUpperCase();
        const qualityA = (a.quality || '').toUpperCase();
        const qualityB = (b.quality || '').toUpperCase();
        
        // --- 1. MP4 Priority (Highest) ---
        const isMP4_A = qualityA.includes('MP4') || titleA.includes('.MP4');
        const isMP4_B = qualityB.includes('MP4') || titleB.includes('.MP4');
        if (isMP4_A && !isMP4_B) return -1;
        if (!isMP4_A && isMP4_B) return 1;
        
        // --- 2. H.264/x264 Priority (Second) ---
        const isH264_A = titleA.includes('X264') || titleA.includes('H264') || titleA.includes('H.264') || titleA.includes('AVC');
        const isH264_B = titleB.includes('X264') || titleB.includes('H264') || titleB.includes('H.264') || titleB.includes('AVC');
        if (isH264_A && !isH264_B) return -1;
        if (!isH264_A && isH264_B) return 1;
        
        // --- 3. For Movies: YTS Priority ---
        if (!isSeries) {
            const isYTS_A = a.source === 'YTS';
            const isYTS_B = b.source === 'YTS';
            if (isYTS_A && !isYTS_B) return -1;
            if (!isYTS_A && isYTS_B) return 1;
        }
        
        // --- 4. Quality Priority (1080p > 720p > 4K > others) ---
        // 4K requires more bandwidth, so 1080p is preferred for compatibility
        const getQualityScore = (quality) => {
            if (quality.includes('1080')) return 4;
            if (quality.includes('720')) return 3;
            if (quality.includes('4K') || quality.includes('2160')) return 2;
            if (quality.includes('480') || quality.includes('360')) return 1;
            return 0;
        };
        const qualityScoreA = getQualityScore(qualityA);
        const qualityScoreB = getQualityScore(qualityB);
        if (qualityScoreA !== qualityScoreB) return qualityScoreB - qualityScoreA;
        
        // --- 5. Seeds (Higher is better) ---
        if (b.seeds !== a.seeds) return b.seeds - a.seeds;
        
        // --- 6. Avoid x265/HEVC (less compatible) ---
        const isHEVC_A = titleA.includes('X265') || titleA.includes('HEVC') || titleA.includes('H265');
        const isHEVC_B = titleB.includes('X265') || titleB.includes('HEVC') || titleB.includes('H265');
        if (isHEVC_A && !isHEVC_B) return 1;  // Push HEVC down
        if (!isHEVC_A && isHEVC_B) return -1;
        
        return 0;
    });

    console.log(`[Aggregator] Smart sorted ${allTorrents.length} torrents`);
    
    // Log top 3 for debugging
    if (allTorrents.length > 0) {
        console.log('[Aggregator] Top picks:');
        allTorrents.slice(0, 3).forEach((t, i) => {
            console.log(`  ${i + 1}. ${t.quality} | ${t.seeds} seeds | ${t.source} | ${t.title?.substring(0, 50)}...`);
        });
    }

    // Cache results
    if (allTorrents.length > 0) {
        setCache(cacheKey, allTorrents);
    }

    console.log(`[Aggregator] Found ${allTorrents.length} torrents`);
    return allTorrents;
}

// --- EXPORT CONFIG FOR EXTERNAL USE ---
export { CONFIG, buildMagnetUri };
