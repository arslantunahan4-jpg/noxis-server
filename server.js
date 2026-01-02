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
app.set('trust proxy', 1); // Enable trust proxy for rate limiter

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
        
        // --- GÜVENLİK: API Rate Limiter ---
        // Real-Debrid limitlerine takılmamak için istekler arasına zorunlu bekleme koyuyoruz.
        this.lastCallTime = 0;
        this.minDelay = 600; // Her istek arası minimum 600ms (Güvenli Bölge)
    }

    get headers() {
        return { 
            'Authorization': `Bearer ${CONFIG.REAL_DEBRID_TOKEN}`,
            'User-Agent': 'NoxisStreamingApp/1.0' // RD'ye kimliğimizi açıkça belirtiyoruz
        };
    }

    // Güvenli İstek Yöneticisi (Rate Limit & Retry)
    async _safeRequest(method, endpoint, body = null, retries = 3) {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        
        // Rate Limiting Enforce
        const now = Date.now();
        const timeSinceLast = now - this.lastCallTime;
        if (timeSinceLast < this.minDelay) {
            await sleep(this.minDelay - timeSinceLast);
        }
        this.lastCallTime = Date.now();

        try {
            const opts = { headers: this.headers };
            let response;
            
            if (method === 'POST') response = await axios.post(`${this.baseUrl}${endpoint}`, body, opts);
            else response = await axios.get(`${this.baseUrl}${endpoint}`, opts);

            return response.data;
        } catch (error) {
            // Eğer Rate Limit (429) veya Server Hatası (503) ise bekle ve tekrar dene
            if (retries > 0 && (error.response?.status === 429 || error.response?.status >= 500)) {
                console.warn(`[Debrid] Rate Limit/Error (${error.response?.status}). Retrying...`);
                await sleep(2000); // 2 saniye bekle
                return this._safeRequest(method, endpoint, body, retries - 1);
            }
            throw error;
        }
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

            // GÜVENLİ API ÇAĞRISI
            const addData = await this._safeRequest('POST', '/torrents/addMagnet', form);
            
            // Wait for file parsing
            let attempts = 0;
            let info;
            while(attempts < 15) { // Deneme sayısını artırdık
                await sleep(1000); // Bekleme süresini artırdık (API spam'i önlemek için)
                info = await this._safeRequest('GET', `/torrents/info/${addData.id}`);
                
                if(info.status === 'waiting_files_selection') break;
                if(info.status === 'downloaded') break; 
                attempts++;
            }

            let selectedFileId;
            
            if (!info || !info.files) throw new Error("Files not ready");
            
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

            // Dosya seçimi
            await this._safeRequest('POST', `/torrents/selectFiles/${addData.id}`, new URLSearchParams({ files: selectedFileId.toString() }));
            await sleep(500);

            const freshInfo = await this._safeRequest('GET', `/torrents/info/${addData.id}`);
            if (!freshInfo.links.length) throw new Error("No links generated");

            // Unrestrict Link
            const unrestrict = await this._safeRequest('POST', '/unrestrict/link', new URLSearchParams({ link: freshInfo.links[0] }));

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

        // B. MKV Transcoding (Smart Remux)
        console.log(`[Stream] Strategy: TRANSCODE (FFmpeg)`);
        
        // Hata durumunda JSON yerine hata kodu dönmek player için daha iyidir
        res.setHeader('Content-Type', 'video/mp4');

        // 1. Probe & Analyze
        let inputArgs = [
            '-reconnect 1', 
            '-reconnect_streamed 1', 
            '-reconnect_delay_max 5',
            '-user_agent "Mozilla/5.0"',
            '-analyzeduration 10000000', // 10s analysis
            '-probesize 10000000'
        ];

        // Seek Support (Query Param)
        const { startTime } = req.query;
        if (startTime) {
            console.log(`[Stream] Seeking to: ${startTime}s`);
            inputArgs.push(`-ss ${startTime}`);
        }

        const outputArgs = [
            '-movflags +frag_keyframe+empty_moov+default_base_moof',
            '-f mp4',
            '-preset ultrafast',
            '-tune zerolatency'
        ];

        // Codec Selection
        let vCodec = 'libx264';
        let aCodec = 'aac';
        
        try {
            const metadata = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(fileData.url, (err, data) => {
                    if (err) reject(err); else resolve(data);
                });
            });

            console.log('[Stream] Probe Data:', JSON.stringify(metadata.streams.map(s => ({ type: s.codec_type, codec: s.codec_name, pix_fmt: s.pix_fmt })), null, 2));

            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

            // Browser Compatibility Check: Only copy H.264 8-bit (yuv420p)
            if (videoStream && videoStream.codec_name === 'h264' && videoStream.pix_fmt === 'yuv420p') {
                console.log('[Stream] Video Codec: H264 8-bit (Copy)');
                vCodec = 'copy';
            } else {
                console.log(`[Stream] Video Codec: ${videoStream?.codec_name} (${videoStream?.pix_fmt}) -> Transcoding to H264 8-bit`);
                outputArgs.push('-crf 23', '-profile:v main', '-level 4.0', '-pix_fmt yuv420p');
            }

            if (audioStream && (audioStream.codec_name === 'aac' || audioStream.codec_name === 'mp3')) {
                console.log(`[Stream] Audio Codec: ${audioStream.codec_name} (Copy)`);
                aCodec = 'copy';
            } else {
                console.log(`[Stream] Audio Codec: ${audioStream?.codec_name} (Transcode)`);
                outputArgs.push('-ac 2', '-b:a 128k');
            }

        } catch (probeErr) {
            console.warn('[Stream] Probe failed, defaulting to Transcode', probeErr.message);
            outputArgs.push('-crf 23', '-pix_fmt yuv420p', '-ac 2', '-b:a 128k');
        }

        outputArgs.unshift(`-c:v ${vCodec}`);
        outputArgs.push(`-c:a ${aCodec}`);

        console.log('[Stream] FFmpeg Output Args:', outputArgs.join(' '));

        const command = ffmpeg(fileData.url)
            .inputOptions(inputArgs)
            .outputOptions(outputArgs)
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
            .filter(s => ['tur'].includes(s.lang))
            .map(s => ({ id: s.id, lang: s.lang, url: s.url, label: s.lang.toUpperCase() }));
        res.json(subs);
    } catch (e) { res.json([]); }
});

// --- SUBTITLE PROXY (FIX CORS & ROBUST VTT CONVERSION WITH OFFSET) ---
app.get('/subtitle-proxy', async (req, res) => {
    const { url, offset } = req.query;
    if (!url) return res.status(400).send("URL required");

    const timeOffset = parseFloat(offset) || 0;

    try {
        const response = await axios.get(url, {
            responseType: 'text',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        let content = response.data;
        if (typeof content !== 'string') content = content.toString();

        // 1. Remove BOM
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

        // 2. Normalize Line Endings
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Helper to shift timestamp
        const shiftTime = (match, p1, p2, p3, p4) => {
            if (!timeOffset) return match;
            
            const hours = parseInt(p1);
            const minutes = parseInt(p2);
            const seconds = parseInt(p3);
            const ms = parseInt(p4);

            let totalMs = (hours * 3600000) + (minutes * 60000) + (seconds * 1000) + ms;
            totalMs += (timeOffset * 1000);

            if (totalMs < 0) totalMs = 0;

            const h = Math.floor(totalMs / 3600000);
            const m = Math.floor((totalMs % 3600000) / 60000);
            const s = Math.floor((totalMs % 60000) / 1000);
            const newMs = totalMs % 1000;

            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${newMs.toString().padStart(3, '0')}`;
        };

        // 3. SRT to VTT Conversion & Shifting
        // Regex for SRT timestamp: 00:00:20,000 --> 00:00:22,000
        const srtRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/g;
        
        // Regex for VTT timestamp: 00:00:20.000
        const vttRegex = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})/g;

        if (!content.trim().startsWith('WEBVTT')) {
            // SRT -> VTT
            content = 'WEBVTT\n\n' + content.replace(srtRegex, (match, h, m, s, ms) => {
                // First shift, then format with dot
                if (timeOffset !== 0) {
                     return shiftTime(match, h, m, s, ms);
                }
                return `${h}:${m}:${s}.${ms}`;
            });
        } else {
            // VTT -> VTT (Just shift)
            if (timeOffset !== 0) {
                content = content.replace(vttRegex, (match, h, m, s, ms) => shiftTime(match, h, m, s, ms));
            }
             // Ensure blank line
             if (!content.startsWith('WEBVTT\n\n') && content.startsWith('WEBVTT\n')) {
                 content = content.replace('WEBVTT\n', 'WEBVTT\n\n');
             }
        }

        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache'); // Don't cache offset versions
        res.send(content);

    } catch (e) {
        console.error("[Subtitle Proxy Error]", e.message);
        res.status(502).send("Error fetching subtitle");
    }
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
