"use strict";
/**
 * ONYX SERVER PRO v3.0 (DIRECT REMUX EDITION)
 * -----------------------------------------
 * Features:
 * 1. Direct Stream: No HLS overhead, single connection.
 * 2. Smart Proxy: MP4s are proxied directly (Zero CPU).
 * 3. Live Remux: MKVs are converted to MP4 container on-the-fly (Low CPU).
 * 4. Stability: Best for long-duration playback without segmentation glitches.
 */

const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// --- CONFIGURATION ---
const CONFIG = {
    PORT: process.env.PORT || 3000,
    REAL_DEBRID_TOKEN: process.env.REAL_DEBRID_TOKEN || '',
    FFMPEG_PATH: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
    FFPROBE_PATH: process.env.FFPROBE_PATH || '/usr/bin/ffprobe',
};

// Set FFmpeg paths
ffmpeg.setFfmpegPath(CONFIG.FFMPEG_PATH);
ffmpeg.setFfprobePath(CONFIG.FFPROBE_PATH);

const app = express();
app.use(cors());
app.use(express.json());

// --- SERVICES ---

class DebridService {
    constructor() {
        this.cache = new Map();
        this.baseUrl = 'https://api.real-debrid.com/rest/1.0';
    }

    get headers() {
        return { 'Authorization': `Bearer ${CONFIG.REAL_DEBRID_TOKEN}` };
    }

    async resolveMagnet(magnet, fileIndex) {
        const cacheKey = `${magnet}_${fileIndex || 0}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < 3600000)) {
            console.log(`[Cache] ⚡ Hit: ${cacheKey.substring(0, 15)}...`);
            return cached.data;
        }

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        try {
            console.log(`[Debrid] Resolving magnet...`);
            const form = new URLSearchParams();
            form.append('magnet', magnet);

            const { data: addData } = await axios.post(`${this.baseUrl}/torrents/addMagnet`, form, { headers: this.headers });
            await sleep(500);

            const { data: info } = await axios.get(`${this.baseUrl}/torrents/info/${addData.id}`, { headers: this.headers });

            let selectedFileId;
            if (fileIndex !== undefined && info.files[fileIndex]) {
                selectedFileId = info.files[fileIndex].id;
            } else {
                const videoFile = info.files.find(f => /\.(mp4|mkv|avi|webm)$/i.test(f.path))
                    || info.files.sort((a, b) => b.bytes - a.bytes)[0];
                if (!videoFile) throw new Error("No video file found");
                selectedFileId = videoFile.id;
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

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
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
    const { magnet, index } = req.query;
    if (!magnet) return res.status(400).send("Magnet required");

    try {
        console.log(`[Stream] Init...`);
        const fileData = await debrid.resolveMagnet(magnet, index ? parseInt(index) : undefined);
        if (!fileData) return res.status(502).send("Debrid failed");

        console.log(`[Stream] Source: ${fileData.filename}`);

        // A. MP4 Direct Play (Perfect Seeking, Zero Server CPU)
        if (fileData.isMp4) {
            console.log(`[Stream] Mode: DIRECT PROXY (MP4)`);
            const headers = {
                'User-Agent': 'Mozilla/5.0',
                'Connection': 'keep-alive'
            };
            if (req.headers.range) headers['Range'] = req.headers.range;

            try {
                const response = await axios({
                    url: fileData.url,
                    method: 'GET',
                    responseType: 'stream',
                    headers
                });

                res.status(response.status);
                ['content-length', 'content-range', 'content-type', 'accept-ranges'].forEach(h => {
                    if (response.headers[h]) res.setHeader(h, response.headers[h]);
                });
                response.data.pipe(res);
            } catch (proxyErr) {
                console.error("Proxy Error:", proxyErr.message);
                res.status(502).end();
            }
            return;
        }

        // B. MKV/AVI -> MP4 Remuxing (with H.265 auto-transcode)
        console.log(`[Stream] Mode: LIVE REMUX (detecting codec...)`);

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Probe the file to detect codec
        ffmpeg.ffprobe(fileData.url, (probeErr, metadata) => {
            if (probeErr) {
                console.error('[Probe Error]', probeErr.message);
                // Fallback to copy mode if probe fails
                startStream(false);
                return;
            }

            const videoStream = metadata?.streams?.find(s => s.codec_type === 'video');
            const videoCodec = videoStream?.codec_name?.toLowerCase() || '';
            const isHEVC = ['hevc', 'h265', 'h.265'].includes(videoCodec);

            console.log(`[Stream] Detected codec: ${videoCodec} | HEVC: ${isHEVC}`);
            startStream(isHEVC);
        });

        function startStream(needsTranscode) {
            const inputOpts = [
                '-reconnect 1',
                '-reconnect_streamed 1',
                '-reconnect_delay_max 5',
                '-user_agent "Mozilla/5.0"',
                '-analyzeduration 0',
                '-probesize 32M'
            ];

            let outputOpts;
            if (needsTranscode) {
                // H.265 -> H.264 Transcode (Browser Compatible)
                console.log(`[Stream] ⚡ TRANSCODING H.265 -> H.264`);
                outputOpts = [
                    '-c:v libx264',      // Transcode to H.264
                    '-preset ultrafast', // Fastest encoding (lowest CPU)
                    '-crf 23',           // Quality (18-28, lower = better)
                    '-tune zerolatency', // Low latency streaming
                    '-c:a aac',          // AAC audio for compatibility
                    '-b:a 192k',
                    '-movflags +frag_keyframe+empty_moov+default_base_moof',
                    '-f mp4'
                ];
            } else {
                // Direct remux (Zero CPU)
                console.log(`[Stream] ✅ REMUX MODE (copy codec)`);
                outputOpts = [
                    '-c:v copy',
                    '-c:a copy',
                    '-movflags +frag_keyframe+empty_moov+default_base_moof',
                    '-f mp4'
                ];
            }

            const command = ffmpeg(fileData.url)
                .inputOptions(inputOpts)
                .outputOptions(outputOpts)
                .on('error', (err) => {
                    if (!err.message.includes('SIGKILL') && !res.headersSent) {
                        console.error(`[FFmpeg Error]`, err.message);
                    }
                })
                .on('start', (cmdLine) => {
                    console.log(`[FFmpeg] Started: ${cmdLine.substring(0, 150)}...`);
                });

            command.pipe(res, { end: true });

            req.on('close', () => {
                console.log('[Stream] Client disconnected, killing FFmpeg');
                command.kill('SIGKILL');
            });
        }

    } catch (e) {
        console.error("[Stream Error]", e.message);
        if (!res.headersSent) res.status(500).send("Server Error");
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
        const { data } = await axios.get(url, { timeout: 3000 });
        const subs = (data.subtitles || [])
            .filter(s => ['tur', 'eng'].includes(s.lang))
            .map(s => ({ id: s.id, lang: s.lang, url: s.url, label: s.lang.toUpperCase() }));
        res.json(subs);
    } catch (e) { res.json([]); }
});

app.get('/subtitle-proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL required");

    try {
        const response = await axios.get(url, { responseType: 'text' });
        // Robust SRT to VTT conversion:
        // 1. Ensure WEBVTT header exists.
        // 2. Convert comma timestamps (00:00:00,000) to dots (00:00:00.000).
        let content = response.data;
        if (!content.trim().startsWith('WEBVTT')) {
            content = 'WEBVTT\n\n' + content;
        }
        content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

        res.setHeader('Content-Type', 'text/vtt');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(content);
    } catch (e) {
        console.error("Subtitle Proxy Error:", e.message);
        res.status(500).send("Error");
    }
});

// --- ROBUST API PROXY (Tunnel for YTS/Blocked Sites) ---
app.get('/api/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });

    try {
        console.log(`[Proxy] Requesting: ${url}`);
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://yts.mx/'
            }
        });
        res.json(response.data);
    } catch (e) {
        console.error(`[Proxy] Error: ${e.message}`);
        res.status(502).json({ error: "Proxy Request Failed", details: e.message });
    }
});

app.listen(CONFIG.PORT, () => {
    console.log(`ONYX REMUX SERVER Running on port ${CONFIG.PORT}`);
});