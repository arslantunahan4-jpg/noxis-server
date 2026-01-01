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

    async resolveMagnet(magnet, fileIndex, season, episode) {
        const cacheKey = `${magnet}_${fileIndex || 'auto'}_s${season || 0}e${episode || 0}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < 3600000)) {
            console.log(`[Cache] ⚡ Hit: ${cacheKey.substring(0, 15)}...`);
            return cached.data;
        }

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        try {
            console.log(`[Debrid] Resolving magnet... S:${season} E:${episode}`);
            const form = new URLSearchParams();
            form.append('magnet', magnet);

            const { data: addData } = await axios.post(`${this.baseUrl}/torrents/addMagnet`, form, { headers: this.headers });
            await sleep(500);

            const { data: info } = await axios.get(`${this.baseUrl}/torrents/info/${addData.id}`, { headers: this.headers });

            let selectedFileId;

            // 1. Explicit Index Strategy
            if (fileIndex !== undefined && info.files[fileIndex]) {
                selectedFileId = info.files[fileIndex].id;
            }
            // 2. Season/Episode Regex Strategy (Smart Select)
            else if (season && episode) {
                // Common patterns: S01E01, 1x01, S1E1
                const s = parseInt(season);
                const e = parseInt(episode);

                // Flexible regex to match SxxExx or 1x01 anywhere in filename
                const patterns = [
                    new RegExp(`[sS]0?${s}[eE]0?${e}[^0-9]`), // S01E01 or S1E1, followed by non-digit
                    new RegExp(`0?${s}[xX]0?${e}[^0-9]`),      // 1x01, followed by non-digit
                    new RegExp(`S0?${s}\\s?-\\s?E0?${e}`)       // S01 - E01
                ];

                const match = info.files.find(f => {
                    const name = f.path.split('/').pop(); // check only filename
                    return patterns.some(p => p.test(name)) && /\.(mp4|mkv|avi|webm)$/i.test(name);
                });

                if (match) {
                    console.log(`[Debrid] ✅ Smart Match: ${match.path}`);
                    selectedFileId = match.id;
                } else {
                    console.warn(`[Debrid] ⚠️ No regex match for S${s}E${e}, falling back to largest file.`);
                }
            }

            // 3. Fallback: Largest Video File
            if (!selectedFileId) {
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
    const { magnet, index, season, episode } = req.query;
    if (!magnet) return res.status(400).send("Magnet required");

    try {
        console.log(`[Stream] Init...`);
        const fileData = await debrid.resolveMagnet(
            magnet,
            index ? parseInt(index) : undefined,
            season,
            episode
        );
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
        // Detect Codec & Pixel Format to ensure TV Compatibility
        console.log(`[Stream] Probing file for TV safety...`);

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');

        ffmpeg.ffprobe(fileData.url, (probeErr, metadata) => {
            if (probeErr) {
                console.error('[Probe Error]', probeErr.message);
                // Probe failed, safer to transcode everything just to be sure
                startStream(true, true);
                return;
            }

            const videoStream = metadata?.streams?.find(s => s.codec_type === 'video');
            const audioStream = metadata?.streams?.find(s => s.codec_type === 'audio');

            const videoCodec = videoStream?.codec_name?.toLowerCase() || 'unknown';
            const audioCodec = audioStream?.codec_name?.toLowerCase() || 'unknown';
            const pixFmt = videoStream?.pix_fmt || 'unknown';

            // TV Rule: Must be H264 (avc1) AND 8-bit (yuv420p)
            const isVideoSafe = ['h264', 'avc1'].includes(videoCodec) && pixFmt === 'yuv420p';
            const isAudioSafe = ['aac', 'mp3'].includes(audioCodec);

            console.log(`[Stream] Analysis: V:${videoCodec} (${pixFmt}) | A:${audioCodec}`);
            console.log(`[Stream] Action: Video->${isVideoSafe ? 'COPY' : 'TRANSCODE'} | Audio->${isAudioSafe ? 'COPY' : 'TRANSCODE'}`);

            // If unsafe, we transcode that component
            startStream(!isVideoSafe, !isAudioSafe);
        });



        function startStream(transcodeVideo, transcodeAudio) {
            const inputOpts = [
                '-reconnect 1',
                '-reconnect_streamed 1',
                '-reconnect_delay_max 5',
                '-user_agent "Mozilla/5.0"',
                '-analyzeduration 0',
                '-probesize 32M'
            ];

            const outputOpts = [];

            // 1. VIDEO HANDLING
            if (transcodeVideo) {
                console.log(`[Stream] ⚡ TRANSCODING VIDEO (libx264)`);
                outputOpts.push(
                    '-c:v libx264',
                    '-preset ultrafast',
                    '-crf 23',
                    '-tune zerolatency',
                    '-pix_fmt yuv420p',
                    '-profile:v main',     // Better for HD than baseline
                    '-level 4.0',          // Supports 1080p (Level 3.0 was SD only!)
                    '-maxrate 5M',         // Cap bitrate for TV WiFi
                    '-bufsize 10M'
                );
            } else {
                console.log(`[Stream] ✅ COPYING VIDEO (h264)`);
                outputOpts.push('-c:v copy');
            }

            // 2. AUDIO HANDLING
            if (transcodeAudio) {
                console.log(`[Stream] ⚡ TRANSCODING AUDIO (aac)`);
                outputOpts.push(
                    '-c:a aac',
                    '-b:a 128k',
                    '-ac 2' // Stereo downmix for compatibility
                );
            } else {
                console.log(`[Stream] ✅ COPYING AUDIO (aac/mp3)`);
                outputOpts.push('-c:a copy');
            }

            // 3. CONTAINER FLAGS
            outputOpts.push(
                '-movflags +frag_keyframe+empty_moov+default_base_moof',
                '-f mp4'
            );

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

app.get('/subtitle-proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL required");

    try {
        const response = await axios.get(url, {
            responseType: 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        // Robust SRT to VTT conversion:
        // 1. Ensure WEBVTT header exists.
        // 2. Convert comma timestamps (00:00:00,000) to dots (00:00:00.000).
        let content = response.data;
        if (!content.trim().startsWith('WEBVTT')) {
            content = 'WEBVTT\n\n' + content;
        }
        // Robust Regex: Matches 00:00:00,000 --> 00:00:00,000 and converts commas to dots
        // Only touches timestamp lines, safe for text content containing commas
        content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}),(\d{3})/g,
            (match, t1, ms1, t2, ms2) => `${t1}.${ms1} --> ${t2}.${ms2}`
        );

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