import axios from 'axios';
import { uploadToTelegram } from './telegramStorage.js';
import { debrid } from './debrid.js';
import { ArchivedContent } from '../models/Archive.js';
import fs from 'fs';
import path from 'path';

const CONFIG = {
    TMDB_KEY: process.env.TMDB_API_KEY,
    DEBRID_TOKEN: process.env.REAL_DEBRID_TOKEN,
    CHUNK_SIZE: 1900 * 1024 * 1024,
    TEMP_DIR: path.join('/tmp', 'noxis_archiver'),
    MAX_RETRIES: 3,
    RETRY_DELAY: 10000,
    SYNC_COOLDOWN: 6 * 60 * 60 * 1000
};

if (!fs.existsSync(CONFIG.TEMP_DIR)) {
    fs.mkdirSync(CONFIG.TEMP_DIR, { recursive: true });
}

export const fetchTrends = async () => {
    try {
        console.log('[Archiver] Trendler taraniyor...');
        const res = await axios.get(`https://api.themoviedb.org/3/trending/all/day?api_key=${CONFIG.TMDB_KEY}`);
        
        for (const item of res.data.results) {
            if (item.media_type === 'movie') {
                await queueContent(item.id, 'movie', item.title);
            } else if (item.media_type === 'tv') {
                await queueSeries(item.id, item.name);
            }
        }
    } catch (e) {
        console.error('[Archiver] Trend hatasi:', e.message);
    }
};

export const syncDebridDownloads = async () => {
    try {
        console.log('[Archiver] Debrid gecmisi yedekleniyor...');
        const res = await axios.get('https://api.real-debrid.com/rest/1.0/downloads?limit=50', {
            headers: { Authorization: `Bearer ${CONFIG.DEBRID_TOKEN}` }
        });

        for (const down of res.data) {
            const exists = await ArchivedContent.findOne({ title: down.filename });
            
            if (exists) {
                if (exists.status === 'failed') {
                    const timeSinceLastAttempt = Date.now() - new Date(exists.updatedAt).getTime();
                    if (timeSinceLastAttempt < CONFIG.SYNC_COOLDOWN) {
                        continue;
                    }
                    exists.status = 'pending';
                    exists.retryCount = (exists.retryCount || 0) + 1;
                    await exists.save();
                } else {
                    continue;
                }
            }
            
            if (!exists && down.download) {
                console.log(`[Sync] Eski indirme bulundu: ${down.filename}`);
                processDownload(down.download, down.filename);
            }
        }
    } catch (e) {
        console.error('[Archiver] Sync hatasi:', e.message);
    }
};

const processDownload = async (url, filename) => {
    try {
        const files = await downloadAndUpload(url, filename);
        await ArchivedContent.findOneAndUpdate(
            { title: filename },
            { 
                tmdbId: `legacy_${Date.now()}`,
                title: filename,
                type: 'movie',
                files: files,
                status: 'completed',
                completedAt: new Date()
            },
            { upsert: true, new: true }
        );
        console.log(`[Sync] Tamamlandi: ${filename}`);
    } catch (e) {
        console.error(`[Sync] Hata (${filename}):`, e.message);
        await ArchivedContent.findOneAndUpdate(
            { title: filename },
            { 
                $set: { 
                    status: 'failed', 
                    lastError: e.message,
                    updatedAt: new Date()
                },
                $inc: { retryCount: 1 }
            },
            { upsert: true }
        );
    }
};

export const processQueue = async () => {
    const job = await ArchivedContent.findOne({ status: 'pending' }).sort({ createdAt: 1 });
    if (!job) return;

    console.log(`[Archiver] Isleniyor: ${job.title} ${job.season ? `S${job.season}E${job.episode}` : ''}`);
    job.status = 'processing';
    await job.save();

    try {
        const magnet = await findMagnet(job.tmdbId, job.type, job.season, job.episode);
        if (!magnet) throw new Error('Magnet bulunamadi');

        const link = await resolveDebrid(magnet);
        if (!link) throw new Error('Debrid linki alinamadi');

        const files = await downloadAndUpload(link, `${job.title} ${job.season ? `S${job.season}E${job.episode}` : ''}`);
        
        job.files = files;
        job.status = 'completed';
        job.completedAt = new Date();
        await job.save();
        console.log(`[Archiver] Tamamlandi: ${job.title}`);

    } catch (e) {
        console.error(`[Archiver] Hata:`, e.message);
        job.status = 'failed';
        job.lastError = e.message;
        job.retryCount = (job.retryCount || 0) + 1;
        await job.save();
    }
};

const queueContent = async (id, type, title, season, episode) => {
    const exists = await ArchivedContent.findOne({ tmdbId: id.toString(), season, episode });
    if (!exists) {
        await ArchivedContent.create({
            tmdbId: id.toString(),
            title, type, season, episode,
            status: 'pending'
        });
    }
};

const queueSeries = async (id, name) => {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/tv/${id}?api_key=${CONFIG.TMDB_KEY}`);
        const season1 = res.data.seasons.find(s => s.season_number === 1);
        
        if (season1) {
            for (let i = 1; i <= Math.min(season1.episode_count, 3); i++) {
                await queueContent(id, 'tv', name, 1, i);
            }
        }
    } catch (e) {}
};

const findMagnet = async (id, type, s, e) => {
    try {
        const url = type === 'tv'
            ? `https://torrentio.strem.fun/stream/series/${id}:${s}:${e}.json`
            : `https://torrentio.strem.fun/stream/movie/${id}.json`;
            
        const res = await axios.get(url, { timeout: 10000 });
        return res.data.streams?.[0]?.infoHash || null;
    } catch (e) { return null; }
};

const resolveDebrid = async (magnet) => {
    try {
        const result = await debrid.resolveMagnet(magnet, null, null, null);
        return result?.url;
    } catch (e) {
        console.error('[Archiver] Debrid resolve error:', e.message);
        return null;
    }
};

const cleanupTempFiles = (pattern) => {
    try {
        const files = fs.readdirSync(CONFIG.TEMP_DIR);
        for (const file of files) {
            if (file.includes(pattern)) {
                const filePath = path.join(CONFIG.TEMP_DIR, file);
                try {
                    fs.unlinkSync(filePath);
                    console.log(`[Archiver] Temp dosya temizlendi: ${file}`);
                } catch (e) {}
            }
        }
    } catch (e) {}
};

const downloadAndUpload = async (url, title) => {
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 100);
    let part = 1;
    let uploadedFiles = [];
    let currentPath = null;
    let writer = null;

    cleanupTempFiles(safeTitle);

    try {
        console.log(`[Archiver] Indiriliyor: ${title}`);
        
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 30 * 60 * 1000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        currentPath = path.join(CONFIG.TEMP_DIR, `${safeTitle}_part${part}.mp4`);
        writer = fs.createWriteStream(currentPath);
        let currentSize = 0;
        let totalDownloaded = 0;

        const uploadPart = async (filePath, partNum, isFinal = false) => {
            console.log(`[Archiver] Yukleniyor: Part ${partNum}${isFinal ? ' (Son)' : ''}`);
            const result = await uploadToTelegram(filePath, `${title} - Part ${partNum}`);
            uploadedFiles.push({ 
                fileId: result.id, 
                part: partNum, 
                name: title, 
                size: result.size 
            });
            
            try {
                fs.unlinkSync(filePath);
            } catch (e) {}
            
            return result;
        };

        for await (const chunk of response.data) {
            if (currentSize + chunk.length > CONFIG.CHUNK_SIZE) {
                writer.end();
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                
                await uploadPart(currentPath, part);
                
                part++;
                currentSize = 0;
                currentPath = path.join(CONFIG.TEMP_DIR, `${safeTitle}_part${part}.mp4`);
                writer = fs.createWriteStream(currentPath);
            }

            writer.write(chunk);
            currentSize += chunk.length;
            totalDownloaded += chunk.length;
        }

        writer.end();
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        if (currentSize > 0) {
            await uploadPart(currentPath, part, true);
        }

        console.log(`[Archiver] Toplam: ${(totalDownloaded / 1024 / 1024).toFixed(2)} MB, ${uploadedFiles.length} parca`);
        return uploadedFiles;

    } catch (e) {
        if (writer) {
            try { writer.end(); } catch (err) {}
        }
        if (currentPath && fs.existsSync(currentPath)) {
            try { fs.unlinkSync(currentPath); } catch (err) {}
        }
        cleanupTempFiles(safeTitle);
        
        console.error('[Archiver] Download Error:', e.message);
        throw e;
    }
};

export const getArchiverStats = async () => {
    const completed = await ArchivedContent.countDocuments({ status: 'completed' });
    const failed = await ArchivedContent.countDocuments({ status: 'failed' });
    const pending = await ArchivedContent.countDocuments({ status: 'pending' });
    const processing = await ArchivedContent.countDocuments({ status: 'processing' });
    
    return { completed, failed, pending, processing };
};

export const resetFailedJobs = async (olderThanHours = 24) => {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const result = await ArchivedContent.updateMany(
        { 
            status: 'failed',
            updatedAt: { $lt: cutoff },
            retryCount: { $lt: 5 }
        },
        { 
            $set: { status: 'pending' }
        }
    );
    return result.modifiedCount;
};

export const clearStuckJobs = async () => {
    const result = await ArchivedContent.updateMany(
        { status: 'processing' },
        { $set: { status: 'pending' } }
    );
    return result.modifiedCount;
};
