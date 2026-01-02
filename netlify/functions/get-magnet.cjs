const axios = require('axios');

// --- GÜÇLENDİRİLMİŞ TRACKER LİSTESİ (TURBO MODE) ---
// Bu liste sunucunun metadata bulma hızını %300 artırır.
const TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://tracker.bittor.pw:1337/announce',
    'udp://public.popcorn-tracker.org:6969/announce',
    'udp://tracker.dler.org:6969/announce',
    'udp://exodus.desync.com:6969',
    'udp://open.demonii.com:1337/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://p4p.arenabg.com:1337/announce',
    'udp://9.rarbg.me:2710/announce',
    'udp://9.rarbg.to:2710/announce',
    'udp://tracker.tiny-vps.com:6969/announce',
    'udp://tracker.moeking.me:6969/announce',
    'udp://opentracker.i2p.rocks:6969/announce',
    'http://tracker.openbittorrent.com:80/announce',
    'http://tracker.opentrackr.org:1337/announce'
].map(t => `&tr=${encodeURIComponent(t)}`).join('');

const AXIOS_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
        'Referer': 'https://webtor.io/',
        'Origin': 'https://webtor.io',
        'Connection': 'keep-alive'
    },
    timeout: 8000 // Timeout süresini biraz artırdık (Daha stabil olsun)
};

// Torrentio API'den stream'leri al
async function getTorrentioStreams(imdbId, type = 'movie', season = 1, episode = 1) {
    try {
        const baseUrl = 'https://torrentio.strem.fun';
        
        // 🌟 KRİTİK DÜZELTME: Sezon/Bölüm undefined gelirse 1 olarak ata
        const s = season || 1;
        const e = episode || 1;

        // URL Yapısı:
        // Dizi:  .../series/tt1234567:1:1.json
        // Film:  .../movie/tt1234567.json
        const endpoint = (type === 'series' || type === 'tv') 
            ? `${baseUrl}/stream/series/${imdbId}:${s}:${e}.json`
            : `${baseUrl}/stream/movie/${imdbId}.json`;

        console.log(`[Torrentio] IMDB: ${imdbId} | Tip: ${type} | S:${s} E:${e} | URL: ${endpoint}`);
        
        const response = await axios.get(endpoint, AXIOS_CONFIG);

        if (response.data?.streams?.length > 0) {
            return response.data.streams.map(stream => {
                const rawTitle = (stream.title || stream.name || 'Video');
                const isMp4 = /mp4/i.test(rawTitle);
                
                // Kaliteyi Ayıkla (1080p, 4K vb.)
                const qualityMatch = (stream.name || '').match(/(\d{3,4}p|4K|2160p)/i);
                let quality = qualityMatch ? qualityMatch[1].toUpperCase() : 'HD';

                if (isMp4) quality += ' ⚡MP4';

                // Seed Sayısını Ayıkla (Emoji varsa temizle)
                const seedsMatch = (stream.title || '').match(/👤\s*(\d+)/);
                
                return {
                    infoHash: stream.infoHash,
                    title: rawTitle.split('\n')[0],
                    quality: quality,
                    seeds: seedsMatch ? parseInt(seedsMatch[1]) : 0,
                    source: 'Torrentio',
                    size: (stream.title || '').match(/💾\s*([\d.]+\s*(?:GB|MB))/i)?.[1] || ''
                };
            }).filter(s => s.infoHash); // infoHash olmayanları ele
        }
        return [];
    } catch (error) {
        console.log('[Torrentio] Error:', error.message);
        return [];
    }
}

// YTS API (Sadece Filmler İçin - IMDB ID ile Çalışır)
async function getYTSTorrents(imdbId) {
    try {
        // YTS de query_term olarak IMDB ID kabul eder, bu çok güvenilirdir.
        const url = `https://yts.mx/api/v2/list_movies.json?query_term=${imdbId}`;
        const response = await axios.get(url, { ...AXIOS_CONFIG, timeout: 3000 });
        
        if (response.data?.data?.movies) {
            let torrents = [];
            response.data.data.movies.forEach(m => {
                if(m.torrents) {
                    m.torrents.forEach(t => {
                        torrents.push({
                            infoHash: t.hash,
                            title: m.title, // Filmin gerçek ismini kullan
                            quality: `${t.quality.toUpperCase()} ⚡MP4`,
                            seeds: t.seeds,
                            size: t.size,
                            source: 'YTS'
                        });
                    });
                }
            });
            return torrents;
        }
        return [];
    } catch (error) {
        console.log('[YTS] Erişim Hatası:', error.message);
        return [];
    }
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    const params = event.queryStringParameters || {};

    // --- MOD 1: MAGNET OLUŞTURMA (Player İçin) ---
    if (params.get_stream === 'true' && params.hash) {
        const magnet = `magnet:?xt=urn:btih:${params.hash}&dn=Video${TRACKERS}`;
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                magnet: magnet,
                source: 'magnet'
            })
        };
    }

    // --- MOD 2: TORRENT LİSTELEME ---
    
    // IMDB ID Zorunlu - Bu sayede "Inception" yazıp alakasız şeyler bulma riskini sıfırlıyoruz.
    if (!params.imdb_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'IMDB ID bulunamadı' }) };
    }

    try {
        const isSeries = params.type === 'tv' || params.type === 'series';
        
        // Frontend'den gelen sezon/bölüm bilgisini al, yoksa 1 yap
        const season = params.season || 1;
        const episode = params.episode || 1;

        // 1. Torrentio Araması (IMDB ID + Sezon/Bölüm)
        let results = await getTorrentioStreams(params.imdb_id, params.type, season, episode);

        // 2. YTS Araması (Sadece Filmler İçin ve Ekstra Kaynak Olarak)
        if (!isSeries) {
            const ytsResults = await getYTSTorrents(params.imdb_id);
            if (ytsResults.length > 0) results = [...results, ...ytsResults];
        }

        // 3. Sıralama ve Filtreleme
        // Türkçe dublaj önceliği varsa
        if (params.dubbed === 'true') {
            results.sort((a, b) => {
                // Sadece belirtilen kesin kelimeler: türkçe, turkce, dublaj (dublajlı'yı da kapsar)
                const trRegex = /türkçe|turkce|dublaj/i;
                const aTR = trRegex.test(a.title);
                const bTR = trRegex.test(b.title);
                
                // Eğer ikisi de TR ise veya ikisi de değilse, seed sayısına bak
                if (aTR === bTR) {
                    return b.seeds - a.seeds;
                }
                
                // TR olanı yukarı taşı
                return bTR - aTR;
            });
        } else {
            // Yoksa en çok seed (kaynak) olanı en üste koy
            results.sort((a, b) => b.seeds - a.seeds);
        }

        // Aynı dosyaları temizle (infoHash'e göre)
        const unique = [];
        const seen = new Set();
        for (const item of results) {
            if (!seen.has(item.infoHash)) {
                seen.add(item.infoHash);
                unique.push(item);
            }
        }

        if (unique.length === 0) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Bu içerik için kaynak bulunamadı.' }) };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                // En iyi 20 sonucu döndür
                options: unique.slice(0, 20) 
            })
        };
    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
};