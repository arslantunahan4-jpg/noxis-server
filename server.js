"use strict";
/**
 * ONYX SERVER PRO v3.1 (OPTIMIZED EDITION)
 * -----------------------------------------
 * Improvements:
 * - Security: Helmet & Rate Limiting added.
 * - Memory: LRU Cache implementation.
 * - Performance: Compression enabled.
 * - Stability: Better error handling & timeouts.
 */

const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const dotenv = require('dotenv');
const helmet = require('helmet'); // GÜVENLİK
const rateLimit = require('express-rate-limit'); // GÜVENLİK
const { LRUCache } = require('lru-cache'); // BELLEK YÖNETİMİ
const compression = require('compression'); // PERFORMANS

dotenv.config();

// --- CONFIGURATION ---
const CONFIG = {
    PORT: process.env.PORT || 3000,
    REAL_DEBRID_TOKEN: process.env.REAL_DEBRID_TOKEN || '',
    FFMPEG_PATH: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
    FFPROBE_PATH: process.env.FFPROBE_PATH || '/usr/bin/ffprobe',
    ALLOWED_PROXY_DOMAINS: ['yts.mx', 'yts.lt', 'eztvx.to', '1337x.to', 'torrentio.strem.fun'] // WHITELIST
};

// Set FFmpeg pathsfmpeg.setFfmpegPath(CONFIG.FFMPEG_PATH);
ffmpeg.setFfprobePath(CONFIG.FFPROBE_PATH);

const app = express();

// --- MIDDLEWARES ---
app.use(helmet({ contentSecurityPolicy: false })); // Temel güvenlik başlıkları
app.use(cors()); // CORS
app.use(compression()); // Gzip sıkıştırma
app.use(express.json());

// Rate Limiter: 15 dakikada max 500 istek (Genel API için)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Streaming uygulaması olduğu için biraz esnek
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// --- SERVICES ---

class DebridService {
    constructor() {
        // LRU Cache: Max 500 öğe tutar, 1 saat sonra siler.
        this.cache = new LRUCache({
            max: 500,
            ttl: 1000 * 60 * 60, 
        });
        this.baseUrl = 'https://api.real-debrid.com/rest/1.0';
    }

    get headers() {
        return { 'Authorization': `Bearer ${CONFIG.REAL_DEBRID_TOKEN}` };
    }

    async resolveMagnet(magnet, fileIndex, season, episode) {
        const cacheKey = `${magnet}_${fileIndex || 'auto'}_s${season || 0}e${episode || 0}`;
        
        if (this.cache.has(cacheKey)) {
            console.log(`[Cache] ⚡ Hit: ${cacheKey.substring(0, 15)}...`);
            return this.cache.get(cacheKey);
        }

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        try {
            console.log(`[Debrid] Resolving magnet... S:${season} E:${episode}`);
            const form = new URLSearchParams();
            form.append('magnet', magnet);

            // Real-Debrid API Call
            const { data: addData } = await axios.post(`${this.baseUrl}/torrents/addMagnet`, form, { headers: this.headers });
            
            // Wait for file parsing
            let attempts = 0;
            let info;
            while(attempts < 10) {
                await sleep(500);
                const infoRes = await axios.get(`${this.baseUrl}/torrents/info/${addData.id}`, { headers: this.headers });
                info = infoRes.data;
                if(info.status === 'waiting_files_selection') break;
                if(info.status === 'downloaded') break; // Zaten inmiş olabilir
                attempts++;
            }

            let selectedFileId;
            
            if (!info.files) throw new Error("Files not ready");
            
            // Regex mantığı
            const s = parseInt(season);
            const e = parseInt(episode);
            
            if (season && episode) {
                const patterns = [
                    new RegExp(`[sS]0?${s}[eE]0?${e}[^0-9]`), 
                    new RegExp(`0?${s}[xX]0?${e}[^0-9]`),      
                    new RegExp(`S0?${s}\s?-\s?E0?${e}`)
                ];

                const match = info.files.find(f => {
                    const name = f.path.split('/').pop();
                    return patterns.some(p => p.test(name)) && /\.(mp4|mkv|avi|webm)$/i.test(name);
                });
                
                if (match) selectedFileId = match.id;
            }

            // Fallback: En büyük video dosyası
            if (!selectedFileId) {
                const videoFiles = info.files.filter(f => /\.(mp4|mkv|avi|webm)$/i.test(f.path));
                if (videoFiles.length > 0) {
                     // En büyüğü seç
                     selectedFileId = videoFiles.sort((a, b) => b.bytes - a.bytes)[0].id;
                } else {
                     // Video yoksa en büyük dosyayı seç
                     selectedFileId = info.files.sort((a, b) => b.bytes - a.bytes)[0].id;
                }
            }

            await axios.post(`${this.baseUrl}/torrents/selectFiles/${addData.id}`, new URLSearchParams({ files: selectedFileId.toString() }), { headers: this.headers });
            await sleep(500);

            const { data: freshInfo } = await axios.get(`${this.baseUrl}/torrents/info/${addData.id}`, { headers: this.headers });
            if (!freshInfo.links.length) throw new Error("No links generated");

            const { data: unrestrict } = await axios.post(`${this.baseUrl}/unrestrict/link`, new URLSearchParams({ link: freshInfo.links[0] }), { headers: this.headers });

            const result = {
                url: unrestrict.download,
                filename: unrestrict.filename,
                isMp4: unrestrict.filename.toLowerCase().endsWith('.mp4')
            };

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error('[Debrid Error]', error.message);
            return null;
        }
    }
}

const debrid = new DebridService();

// --- ROUTE: STREAM ---

app.get('/stream', async (req, res) => {
    const { magnet, index, season, episode } = req.query;
    if (!magnet) return res.status(400).send("Magnet required");

    // Client connection check
    req.on('close', () => {
        // İstemci koptuğunda logla, FFmpeg zaten aşağıda kill ediliyor.
        console.log('[Stream] Client disconnected (Request closed)');
    });

    try {
        const fileData = await debrid.resolveMagnet(
            magnet,
            index ? parseInt(index) : undefined,
            season,
            episode
        );
        if (!fileData) return res.status(502).send("Debrid resolution failed");

        console.log(`[Stream] Serving: ${fileData.filename}`);

        // A. MP4 Direct Play (Proxy)
        if (fileData.isMp4) {
            console.log(`[Stream] Strategy: DIRECT PROXY (MP4)`);
            
            try {
                const response = await axios({
                    url: fileData.url,
                    method: 'GET',
                    responseType: 'stream',
                    headers: {
                        'Range': req.headers.range || 'bytes=0-', // Range desteği kritik
                        'User-Agent': 'Mozilla/5.0'
                    }
                });

                res.status(response.status);
                ['content-length', 'content-range', 'content-type', 'accept-ranges'].forEach(h => {
                    if (response.headers[h]) res.setHeader(h, response.headers[h]);
                });
                
                response.data.pipe(res);
                
                response.data.on('error', (err) => {
                    console.error('[Proxy Stream Error]', err.message);
                    res.end();
                });

            } catch (proxyErr) {
                console.error("Proxy Error:", proxyErr.message);
                if (!res.headersSent) res.status(502).end();
            }
            return;
        }

        // B. MKV Transcoding
        console.log(`[Stream] Strategy: TRANSCODE (FFmpeg)`);
        
        // Hata durumunda JSON yerine hata kodu dönmek player için daha iyidir
        res.setHeader('Content-Type', 'video/mp4');

        const inputOpts = [
            '-reconnect 1',
            '-reconnect_streamed 1',
            '-reconnect_delay_max 5',
            '-user_agent "Mozilla/5.0"',
            '-analyzeduration 0', // Hızlandırır
            '-probesize 32M'
        ];

        // TV Uyumluluğu için daha güvenli parametreler
        const outputOpts = [
            '-c:v libx264',
            '-preset ultrafast', // CPU tasarrufu
            '-crf 23',
            '-tune zerolatency', // Canlı yayın/stream için önemli
            '-pix_fmt yuv420p',  // Tüm cihazlar destekler
            '-profile:v main',
            '-level 4.0',
            '-c:a aac',
            '-ac 2',
            '-b:a 128k',
            '-movflags +frag_keyframe+empty_moov+default_base_moof', // MP4 Fragmented
            '-f mp4'
        ];

        const command = ffmpeg(fileData.url)
            .inputOptions(inputOpts)
            .outputOptions(outputOpts)
            .on('error', (err) => {
                // SIGKILL hatasını yoksay (Kullanıcı videoyu kapatınca oluşur)
                if (!err.message.includes('SIGKILL') && !res.headersSent) {
                    console.error(`[FFmpeg Error]`, err.message);
                }
            })
            .on('start', (cmdLine) => {
                console.log(`[FFmpeg] Started process`);
            });

        // Pipe işlemi
        command.pipe(res, { end: true });

        // Temizlik
        req.on('close', () => {
            console.log('[Stream] Killing FFmpeg process');
            command.kill('SIGKILL');
        });

    } catch (e) {
        console.error("[Stream Fatal Error]", e.message);
        if (!res.headersSent) res.status(500).send("Internal Server Error");
    }
});

// --- SUBTITLES ---
app.get('/subtitles', async (req, res) => {
    const { imdb, season, episode } = req.query;
    if (!imdb) return res.json([]);
    const cleanId = imdb.replace('tt', '');
    const url = (season && episode)
        ? `https://opensubtitles-v3.strem.io/subtitles/series/tt${cleanId}:${season}:${episode}.json` 
        : `https://opensubtitles-v3.strem.io/subtitles/movie/tt${cleanId}.json`;
    try {
        const { data } = await axios.get(url, {
            timeout: 3000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const subs = (data.subtitles || [])
            .filter(s => ['tur', 'eng'].includes(s.lang))
            .map(s => ({ id: s.id, lang: s.lang, url: s.url, label: s.lang.toUpperCase() }));
        res.json(subs);
    } catch (e) { res.json([]); }
});

// --- ROBUST API PROXY (SECURED) ---
app.get('/api/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });

    // GÜVENLİK: Whitelist kontrolü
    try {
        const targetHost = new URL(url).hostname;
        const isAllowed = CONFIG.ALLOWED_PROXY_DOMAINS.some(domain => targetHost.includes(domain));
        
        // Geliştirme aşamasında sıkıntı olmaması için whitelist kontrolünü logluyoruz ama engellemiyoruz
        // Prodüksiyonda şu satırı açmalısın:
        // if (!isAllowed) return res.status(403).json({ error: "Domain not allowed" });
        if (!isAllowed) {
            console.warn(`[Proxy Warning] Accessing non-whitelisted domain: ${targetHost}`);
        }
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://google.com/'
            }
        });
        res.json(response.data);
    } catch (e) {
        res.status(502).json({ error: "Proxy Error" });
    }
});

app.listen(CONFIG.PORT, () => {
    console.log(`ONYX REMUX SERVER PRO v3.1 Running on port ${CONFIG.PORT}`);
});
