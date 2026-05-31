import axios from 'axios';
import { LRUCache } from 'lru-cache';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
    REAL_DEBRID_TOKEN: process.env.REAL_DEBRID_TOKEN
};

export class DebridService {
    constructor() {
        this.cache = new LRUCache({ max: 500, ttl: 1000 * 60 * 60 });
        this.baseUrl = 'https://api.real-debrid.com/rest/1.0';
        this.lastCallTime = 0;
        this.minDelay = 600;
    }

    get headers() {
        return { 
            'Authorization': `Bearer ${CONFIG.REAL_DEBRID_TOKEN}`,
            'User-Agent': 'NoxisStreamingApp/1.0'
        };
    }

    async _safeRequest(method, endpoint, body = null, retries = 3) {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const now = Date.now();
        const timeSinceLast = now - this.lastCallTime;
        if (timeSinceLast < this.minDelay) await sleep(this.minDelay - timeSinceLast);
        this.lastCallTime = Date.now();

        try {
            const opts = { headers: this.headers };
            let response;
            if (method === 'POST') response = await axios.post(`${this.baseUrl}${endpoint}`, body, opts);
            else response = await axios.get(`${this.baseUrl}${endpoint}`, opts);
            return response.data;
        } catch (error) {
            if (retries > 0 && (error.response?.status === 429 || error.response?.status >= 500)) {
                await sleep(2000);
                return this._safeRequest(method, endpoint, body, retries - 1);
            }
            throw error;
        }
    }

    async resolveMagnet(magnet, fileIndex, season, episode) {
        const cacheKey = `${magnet}_${fileIndex || 'auto'}_s${season || 0}e${episode || 0}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        try {
            const form = new URLSearchParams();
            form.append('magnet', magnet);
            const addData = await this._safeRequest('POST', '/torrents/addMagnet', form);
            
            let attempts = 0;
            let info;
            while(attempts < 15) {
                await new Promise(r => setTimeout(r, 1000));
                info = await this._safeRequest('GET', `/torrents/info/${addData.id}`);
                if(info.status === 'waiting_files_selection' || info.status === 'downloaded') break;
                attempts++;
            }

            if (!info || !info.files) throw new Error("Files not ready");

            let selectedFileId;
            const s = parseInt(season);
            const e = parseInt(episode);
            
            if (season && episode) {
                const patterns = [
                    new RegExp(`[sS]0?${s}[eE]0?${e}[^0-9]`), 
                    new RegExp(`0?${s}[xX]0?${e}[^0-9]`),      
                    new RegExp(`S0?${s}\\s?-\\s?E0?${e}`)
                ];
                const match = info.files.find(f => {
                    const name = f.path.split('/').pop();
                    return patterns.some(p => p.test(name)) && /\.(mp4|mkv|avi|webm)$/i.test(name);
                });
                if (match) selectedFileId = match.id;
            }

            if (!selectedFileId) {
                const videoFiles = info.files.filter(f => /\.(mp4|mkv|avi|webm)$/i.test(f.path));
                if (videoFiles.length > 0) selectedFileId = videoFiles.sort((a, b) => b.bytes - a.bytes)[0].id;
                else selectedFileId = info.files.sort((a, b) => b.bytes - a.bytes)[0].id;
            }

            await this._safeRequest('POST', `/torrents/selectFiles/${addData.id}`, new URLSearchParams({ files: selectedFileId.toString() }));
            await new Promise(r => setTimeout(r, 500));

            const freshInfo = await this._safeRequest('GET', `/torrents/info/${addData.id}`);
            if (!freshInfo.links.length) throw new Error("No links generated");

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

export const debrid = new DebridService();
