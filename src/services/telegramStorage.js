import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram/tl/index.js";
import fs from "fs";
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = BigInt(process.env.TELEGRAM_CHANNEL_ID); 

const SESSION_FILE = path.join(process.cwd(), 'telegram_session.txt');

let client = null;
let isConnecting = false;

// Bağlantı durumunu kontrol et
const ensureConnected = async () => {
    if (client && client.connected) return true;
    
    // Eğer zaten bağlanıyorsa bekle
    if (isConnecting) {
        await new Promise(r => setTimeout(r, 2000));
        return client && client.connected;
    }
    
    await initTelegram();
    return client && client.connected;
};

export const initTelegram = async () => {
    if (client && client.connected) return client;
    if (isConnecting) return null;
    
    if (!API_ID || !API_HASH || !BOT_TOKEN) {
        console.warn("[Telegram] Config missing");
        return null;
    }

    isConnecting = true;

    try {
        let sessionString = "";
        if (fs.existsSync(SESSION_FILE)) {
            sessionString = fs.readFileSync(SESSION_FILE, 'utf8');
        }

        client = new TelegramClient(new StringSession(sessionString), API_ID, API_HASH, {
            connectionRetries: 10,
            retryDelay: 2000,
            timeout: 60 * 1000, // 60 saniye timeout
            useWSS: false,
            autoReconnect: true,
            floodSleepThreshold: 60,
        });

        await client.start({
            botAuthToken: BOT_TOKEN,
        });

        // Save session if it changed
        const newSession = client.session.save();
        if (newSession !== sessionString) {
            fs.writeFileSync(SESSION_FILE, newSession);
            console.log("[Telegram] Session saved");
        }

        console.log("[Telegram] Connected!");
        isConnecting = false;
        return client;
    } catch (e) {
        isConnecting = false;
        
        if (e.message.includes('BOT_METHOD_INVALID')) {
            console.log("[Telegram] Connected (bot mode)");
            return client;
        }
        
        console.error("[Telegram] Connection Failed:", e.message);
        if (e.message.includes('AUTH_KEY_UNREGISTERED')) {
            if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
            client = null;
        }
        return null;
    }
};

// Retry wrapper fonksiyonu
const withRetry = async (fn, maxRetries = 3, delay = 5000) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            console.error(`[Telegram] Attempt ${i + 1}/${maxRetries} failed:`, e.message);
            
            // Bağlantı hatası ise yeniden bağlan
            if (e.message.includes('disconnect') || e.message.includes('NETWORK') || 
                e.message.includes('timeout') || e.message.includes('connection')) {
                client = null;
                await new Promise(r => setTimeout(r, delay));
                await initTelegram();
            } else if (i < maxRetries - 1) {
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
};

export const uploadToTelegram = async (filePath, fileName) => {
    // Dosya var mı kontrol et
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const fileSize = fs.statSync(filePath).size;
    console.log(`[Telegram] Uploading: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    
    return await withRetry(async () => {
        // Bağlantıyı garantile
        const connected = await ensureConnected();
        if (!connected) throw new Error("Telegram not connected");

        const tg = client;
        
        // Resolve entity first to avoid "Could not find input entity" error
        const entity = await tg.getEntity(CHANNEL_ID);
        
        const result = await tg.sendFile(entity, {
            file: filePath,
            caption: fileName,
            forceDocument: true,
            workers: 1, // Tek worker daha stabil
            progressCallback: (progress) => {
                const percent = Math.round((progress / fileSize) * 100);
                if (percent % 25 === 0) {
                    console.log(`[Telegram] Upload progress: ${percent}%`);
                }
            }
        });
        
        console.log(`[Telegram] Upload complete: ${fileName}`);
        
        return {
            id: result.id,
            accessHash: result.media.document.accessHash.toString(),
            fileReference: result.media.document.fileReference.toString('base64'),
            size: Number(result.media.document.size),
            mime: result.media.document.mimeType
        };
    }, 3, 10000); // 3 deneme, 10 saniye ara
};

// Stream dosyasını sunmak için (Doğrudan client'a pipe eder)
export const streamFromTelegram = async (messageId, res, range) => {
    const connected = await ensureConnected();
    if (!connected) return res.status(500).send("Telegram error");

    try {
        const tg = client;
        const entity = await tg.getEntity(CHANNEL_ID);
        const messages = await tg.getMessages(entity, { ids: [parseInt(messageId)] });
        
        if (!messages || messages.length === 0) return res.status(404).send("File not found");

        const media = messages[0].media;
        if (!media || !media.document) return res.status(404).send("No media");

        const fileSize = Number(media.document.size);
        let start = 0;
        let end = fileSize - 1;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            start = parseInt(parts[0], 10);
            end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        }

        const chunk = end - start + 1;

        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunk,
            "Content-Type": media.document.mimeType || "video/mp4",
        });

        // GramJS iterDownload ile stream et
        const iter = tg.iterDownload(media, {
            offset: start,
            limit: chunk,
            chunkSize: 256 * 1024 // 256KB chunks
        });

        for await (const part of iter) {
            if (!res.writable) break;
            res.write(part);
        }
        res.end();

    } catch (e) {
        console.error("[Telegram] Stream Error:", e.message);
        if (!res.headersSent) res.status(500).send("Stream failed");
    }
};

export const streamFromTelegramRaw = async (messageId, res, start, end) => {
    const connected = await ensureConnected();
    if (!connected) throw new Error("Telegram error");

    const tg = client;
    const entity = await tg.getEntity(CHANNEL_ID);
    const messages = await tg.getMessages(entity, { ids: [parseInt(messageId)] });
    
    if (!messages || messages.length === 0) throw new Error("File not found");

    const media = messages[0].media;
    const chunk = end - start + 1;

    const iter = tg.iterDownload(media, {
        offset: start,
        limit: chunk,
        chunkSize: 256 * 1024 
    });

    for await (const part of iter) {
        if (!res.writable) break;
        res.write(part);
    }
    res.end();
};

export const getFileSize = async (messageId) => {
    const connected = await ensureConnected();
    if (!connected) return 0;
    
    try {
        const tg = client;
        const entity = await tg.getEntity(CHANNEL_ID);
        const messages = await tg.getMessages(entity, { ids: [parseInt(messageId)] });
        if (!messages || messages.length === 0 || !messages[0].media) return 0;
        return Number(messages[0].media.document.size);
    } catch (e) {
        return 0;
    }
};

// Bağlantıyı kapat
export const disconnectTelegram = async () => {
    if (client) {
        try {
            await client.disconnect();
        } catch (e) {}
        client = null;
    }
};
