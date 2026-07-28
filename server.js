import express from 'express';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { LRUCache } from 'lru-cache';
import compression from 'compression';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { findSource } from './src/services/scraperManager.js';
import { resolveDizimom } from './src/utils/dizimom-resolver.js';
import { adminMiddleware } from './src/middleware/adminMiddleware.js';
import { Friendship } from './src/models/Friendship.js';
import { sessionTokenQuery, sessionTokenRecord } from './src/utils/sessionToken.js';
import { AccessToken } from 'livekit-server-sdk';
import OpenSubtitles from 'opensubtitles-api';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { SocksProxyAgent } from 'socks-proxy-agent';

const USE_TOR = process.env.USE_TOR === 'true';
const TOR_SOCKS_PROXY = process.env.TOR_SOCKS_PROXY || 'socks5://127.0.0.1:9050';
const torAgent = USE_TOR ? new SocksProxyAgent(TOR_SOCKS_PROXY) : undefined;
// Social: Online users tracking (userId -> Set of socketIds)
const onlineUsers = new Map();

puppeteer.use(StealthPlugin());

const OS = new OpenSubtitles({
    useragent: 'NoxisStreamingApp',
    ssl: true
});

dotenv.config();

const DEFAULT_KEEP_ALIVE_URL = 'https://noxis-server.onrender.com';
const DEFAULT_KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

const parseKeepAliveInterval = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_KEEP_ALIVE_INTERVAL_MS;
    }

    return Math.max(parsed, 60 * 1000);
};

const isKeepAliveEnabledByDefault = () => {
    return process.env.RENDER_SERVICE_TYPE === 'web' || Boolean(process.env.RENDER_EXTERNAL_URL);
};

const CONFIG = {
    PORT: process.env.PORT || 3000,
    REAL_DEBRID_TOKEN: process.env.REAL_DEBRID_TOKEN || '',
    TMDB_API_KEY: process.env.TMDB_API_KEY || '',
    MONGODB_URI: process.env.MONGODB_URI,
    FFMPEG_PATH: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
    FFPROBE_PATH: process.env.FFPROBE_PATH || '/usr/bin/ffprobe',
    KEEP_ALIVE_ENABLED: String(process.env.KEEP_ALIVE_ENABLED ?? isKeepAliveEnabledByDefault()).toLowerCase() === 'true',
    KEEP_ALIVE_URL: process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || DEFAULT_KEEP_ALIVE_URL,
    KEEP_ALIVE_INTERVAL_MS: parseKeepAliveInterval(process.env.KEEP_ALIVE_INTERVAL_MS),
    ALLOWED_PROXY_DOMAINS: [
        'yts.mx', 'yts.lt', 'eztvx.to', '1337x.to', 'torrentio.strem.fun', 'themoviedb.org', 'image.tmdb.org', 'tmdb.org',
        'vidmody.com', 'gamephotos.pro', 'photoflick.org', 'photofunny.org', 'photofunia.pro', 'photoflax.org',
        'm.media-amazon.com', 'diziyou.to', 'storage.diziyou.to', 'storage.diziyou.one', 'strem.io', 'opensubtitles.org',
        'dizigom104.com', 'play.dizigom104.com', 'df856-54hilsnz.xyz', 'n1.df856-54hilsnz.xyz',
        'streamimdb.ru', 'brightpathsignals.com', 'nextgencloudfabric.com', 'streamdata.vaplayer.ru', 'vaplayer.ru',
        'vidapi.cloud', 'justhd.tv', 'tmstrd.justhd.tv', 'onlinecoachingacademy.site'
    ]
};

const configuredCorsOrigins = new Set(
    String(process.env.CORS_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim().replace(/\/$/, ''))
        .filter(Boolean)
);

const isAllowedCorsOrigin = (origin) => {
    if (!origin || origin === 'null') return true;
    const normalized = String(origin).replace(/\/$/, '');
    if (configuredCorsOrigins.has(normalized)) return true;
    return /^https:\/\/([a-z0-9-]+\.)?noxis\.tech$/i.test(normalized) ||
        /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(normalized) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized) ||
        /^(file|app|webos|capacitor|ionic):\/\//i.test(normalized);
};

const corsOrigin = (origin, callback) => {
    if (isAllowedCorsOrigin(origin)) callback(null, true);
    else callback(null, false);
};

try {
    ffmpeg.setFfmpegPath(CONFIG.FFMPEG_PATH);
    ffmpeg.setFfprobePath(CONFIG.FFPROBE_PATH);
} catch (e) {
    console.warn("FFmpeg path setup failed, using system default");
}

const app = express();
// Create HTTP server from Express app
const httpServer = createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(httpServer, {
    cors: {
        origin: corsOrigin,
        methods: ["GET", "POST"]
    }
});

// In-memory store for rooms and participants
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('join_room', ({ code, username, userId }, callback) => {
        try {
            socket.join(code);
            
            if (!rooms.has(code)) {
                rooms.set(code, {
                    host: socket.id,
                    participants: [],
                    state: { currentTime: 0, isPaused: true, playbackRate: 1, timestamp: Date.now() }
                });
            }

            const room = rooms.get(code);
            const isHost = room.participants.length === 0; // First joiner becomes host if empty (fallback logic)
            
            // If room was created just now, host is socket.id. 
            // If room existed but was empty, this user becomes host.
            if (isHost && room.host !== socket.id) {
                room.host = socket.id;
            }

            const participant = {
                id: socket.id,
                userId: userId || `guest_${socket.id.substr(0,4)}`,
                username: username || `Guest ${socket.id.substr(0,4)}`,
                isHost: room.host === socket.id
            };

            room.participants.push(participant);
            
            // Notify caller of success
            if (callback) callback({ success: true, isHost: participant.isHost });

            // Notify client of their role
            socket.emit('role_update', { isHost: participant.isHost });
            
            // Sync new user to current room state
            socket.emit('sync_state', room.state);

            // Broadcast updated participant list
            io.to(code).emit('participants_update', room.participants);
            
            // Notify others
            socket.to(code).emit('toast', { msg: `${participant.username} odaya katıldı 👋` });

            console.log(`👤 User joined room ${code}: ${participant.username} (Host: ${participant.isHost})`);

        } catch (e) {
            console.error("Join Room Error:", e);
            if (callback) callback({ success: false, error: "Sunucu hatası" });
        }
    });

    socket.on('update_state', ({ code, state }) => {
        const room = rooms.get(code);
        if (room && room.host === socket.id) {
            room.state = { ...state, timestamp: Date.now() }; // Update server state with timestamp
            socket.to(code).emit('sync_state', room.state); // Broadcast to everyone else
        }
    });

    socket.on('buffer_start', ({ code }) => {
        const room = rooms.get(code);
        if (room && room.host === socket.id) {
            socket.to(code).emit('buffer_start');
        }
    });

    socket.on('buffer_end', ({ code }) => {
        const room = rooms.get(code);
        if (room && room.host === socket.id) {
            socket.to(code).emit('buffer_end');
        }
    });

    socket.on('leave_room', ({ code }) => {
        handleDisconnect(socket, code);
    });

    // ─── Social Presence ───
    socket.on('social_login', async (data) => {
        if (!data?.userId) return;
        socket.userId = data.userId;
        socket.socialUsername = data.username;

        if (!onlineUsers.has(data.userId)) {
            onlineUsers.set(data.userId, new Set());
        }
        onlineUsers.get(data.userId).add(socket.id);

        // Update DB online status
        try {
            await User.findByIdAndUpdate(data.userId, {
                'onlineStatus.isOnline': true,
                'onlineStatus.lastSeen': new Date()
            });
        } catch (e) { /* silent */ }

        // Notify friends
        try {
            const friendships = await Friendship.find({
                $or: [{ requester: data.userId }, { recipient: data.userId }],
                status: 'accepted'
            });
            friendships.forEach(f => {
                const friendId = String(f.requester) === data.userId
                    ? String(f.recipient) : String(f.requester);
                const friendSockets = onlineUsers.get(friendId);
                if (friendSockets) {
                    friendSockets.forEach(sid => {
                        io.to(sid).emit('friend_online', { username: data.username });
                    });
                }
            });
        } catch (e) { /* silent */ }
    });

    socket.on('disconnect', async () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
        // Find which rooms this socket was in
        rooms.forEach((room, code) => {
            if (room.participants.some(p => p.id === socket.id)) {
                handleDisconnect(socket, code);
            }
        });

        if (socket.userId) {
            const userSockets = onlineUsers.get(socket.userId);
            if (userSockets) {
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    onlineUsers.delete(socket.userId);

                    // Update DB
                    try {
                        await User.findByIdAndUpdate(socket.userId, {
                            'onlineStatus.isOnline': false,
                            'onlineStatus.lastSeen': new Date(),
                            'onlineStatus.currentlyWatching': {}
                        });
                    } catch (e) { /* silent */ }

                    // Notify friends
                    try {
                        const friendships = await Friendship.find({
                            $or: [{ requester: socket.userId }, { recipient: socket.userId }],
                            status: 'accepted'
                        });
                        friendships.forEach(f => {
                            const friendId = String(f.requester) === socket.userId
                                ? String(f.recipient) : String(f.requester);
                            const friendSockets = onlineUsers.get(friendId);
                            if (friendSockets) {
                                friendSockets.forEach(sid => {
                                    io.to(sid).emit('friend_offline', { username: socket.socialUsername });
                                });
                            }
                        });
                    } catch (e) { /* silent */ }
                }
            }
        }
    });
});

function handleDisconnect(socket, code) {
    const room = rooms.get(code);
    if (!room) return;

    const index = room.participants.findIndex(p => p.id === socket.id);
    if (index !== -1) {
        const leftUser = room.participants[index];
        room.participants.splice(index, 1);
        
        io.to(code).emit('participants_update', room.participants);
        io.to(code).emit('toast', { msg: `${leftUser.username} ayrıldı 👋` });

        // If host left, reassign host
        if (room.host === socket.id) {
            if (room.participants.length > 0) {
                const newHost = room.participants[0];
                room.host = newHost.id;
                newHost.isHost = true;
                
                io.to(newHost.id).emit('role_update', { isHost: true });
                io.to(code).emit('participants_update', room.participants);
                io.to(code).emit('toast', { msg: `${newHost.username} artık yönetici 👑` });
            } else {
                rooms.delete(code); // Delete empty room
            }
        }
    }
}

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: corsOrigin }));
app.use(compression());
app.use(express.json());

app.get(['/api/health', '/healthz'], (req, res) => {
    res.status(200).json({
        ok: true,
        service: 'noxis-backend',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.use((req, res, next) => {
    console.log(`[Incoming] ${req.method} ${req.url} | IP: ${req.ip}`);
    next();
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, 
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req) => !['login', 'register'].includes(req.params.action),
    message: { error: 'Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin.' }
});

const normalizeKeepAliveUrl = (rawUrl) => {
    if (!rawUrl) return null;

    try {
        const url = new URL(rawUrl);
        if (!url.pathname || url.pathname === '/') {
            url.pathname = '/api/health';
        }
        return url.toString();
    } catch (error) {
        console.warn(`[keep-alive] Invalid KEEP_ALIVE_URL: ${rawUrl}`);
        return null;
    }
};

const startKeepAlive = () => {
    if (!CONFIG.KEEP_ALIVE_ENABLED) {
        return;
    }

    const keepAliveUrl = normalizeKeepAliveUrl(CONFIG.KEEP_ALIVE_URL);
    if (!keepAliveUrl) {
        return;
    }

    let inFlight = false;
    const ping = async () => {
        if (inFlight) return;
        inFlight = true;

        try {
            const response = await axios.get(keepAliveUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Noxis-KeepAlive/1.0'
                },
                validateStatus: (status) => status >= 200 && status < 500
            });

            if (response.status >= 400) {
                console.warn(`[keep-alive] Ping returned HTTP ${response.status}`);
            }
        } catch (error) {
            console.warn(`[keep-alive] Ping failed: ${error.message}`);
        } finally {
            inFlight = false;
        }
    };

    const initialTimer = setTimeout(ping, 30 * 1000);
    initialTimer.unref?.();

    const interval = setInterval(ping, CONFIG.KEEP_ALIVE_INTERVAL_MS);
    interval.unref?.();

    console.log(`[keep-alive] Enabled: ${keepAliveUrl} every ${Math.round(CONFIG.KEEP_ALIVE_INTERVAL_MS / 60000)} minute(s)`);
};

let isDbConnected = false;
if (CONFIG.MONGODB_URI) {
    mongoose.connect(CONFIG.MONGODB_URI)
        .then(() => {
            isDbConnected = true;
            console.log("✅ MongoDB Connected");
        })
        .catch(err => console.error("❌ MongoDB Connection Error:", err));
}



import { User } from './src/models/User.js';
import { Session } from './src/models/Session.js';

const BCRYPT_ROUNDS = Math.min(Math.max(Number(process.env.BCRYPT_ROUNDS) || 12, 10), 14);
const DUMMY_PASSWORD_HASH = '$2b$12$51C/k9oNM3S45usa3KJAZOmqnbm0H38HrrGAyGQaj9dc9y8HyhDAy';
const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

const validateLegacyPassword = (password, userSalt, userHash) => {
    try {
        const calculated = Buffer.from(
            crypto.pbkdf2Sync(password, userSalt, 1000, 64, 'sha512').toString('hex'),
            'hex'
        );
        const expected = Buffer.from(String(userHash || ''), 'hex');
        return calculated.length === expected.length && crypto.timingSafeEqual(calculated, expected);
    } catch {
        return false;
    }
};

const generateToken = () => crypto.randomBytes(32).toString('hex');

const LOCAL_AUTH_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const localDevUsers = new Map();
const localDevSessions = new Map();
const localDevWatchHistory = new Map();

const isPrivateNetworkHost = (hostname = '') => {
    const normalized = String(hostname || '').toLowerCase();
    return normalized.startsWith('10.') ||
        normalized.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
};

const getRequestHostname = (req) => {
    const forwardedHost = req.headers['x-forwarded-host'];
    const rawHost = forwardedHost || req.headers.host || req.hostname || '';
    return String(rawHost).split(',')[0].trim().split(':')[0].toLowerCase();
};

const shouldUseLocalAuthBypass = (req) => {
    const hostname = getRequestHostname(req);
    // Allow local auth bypass in local development regardless of database connection status
    const isProd = process.env.NODE_ENV === 'production';
    return !isProd && (LOCAL_AUTH_HOSTS.has(hostname) || isPrivateNetworkHost(hostname));
};

const normalizeLocalCredential = (value = '') => String(value || '').trim().toLowerCase();

const findLocalDevUser = (identifier = '') => {
    const normalized = normalizeLocalCredential(identifier);
    if (!normalized) return null;

    for (const user of localDevUsers.values()) {
        if (user.username === normalized || user.email === normalized) {
            return user;
        }
    }

    return null;
};

const createLocalDevUser = async ({ username, email, password }) => {
    const normalizedUsername = normalizeLocalCredential(username);
    const user = {
        id: `local_${generateToken().slice(0, 12)}`,
        username: normalizedUsername,
        email: normalizeLocalCredential(email) || (normalizedUsername.includes('@') ? normalizedUsername : `${normalizedUsername}@local.dev`),
        passwordHash: await hashPassword(password)
    };

    localDevUsers.set(user.id, user);
    return user;
};

const createLocalDevSession = (user) => {
    const token = generateToken();
    const session = {
        token,
        userId: user.id,
        username: user.username
    };

    localDevSessions.set(token, session);
    return session;
};

const getLocalDevSession = (token = '') => {
    const normalizedToken = String(token || '');
    if (!normalizedToken) return null;
    return localDevSessions.get(normalizedToken) || null;
};

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    if (shouldUseLocalAuthBypass(req)) {
        const localSession = getLocalDevSession(token);
        if (!localSession) return res.sendStatus(403);

        req.user = { id: localSession.userId, username: localSession.username };
        req.localAuthSession = localSession;
        return next();
    }

    if (!isDbConnected) {
        return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const session = await Session.findOne(sessionTokenQuery(token));
    if (!session) return res.sendStatus(403);

    const user = await User.findById(session.userId).select('username isActive isBanned');
    if (!user || user.isBanned || user.isActive === false) {
        await Session.deleteOne({ _id: session._id });
        return res.sendStatus(403);
    }

    req.user = { id: user._id, username: user.username || session.username };
    User.findByIdAndUpdate(user._id, { 'onlineStatus.lastSeen': new Date() }).catch(() => {});
    next();
};

const handleLocalDevAuth = async (req, res, action) => {
    if (action === 'register') {
        const { username, email, password } = req.body;

        if (!username || !password) return res.status(400).json({ error: 'Tum alanlari doldurun' });
        if (username.length < 3) return res.status(400).json({ error: 'Kullanici adi en az 3 karakter olmali' });
        if (password.length < 6) return res.status(400).json({ error: 'Sifre en az 6 karakter olmali' });

        const existingLocalUser = findLocalDevUser(username);
        if (existingLocalUser) return res.status(400).json({ error: 'Bu kullanici adi zaten alinmis' });

        const localUser = await createLocalDevUser({ username, email, password });
        const localSession = createLocalDevSession(localUser);

        return res.json({
            success: true,
            token: localSession.token,
            user: { id: localUser.id, username: localUser.username },
            local: true
        });
    }

    if (action === 'login') {
        const { username, password } = req.body;
        if (!username) return res.status(400).json({ error: 'Eksik bilgi' });

        const localUser = findLocalDevUser(username);
        if (!localUser || !await bcrypt.compare(password || '', localUser.passwordHash)) {
            return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
        }

        const localSession = createLocalDevSession(localUser);
        return res.json({
            success: true,
            token: localSession.token,
            user: { id: localUser.id, username: localUser.username },
            local: true
        });
    }

    if (action === 'verify') {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
        if (!token || typeof token !== 'string') return res.status(401).json({ error: 'No token' });

        const localSession = getLocalDevSession(token);
        if (!localSession) return res.status(401).json({ error: 'Session expired' });

        return res.json({
            success: true,
            user: { username: localSession.username },
            local: true
        });
    }

    if (action === 'logout') {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
        if (token && typeof token === 'string') {
            localDevSessions.delete(String(token));
        }
        return res.json({ success: true, local: true });
    }

    return res.status(404).json({ error: 'Unknown auth action' });
};

app.post('/api/auth/:action', authLimiter, async (req, res) => {
    const { action } = req.params;
    if (shouldUseLocalAuthBypass(req)) {
        return handleLocalDevAuth(req, res, action);
    }
    if (!isDbConnected) return res.status(503).json({ success: false, error: 'Sunucu başlatılıyor, lütfen bekleyin...' });

    try {
        if (action === 'register') {
            const { username, email, password } = req.body;
            const normalizedUsername = String(username || '').trim().toLowerCase();
            const normalizedEmail = String(email || '').trim().toLowerCase();
            
            if (!normalizedUsername || !normalizedEmail || !password) return res.status(400).json({ error: 'Tüm alanları doldurun' });
            if (normalizedUsername.length < 3) return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalı' });
            if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(normalizedEmail)) {
                return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin' });
            }
            
            const existing = await User.findOne({
                $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
            });
            if (existing) return res.status(409).json({ error: 'Bu kullanıcı adı veya e-posta zaten kullanılıyor' });

            const hash = await hashPassword(password);
            
            const user = await User.create({ 
                username: normalizedUsername,
                email: normalizedEmail,
                hash
            });
            
            const token = generateToken();
            await Session.create({
                ...sessionTokenRecord(token),
                userId: user._id,
                username: user.username,
                ip: req.ip,
                userAgent: String(req.get('user-agent') || '').slice(0, 300)
            });

            return res.json({ success: true, token, user: { id: user._id, username: user.username } });
        }
        
        if (action === 'login') {
            const { username, password } = req.body;
            if (!username) return res.status(400).json({ error: 'Eksik bilgi' });
            const identifier = String(username).trim().toLowerCase();
            if (!identifier) return res.status(400).json({ error: 'Eksik bilgi' });

            // Hem username hem email ile arama yap
            const user = await User.findOne({
                $or: [
                    { username: identifier },
                    { email: identifier }
                ]
            }).select('+hash +salt +password');

            if (!user) {
                await bcrypt.compare(password || '', DUMMY_PASSWORD_HASH);
                return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
            }
            if (user.isBanned || user.isActive === false) {
                return res.status(403).json({ error: 'Bu hesap devre dışı' });
            }

            let isValid = false;

            if (typeof user.hash === 'string' && user.hash.startsWith('$2')) {
                isValid = await bcrypt.compare(password || '', user.hash);
            }
            else if (user.salt && user.hash) {
                isValid = validateLegacyPassword(password || '', user.salt, user.hash);
                if (isValid) {
                    user.hash = await hashPassword(password);
                    user.salt = undefined;
                }
            }
            else if (typeof user.password === 'string' && user.password.startsWith('$2')) {
                isValid = await bcrypt.compare(password || '', user.password);
                if (isValid) {
                    user.hash = await hashPassword(password);
                    user.password = undefined;
                    user.salt = undefined;
                }
            }

            if (!isValid) {
                return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
            }

            user.lastLogin = new Date();
            user.loginHistory.push({
                ip: req.ip,
                userAgent: String(req.get('user-agent') || '').slice(0, 300),
                status: 'success'
            });
            if (user.loginHistory.length > 25) user.loginHistory = user.loginHistory.slice(-25);
            await user.save();

            const token = generateToken();
            await Session.create({
                ...sessionTokenRecord(token),
                userId: user._id,
                username: user.username || user.name,
                ip: req.ip,
                userAgent: String(req.get('user-agent') || '').slice(0, 300)
            });
            
            return res.json({ success: true, token, user: { id: user._id, username: user.username || user.name } });
        }

        if (action === 'verify') {
            const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
            if (!token || typeof token !== 'string') return res.status(401).json({ error: 'No token' });
            
            const session = await Session.findOne(sessionTokenQuery(token));
            if (!session) return res.status(401).json({ error: 'Session expired' });

            const user = await User.findById(session.userId).select('username isActive isBanned');
            if (!user || user.isBanned || user.isActive === false) {
                await Session.deleteOne({ _id: session._id });
                return res.status(403).json({ error: 'Bu hesap devre dışı' });
            }
            
            return res.json({
                success: true,
                user: { id: user._id, username: user.username || session.username }
            });
        }

        if (action === 'logout') {
            const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
            if (token && typeof token === 'string') {
                await Session.deleteMany(sessionTokenQuery(token));
            }
            return res.json({ success: true });
        }

        return res.status(404).json({ error: 'Bilinmeyen kimlik doğrulama işlemi' });
    } catch (e) {
        console.error("Auth Error:", e);
        if (e?.code === 11000) {
            return res.status(409).json({ error: 'Bu kullanıcı adı veya e-posta zaten kullanılıyor' });
        }
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

app.post('/api/sync-history', authenticateToken, async (req, res) => {
    try {
        const { history } = req.body;
        if (!history || !history.imdbId) return res.status(400).json({ error: "Invalid data" });

        if (req.localAuthSession) {
            const key = history.season ? `${history.imdbId}_s${history.season}_e${history.episode}` : history.imdbId;
            const existingHistory = localDevWatchHistory.get(req.user.id) || {};
            const nextHistory = req.body.fullSync
                ? { ...existingHistory, ...history }
                : { ...existingHistory, [key]: history };

            localDevWatchHistory.set(req.user.id, nextHistory);
            return res.json({ success: true, local: true });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const key = history.season ? `${history.imdbId}_s${history.season}_e${history.episode}` : history.imdbId;
        
        if (req.body.fullSync) {
             user.watchHistory = { ...user.watchHistory, ...history };
        } else {
             user.watchHistory = { ...user.watchHistory, [key]: history };
        }
        
        user.markModified('watchHistory');
        await user.save();

        res.json({ success: true });
    } catch (e) {
        console.error("Sync Error:", e);
        res.status(500).json({ error: "Sync failed" });
    }
});

app.get('/api/get-history', authenticateToken, async (req, res) => {
    try {
        if (req.localAuthSession) {
            return res.json(localDevWatchHistory.get(req.user.id) || {});
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user.watchHistory || {});
    } catch (e) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

// Diziyou Source Finder Endpoint
const createDiziyouSlug = (text) => {
    return text.toString().toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/&/g, '-').replace(/\+/g, '-').replace(/\//g, '-')
        .replace(/\\/g, '-').replace(/\|/g, '-')
        .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
        .replace(/-+/g, '-').replace(/^-|-$/g, '');
};

const DIZIYOU_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const PUPPETEER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let scraperBrowserPromise = null;
let scraperBrowserCleanupTimer = null;

const closeScraperBrowser = async () => {
    if (!scraperBrowserPromise) return;

    try {
        const browser = await scraperBrowserPromise;
        await browser.close();
    } catch (error) {
        console.warn('[ScraperBrowser] Close warning:', error.message);
    } finally {
        scraperBrowserPromise = null;
    }
};

const scheduleScraperBrowserCleanup = () => {
    if (scraperBrowserCleanupTimer) {
        clearTimeout(scraperBrowserCleanupTimer);
    }

    scraperBrowserCleanupTimer = setTimeout(() => {
        closeScraperBrowser().catch(() => {});
    }, 2 * 60 * 1000);
};

const getScraperBrowser = async () => {
    if (!scraperBrowserPromise) {
        scraperBrowserPromise = puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ],
            defaultViewport: {
                width: 1365,
                height: 768
            }
        }).catch((error) => {
            scraperBrowserPromise = null;
            throw error;
        });
    }

    scheduleScraperBrowserCleanup();
    return scraperBrowserPromise;
};

const findFrameByPattern = (page, pattern) => page.frames().find(frame => pattern.test(frame.url()));

const normalizeDizigomSubtitle = (track = {}) => {
    if (!track?.file || !/\.vtt(?:[?#]|$)/i.test(track.file)) return null;

    const lower = String(track.file || '').toLowerCase();
    let lang = String(track.label || track.lang || '').toLowerCase();
    if (!lang) {
        if (lower.includes('/tr.') || lower.includes('turk')) lang = 'tr';
        else if (lower.includes('/en.') || lower.includes('english')) lang = 'en';
        else lang = 'und';
    }

    const normalizedLang = lang === 'tur' ? 'tr' : lang === 'eng' ? 'en' : lang;
    const label = normalizedLang === 'tr'
        ? 'Turkce'
        : normalizedLang === 'en'
            ? 'English'
            : (track.label || 'Subtitle');

    return {
        lang: normalizedLang,
        label,
        url: track.file,
        provider: 'dizigom'
    };
};

const resolveDizigomEpisode = async (episodeUrl) => {
    const browser = await getScraperBrowser();
    const page = await browser.newPage();

    try {
        await page.setUserAgent(PUPPETEER_USER_AGENT);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        });

        await page.goto(episodeUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        await page.waitForSelector('iframe[src*="play.dizigom104.com/embed/"]', {
            timeout: 20000
        });

        await waitFor(4000);

        let frame = findFrameByPattern(page, /play\.dizigom104\.com\/embed\//i);
        if (!frame) {
            return null;
        }

        try {
            await frame.click('body');
        } catch (error) {}

        try {
            await frame.waitForFunction(() => {
                try {
                    if (typeof window.jwplayer !== 'function') return false;
                    const player = window.jwplayer('player');
                    if (!player || typeof player.getPlaylist !== 'function') return false;
                    const playlist = player.getPlaylist();
                    const item = Array.isArray(playlist) ? playlist[0] : null;
                    return Boolean(item && (item.file || item?.sources?.[0]?.file));
                } catch (error) {
                    return false;
                }
            }, { timeout: 20000 });
        } catch (error) {
            return null;
        }

        const resolved = await frame.evaluate(() => {
            try {
                if (typeof window.jwplayer !== 'function') return null;
                const player = window.jwplayer('player');
                if (!player || typeof player.getPlaylist !== 'function') return null;

                const playlist = player.getPlaylist();
                const item = Array.isArray(playlist) ? playlist[0] : null;
                if (!item) return null;

                const file = item.file || item?.sources?.[0]?.file || null;
                const tracks = Array.isArray(item.tracks) ? item.tracks : [];

                return {
                    file,
                    tracks,
                    iframeUrl: window.location.href
                };
            } catch (error) {
                return null;
            }
        });

        if (!resolved?.file) {
            return null;
        }

        return {
            original: resolved.file,
            subtitles: (resolved.tracks || [])
                .map(normalizeDizigomSubtitle)
                .filter(Boolean),
            iframeUrl: resolved.iframeUrl || frame.url()
        };
    } finally {
        await page.close().catch(() => {});
        scheduleScraperBrowserCleanup();
    }
};

const findDiziyouPlayerUrl = (html, episodeUrl) => {
    const iframeMatch = html.match(/iframe[^>]+src=["']((?:https:\/\/(?:play\.diziyou\.one|www\.diziyou\.one)\/player\/[^"']+)|(?:\/?player\/[^"']+))["']/i);
    if (iframeMatch?.[1]) {
        return new URL(iframeMatch[1], episodeUrl).href;
    }

    const loosePlayerMatch = html.match(/((?:https:\/\/(?:play\.diziyou\.one|www\.diziyou\.one))?\/player\/\d+\.html[^"'\\s<]*)/i);
    if (loosePlayerMatch?.[1]) {
        return new URL(loosePlayerMatch[1], episodeUrl).href;
    }

    return null;
};

const checkDiziyouMediaUrl = async (url) => {
    if (!url) return false;

    try {
        const headResponse = await axios.head(url, {
            headers: DIZIYOU_HEADERS,
            timeout: 4000,
            maxRedirects: 3,
            validateStatus: (status) => status >= 200 && status < 400
        });
        return headResponse.status >= 200 && headResponse.status < 400;
    } catch (headError) {
        try {
            const getResponse = await axios.get(url, {
                headers: DIZIYOU_HEADERS,
                timeout: 5000,
                maxRedirects: 3,
                responseType: 'text',
                validateStatus: (status) => status >= 200 && status < 400
            });

            return typeof getResponse.data === 'string' &&
                (getResponse.data.includes('#EXTM3U') || getResponse.data.trim().length > 0);
        } catch (getError) {
            return false;
        }
    }
};

app.get('/api/diziyou', async (req, res) => {
    const { title, season, episode, originalTitle } = req.query;
    const debugMode = req.query.debug === '1';
    const debugAttempts = [];
    
    if (!title || !season || !episode) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    const titlesToTry = [title];
    if (originalTitle && originalTitle !== title) {
        titlesToTry.push(originalTitle);
    }

    for (const currentTitle of titlesToTry) {
        const attemptDebug = debugMode ? {
            title: currentTitle,
            episodeUrl: null,
            episodeFetched: false,
            playerUrl: null,
            videoId: null,
            playerParsed: false,
            inferredOriginalFromPlayer: false,
            hasOriginal: false,
            hasDub: false,
            error: null
        } : null;

        try {
            const slug = createDiziyouSlug(currentTitle);
            const episodeUrl = `https://www.diziyou.one/${slug}-${season}-sezon-${episode}-bolum/`;
            if (attemptDebug) {
                attemptDebug.episodeUrl = episodeUrl;
            }
            
            // Fetch episode page
            const episodeResponse = await axios.get(episodeUrl, {
                headers: DIZIYOU_HEADERS,
                timeout: 8000
            });
            
            const html = episodeResponse.data;
            if (attemptDebug) {
                attemptDebug.episodeFetched = true;
            }
            
            // Extract player iframe URL
            const playerUrl = findDiziyouPlayerUrl(html, episodeUrl);
            if (attemptDebug) {
                attemptDebug.playerUrl = playerUrl;
            }
            if (!playerUrl) {
                if (attemptDebug) debugAttempts.push(attemptDebug);
                continue; // Try next title
            }
            
            // Extract video ID from player URL
            const videoIdMatch = playerUrl.match(/player\/(\d+)\.html/i);
            if (!videoIdMatch) {
                if (attemptDebug) debugAttempts.push(attemptDebug);
                continue;
            }
            
            const videoId = videoIdMatch[1];
            if (attemptDebug) {
                attemptDebug.videoId = videoId;
            }
            
            // Check which sources are available
            let originalUrl = `https://storage.diziyou.one/episodes/${videoId}/play.m3u8`;
            const dubUrl = `https://storage.diziyou.one/episodes/${videoId}_tr/play.m3u8`;
            let subtitles = [];
            let inferredOriginalFromPlayer = false;
            
            // New Diziyou player page exposes the real master playlist and subtitle tracks.
            // Prefer parsing it because the site no longer always uses play.diziyou.one.
            try {
                const playerResponse = await axios.get(playerUrl, {
                    headers: DIZIYOU_HEADERS,
                    timeout: 8000
                });

                const playerHtml = playerResponse.data;
                const sourceMatch = playerHtml.match(/<source[^>]+src=["'](https:\/\/storage\.diziyou\.one\/episodes\/[^"']+\.m3u8)["']/i);
                if (sourceMatch) {
                    originalUrl = sourceMatch[1];
                    inferredOriginalFromPlayer = true;
                }

                const subtitleMatches = [...playerHtml.matchAll(/<track[^>]+src=["'](https:\/\/storage\.diziyou\.one\/subtitles\/[^"']+\.vtt)["'][^>]+srclang=["']([^"']+)["'][^>]+label=["']([^"']+)["']/gi)];
                subtitles = subtitleMatches.map(([, url, lang, label]) => ({ lang, url, label }));
                if (attemptDebug) {
                    attemptDebug.playerParsed = true;
                    attemptDebug.inferredOriginalFromPlayer = inferredOriginalFromPlayer;
                }
            } catch (e) {
                console.warn(`Diziyou player parse error for ${playerUrl}:`, e.message);
                if (attemptDebug) {
                    attemptDebug.error = `player-parse: ${e.message}`;
                }
            }

            let hasOriginal = false;
            let hasDub = false;
            
            // Check original
            hasOriginal = await checkDiziyouMediaUrl(originalUrl);
            
            // Check dub
            hasDub = await checkDiziyouMediaUrl(dubUrl);
            if (attemptDebug) {
                attemptDebug.hasOriginal = hasOriginal;
                attemptDebug.hasDub = hasDub;
            }
            
            const allowInferredOriginal = inferredOriginalFromPlayer;
            if (!hasOriginal && !hasDub && !allowInferredOriginal) {
                if (attemptDebug) debugAttempts.push(attemptDebug);
                continue;
            }

            if (subtitles.length === 0) {
                subtitles = [
                    { lang: 'tr', url: `https://storage.diziyou.one/subtitles/${videoId}/tr.vtt`, label: 'Turkce' },
                    { lang: 'en', url: `https://storage.diziyou.one/subtitles/${videoId}/en.vtt`, label: 'English' }
                ];
            }

            // Return available sources
            return res.json({
                success: true,
                original: (hasOriginal || allowInferredOriginal) ? originalUrl : null,
                turkish_dub: hasDub ? dubUrl : null,
                hasOriginal: hasOriginal || allowInferredOriginal,
                hasDub,
                subtitles,
                ...(debugMode ? { debug: debugAttempts.concat(attemptDebug ? [{ ...attemptDebug, hasOriginal: hasOriginal || allowInferredOriginal, hasDub }] : []) } : {})
            });
            
        } catch (error) {
            // If 404, just continue to next title
            if (attemptDebug) {
                attemptDebug.error = error.response?.status === 404
                    ? 'episode-404'
                    : (error.message || 'unknown-error');
                debugAttempts.push(attemptDebug);
            }
            if (error.response && error.response.status === 404) continue;
            // For other errors, we can log or continue
            console.error(`Diziyou fetch error for ${currentTitle}:`, error.message);
        }
    }
    
    res.json({
        success: false,
        error: 'No player found on Diziyou after trying all title variations',
        ...(debugMode ? { debug: debugAttempts } : {})
    });
});

app.get('/api/dizigom', async (req, res) => {
    const { title, season, episode, originalTitle } = req.query;

    if (!title || !season || !episode) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const titlesToTry = [title];
    if (originalTitle && originalTitle !== title) {
        titlesToTry.push(originalTitle);
    }

    for (const currentTitle of titlesToTry) {
        try {
            const slug = createDiziyouSlug(currentTitle);
            const episodeUrls = [
                `https://dizigom104.com/${slug}-${season}-sezon-${episode}-bolum-hd2/`,
                `https://dizigom104.com/${slug}-${season}-sezon-${episode}-bolum/`
            ];

            for (const episodeUrl of episodeUrls) {
                const resolved = await resolveDizigomEpisode(episodeUrl);

                if (resolved?.original) {
                    return res.json({
                        success: true,
                        original: resolved.original,
                        url: resolved.original,
                        subtitles: resolved.subtitles || [],
                        iframeUrl: resolved.iframeUrl || null,
                        episodeUrl,
                        resolvedBy: 'browser'
                    });
                }
            }
        } catch (error) {
            console.error(`[Dizigom] Resolve error for ${currentTitle}:`, error.message);
        }
    }

    return res.json({
        success: false,
        error: 'No player found on Dizigom after trying all title variations'
    });
});

// Dizimom Source Finder Endpoint (WordPress REST API approach)
const DIZIMOM_BASE = 'https://www.dizimom.fit';

const extractPlayerFromContent = (html) => {
    // Try hdplayersystem (new format: /video/{id})
    const hdMatchNew = html.match(/iframe[^>]+src=["'](https:\/\/hdplayersystem\.com\/video\/([a-f0-9]+))['"]/i);
    if (hdMatchNew) return { type: 'hdplayersystem', url: hdMatchNew[1], videoId: hdMatchNew[2], format: 'new' };
    // Try hdplayersystem (old format: /player/index.php?data=xxx)
    const hdMatchOld = html.match(/iframe[^>]+src=["'](https:\/\/hdplayersystem\.com\/player\/index\.php\?data=([a-f0-9]+)[^"']*)['"]/i);
    if (hdMatchOld) return { type: 'hdplayersystem', url: hdMatchOld[1], videoId: hdMatchOld[2], format: 'old' };
    // Try hdmomplayer
    const momMatch = html.match(/iframe[^>]+src=["'](https:\/\/hdmomplayer\.com\/embed\/([a-zA-Z0-9]+))['"]/i);
    if (momMatch) return { type: 'hdmomplayer', url: momMatch[1], videoId: momMatch[2] };
    return null;
};

const resolvePlayer = async (player, refererUrl) => {
    try {
        if (player.type === 'hdplayersystem') {
            const videoRes = await axios.post(
                'https://hdplayersystem.com/player/index.php?data=' + player.videoId + '&do=getVideo',
                `hash=${player.videoId}&r=${encodeURIComponent(refererUrl)}`,
                {
                    headers: {
                        'Referer': 'https://www.dizimom.fit/',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            if (videoRes.data && videoRes.data.securedLink) return videoRes.data.securedLink;
        } else if (player.type === 'hdmomplayer') {
            const resolved = await resolveDizimom(player.url, refererUrl);
            if (resolved) return resolved;
        }
    } catch (e) { /* ignore */ }
    return null;
};

const validateVideoUrl = async (url) => {
    if (!url) return false;
    try {
        const response = await axios.head(url, { timeout: 5000, maxRedirects: 2 });
        return response.status >= 200 && response.status < 400;
    } catch (e) {
        return false;
    }
};

const searchDizimomWPAPI = async (searchQuery, per_page = 10) => {
    try {
        const response = await axios.get(`${DIZIMOM_BASE}/wp-json/wp/v2/posts`, {
            params: { search: searchQuery, per_page },
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 8000
        });
        return response.data || [];
    } catch (e) {
        console.error('[Dizimom] WP API search error:', e.message);
        return [];
    }
};

app.get('/api/dizimom', async (req, res) => {
    const { title, season, episode } = req.query;
    
    if (!title || !season || !episode) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    try {
        // Detect Turkish-style numbering (high episode numbers in season field)
        // Turkish shows like Konuşanlar have 200+ episodes, no seasons
        const s = parseInt(season);
        const e = parseInt(episode);
        const isTurkishStyle = s > 50 && e === 1;
        
        // Generate appropriate search queries
        let searchQueries = [];
        if (isTurkishStyle) {
            // Turkish show: "Konuşanlar 206.Bölüm"
            searchQueries = [
                `${title} ${s}.Bölüm`,
                `${title} ${s - 1}.Bölüm`
            ];
        } else {
            // Normal show: "Breaking Bad 1.Sezon 1.Bölüm" and fallback "Breaking Bad 1.Bölüm"
            searchQueries = [
                `${title} ${s}.Sezon ${e}.Bölüm`,
                `${title} ${e}.Bölüm`
            ];
        }
        
        console.log(`[Dizimom] Searching WP API: "${searchQueries[0]}"`);
        
        // Search all queries in parallel
        const results = await Promise.all(searchQueries.map(q => searchDizimomWPAPI(q, 10)));
        
        // Combine and deduplicate by ID
        const postMap = new Map();
        for (const posts of results) {
            for (const post of posts) {
                if (!postMap.has(post.id)) postMap.set(post.id, post);
            }
        }
        const posts = Array.from(postMap.values());
        
        if (!posts.length) {
            return res.json({ success: false, error: 'No results from WP API search' });
        }

        // Build regex patterns for matching episode titles
        // Handle both normal (1.Sezon 1.Bölüm) and Turkish-style (206.Bölüm)
        let subPattern, dubPattern, yerliPattern;
        
        if (isTurkishStyle) {
            // Turkish show: match episode number anywhere in title (e.g., "206.Bölüm izle")
            subPattern = new RegExp(`${s}\\.?\\s*B[öo]l[üu]m(?!.*[Dd]ublaj)`, 'i');
            dubPattern = new RegExp(`${s}\\.?\\s*B[öo]l[üu]m.*[Dd]ublaj`, 'i');
            yerliPattern = subPattern;
        } else {
            // Normal show: 1.Sezon 1.Bölüm format
            subPattern = new RegExp(`${s}\\.?\\s*Sezon\\s+${e}\\.?\\s*B[öo]l[üu]m(?!.*[Dd]ublaj)`, 'i');
            dubPattern = new RegExp(`${s}\\.?\\s*Sezon\\s+${e}\\.?\\s*B[öo]l[üu]m.*[Dd]ublaj`, 'i');
            // For yerli diziler (no season in title, just bolum)
            yerliPattern = new RegExp(`${e}\\.?\\s*B[öo]l[üu]m(?!.*[Dll]ublaj)`, 'i');
        }

        let original = null;
        let turkish_dub = null;
        let subPost = null;
        let dubPost = null;

        for (const post of posts) {
            const postTitle = post.title?.rendered || '';
            // Check title contains the show name (loose match)
            const titleLower = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const postTitleLower = postTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // For Turkish shows, also match without removing numbers
            const titleMatch = postTitleLower.includes(titleLower) || 
                titleLower.includes(postTitleLower.replace(/\d+.*$/g, '').trim());
            
            if (!titleMatch) {
                continue; // Skip posts that don't match the show name
            }

            const subMatch = subPattern.test(postTitle);
            const yerliMatch = yerliPattern?.test(postTitle);
            const dubMatch = dubPattern.test(postTitle);
            
            console.log(`[Dizimom] Matching: "${postTitle}" | isTurkish:${isTurkishStyle} | s:${s} | subMatch:${subMatch} | yerliMatch:${yerliMatch}`);
            
            if (dubMatch) {
                dubPost = post;
            } else if (subMatch || yerliMatch) {
                subPost = post;
            }
        }

        // Extract and resolve player from matched posts
        const resolvePost = async (post) => {
            if (!post) return null;
            const content = post.content?.rendered || '';
            const player = extractPlayerFromContent(content);
            if (!player) {
                // If WP API didn't include content, fetch the episode page directly
                try {
                    const pageRes = await axios.get(post.link, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        timeout: 5000
                    });
                    const pagePlayer = extractPlayerFromContent(pageRes.data);
                    if (pagePlayer) return resolvePlayer(pagePlayer, post.link);
                } catch (e) { /* ignore */ }
                return null;
            }
            return resolvePlayer(player, post.link);
        };

        // Resolve both sub and dub in parallel
        const [subResult, dubResult] = await Promise.all([
            resolvePost(subPost),
            resolvePost(dubPost)
        ]);

        original = subResult;
        turkish_dub = dubResult;

        // Validate URLs are actually accessible before returning success
        const [originalValid, dubValid] = await Promise.all([
            original ? validateVideoUrl(original) : Promise.resolve(false),
            turkish_dub ? validateVideoUrl(turkish_dub) : Promise.resolve(false)
        ]);

        if (!originalValid) original = null;
        if (!dubValid) turkish_dub = null;

        // Only return success if at least one working URL was found
        if (original || turkish_dub) {
            return res.json({
                success: true,
                original: original,
                turkish_dub: turkish_dub,
                url: original || turkish_dub,
                subtitles
            });
        }
        
        res.json({ success: false, error: 'No player provider matched' });
    } catch (error) {
        console.error('[Dizimom] Error:', error.message);
        res.json({ success: false, error: error.message });
    }
});

// Video Proxy Endpoint - Handles Referer spoofing and Range headers for streaming
app.get('/api/video-proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL missing');

    const customReferer = req.query.referer;

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };

        // If a dynamic referer is supplied, prioritize it!
        if (customReferer) {
            headers['Referer'] = customReferer;
            try {
                headers['Origin'] = new URL(customReferer).origin;
            } catch (e) {}
        } else {
            // Intelligent Referer and Origin spoofing
            if (targetUrl.includes('hdplayersystem.com')) {
                headers['Referer'] = 'https://hdplayersystem.com/';
                headers['Origin'] = 'https://hdplayersystem.com';
            } else if (targetUrl.includes('hdmomplayer.com')) {
                headers['Referer'] = 'https://hdmomplayer.com/';
                headers['Origin'] = 'https://hdmomplayer.com';
            } else if (targetUrl.includes('diziyou') || targetUrl.includes('dystream.com')) {
                headers['Referer'] = 'https://www.diziyou.one/';
                headers['Origin'] = 'https://www.diziyou.one';
            } else if (targetUrl.includes('play.dizigom104.com') || targetUrl.includes('df856-54hilsnz.xyz')) {
                headers['Referer'] = 'https://play.dizigom104.com/';
                headers['Origin'] = 'https://play.dizigom104.com';
            } else if (targetUrl.includes('vidmody')) {
                headers['Referer'] = 'https://vidmody.com/';
                headers['Origin'] = 'https://vidmody.com';
            } else if (
                targetUrl.includes('streamdata.vaplayer.ru') ||
                targetUrl.includes('tmstrd.justhd.tv') ||
                targetUrl.includes('onlinecoachingacademy.site') ||
                targetUrl.includes('justhd.tv') ||
                targetUrl.includes('nextlevelbrandstudio.site') ||
                targetUrl.includes('premiumleadgeneration.site')
            ) {
                headers['Referer'] = 'https://nextgencloudfabric.com/';
                headers['Origin'] = 'https://nextgencloudfabric.com';
            }
        }

        // Handle Range for seeking in video files (.ts, .mp4)
        if (req.headers.range && !targetUrl.includes('.m3u8')) {
            headers['Range'] = req.headers.range;
        }

        const isM3U8 = targetUrl.includes('.m3u8') || targetUrl.includes('.m3u');

        const refererLower = String(customReferer || '').toLowerCase();
        const isStreamimdb = refererLower.includes('brightpathsignals.com') || refererLower.includes('nextgencloudfabric.com') || refererLower.includes('streamimdb.ru') ||
            targetUrl.includes('streamdata.vaplayer.ru') ||
            targetUrl.includes('tmstrd.justhd.tv') ||
            targetUrl.includes('onlinecoachingacademy.site') ||
            targetUrl.includes('justhd.tv') ||
            targetUrl.includes('nextlevelbrandstudio.site') ||
            targetUrl.includes('premiumleadgeneration.site');
        let requestUrl = targetUrl;
        let proxyAgent = undefined;

        if (isStreamimdb) {
            if (USE_TOR && torAgent) {
                proxyAgent = torAgent;
            } else {
                const workerUrl = process.env.VITE_WORKER_URL || 'https://ancient-math-1d1b.arslab.workers.dev';
                requestUrl = `${workerUrl}?url=${encodeURIComponent(targetUrl)}&mode=proxy`;
                if (customReferer) {
                    requestUrl += `&referer=${encodeURIComponent(customReferer)}`;
                }
            }
        }

        const response = await axios({
            method: 'get',
            url: requestUrl,
            responseType: isM3U8 ? 'text' : 'stream',
            headers: headers,
            timeout: 30000,
            httpAgent: proxyAgent,
            httpsAgent: proxyAgent,
            validateStatus: false
        });

        // Set basic response headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.status);

        if (isM3U8) {
            let content = response.data;
            if (typeof content !== 'string') {
                content = content.toString();
            }

            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            // Append referer to downstream segments so they bypass 403 as well!
            const proxyBase = `${req.protocol}://${req.get('host')}/api/video-proxy?` + 
                (customReferer ? `referer=${encodeURIComponent(customReferer)}&` : '') + 'url=';

            // Rewrite M3U8 content: Relative and Absolute URLs
            const lines = content.split('\n');
            const rewrittenLines = lines.map(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return line;
                
                let absoluteUrl = trimmed;
                try {
                    if (!trimmed.startsWith('http')) {
                        absoluteUrl = new URL(trimmed, baseUrl).href;
                    }
                    return proxyBase + encodeURIComponent(absoluteUrl);
                } catch (e) {
                    return line;
                }
            });

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewrittenLines.join('\n'));
        } else {
            // Forward essential headers for streaming files (.ts, .mp4, etc.)
            if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
            if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
            if (response.headers['content-range']) res.setHeader('Content-Range', response.headers['content-range']);
            if (response.headers['accept-ranges']) res.setHeader('Accept-Ranges', response.headers['accept-ranges']);

            response.data.pipe(res);
            response.data.on('error', (err) => {
                console.error('Stream pipe error:', err.message);
                res.end();
            });
        }

    } catch (error) {
        console.error('Backend Proxy Error:', error.message);
        if (!res.headersSent) {
            res.status(500).send('Proxy error: ' + error.message);
        }
    }
});

class DebridService {
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
const debrid = new DebridService();

const tmdbCache = new Map();
app.get('/api/tmdb', async (req, res) => {
    if (!CONFIG.TMDB_API_KEY) return res.status(503).json({ success: false, error: 'TMDB API key not configured' });
    const endpoint = req.query.endpoint;
    if (!endpoint) return res.status(400).json({ success: false, error: 'Endpoint required' });

    if (tmdbCache.has(endpoint)) {
        const { data, timestamp } = tmdbCache.get(endpoint);
        if (Date.now() - timestamp < 5 * 60 * 1000) return res.json(data);
    }

    try {
        const separator = endpoint.includes('?') ? '&' : '?';
        const tmdbUrl = `https://api.themoviedb.org/3${endpoint}${separator}api_key=${CONFIG.TMDB_API_KEY}&language=tr-TR`;
        
        const response = await axios.get(tmdbUrl, { timeout: 10000 });
        tmdbCache.set(endpoint, { data: response.data, timestamp: Date.now() });
        if (tmdbCache.size > 100) tmdbCache.delete(tmdbCache.keys().next().value);
        
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ success: false, error: error.message });
    }
});

const TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://tracker.bittor.pw:1337/announce',
    'udp://public.popcorn-tracker.org:6969/announce'
].map(t => `&tr=${encodeURIComponent(t)}`).join('');

const torrentioCache = new Map();

app.get('/api/magnet', async (req, res) => {
    const { get_stream, hash, imdb_id, type, season, episode, dubbed } = req.query;

    if (get_stream === 'true' && hash) {
        return res.json({
            magnet: `magnet:?xt=urn:btih:${hash}&dn=Video${TRACKERS}`,
            source: 'magnet'
        });
    }

    if (!imdb_id) return res.status(400).json({ error: 'IMDB ID required' });

    const cacheKey = `${imdb_id}_${type}_${season}_${episode}`;
    if (torrentioCache.has(cacheKey)) return res.json(torrentioCache.get(cacheKey));

    try {
        const s = season || 1;
        const e = episode || 1;
        const isSeries = type === 'tv' || type === 'series';
        
        const torrentioUrl = isSeries
            ? `https://torrentio.strem.fun/stream/series/${imdb_id}:${s}:${e}.json`
            : `https://torrentio.strem.fun/stream/movie/${imdb_id}.json`;

        const [torrentioRes, ytsRes] = await Promise.all([
            axios.get(torrentioUrl).catch(() => ({ data: { streams: [] } })),
            !isSeries ? axios.get(`https://yts.mx/api/v2/list_movies.json?query_term=${imdb_id}`).catch(() => ({ data: {} })) : Promise.resolve({ data: {} })
        ]);

        let streams = torrentioRes.data.streams || [];
        
        streams = streams.map(s => {
            const seeds = (s.title || '').match(/👤\s*(\d+)/)?.[1] || 0;
            return {
                infoHash: s.infoHash,
                title: (s.title || 'Video').split('\n')[0],
                quality: (s.name || '').match(/(\d{3,4}p|4K)/i)?.[0] || 'HD',
                seeds: parseInt(seeds),
                source: 'Torrentio'
            };
        });

        if (ytsRes.data?.data?.movies) {
            ytsRes.data.data.movies.forEach(m => {
                if (m.torrents) {
                    m.torrents.forEach(t => {
                        streams.push({
                            infoHash: t.hash,
                            title: m.title,
                            quality: t.quality.toUpperCase(),
                            seeds: t.seeds,
                            source: 'YTS'
                        });
                    });
                }
            });
        }

        const unique = [];
        const seen = new Set();
        streams.forEach(item => {
            if (!seen.has(item.infoHash)) {
                seen.add(item.infoHash);
                unique.push(item);
            }
        });

        if (dubbed === 'true') {
             unique.sort((a, b) => {
                 const trRegex = /türkçe|turkce|dublaj/i;
                 const aTR = trRegex.test(a.title);
                 const bTR = trRegex.test(b.title);
                 if (aTR === bTR) return b.seeds - a.seeds;
                 return bTR - aTR;
             });
        } else {
             unique.sort((a, b) => b.seeds - a.seeds);
        }

        const response = { options: unique.slice(0, 20) };
        torrentioCache.set(cacheKey, response);
        res.json(response);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get(['/subtitles', '/api/subtitles'], async (req, res) => {
    const { imdb, season, episode, source } = req.query;
    if (!imdb) return res.json([]);

    try {
        const cleanId = imdb.replace('tt', '');
        const preferMoreTurkishStremio = String(source || '').toLowerCase() === 'streamimdb';
        
        // 1. Fetch from Stremio Proxy
        const stremioPromise = (async () => {
            try {
                const url = (season && episode)
                    ? `https://opensubtitles-v3.strem.io/subtitles/series/tt${cleanId}:${season}:${episode}.json`
                    : `https://opensubtitles-v3.strem.io/subtitles/movie/tt${cleanId}.json`;
                const response = await axios.get(url, { timeout: 8000 });
                const stremioCandidates = (response.data?.subtitles || [])
                    .filter(s => ['tur', 'eng', 'tr', 'en'].includes(s.lang))
                    .map((s, index) => ({
                        id: s.id,
                        lang: normalizeSubtitleLangCode(s.lang),
                        url: s.url,
                        provider: 'stremio',
                        stremioIndex: index + 1,
                        label: (s.lang === 'tur' || s.lang === 'tr')
                            ? `Türkçe (Stremio ${index + 1})`
                            : `English (Stremio ${index + 1})`
                    }));

                if (!preferMoreTurkishStremio) return stremioCandidates;

                let turkishIndex = 0;
                return stremioCandidates.map((subtitle) => {
                    if (subtitle.lang !== 'tr') return subtitle;
                    turkishIndex += 1;
                    return {
                        ...subtitle,
                        label: `Türkçe (Stremio ${turkishIndex})`,
                        preserveOption: turkishIndex <= 6
                    };
                });
            } catch (e) {
                return [];
            }
        })();

        // 2. Fetch from OpenSubtitles API
        const osPromise = (async () => {
            try {
                const searchParams = {
                    imdbid: cleanId,
                    limit: 'all'
                };
                if (season && episode) {
                    searchParams.season = season;
                    searchParams.episode = episode;
                }

                const subtitles = await OS.search(searchParams);
                const results = [];

                if (subtitles.tr) {
                    subtitles.tr.forEach(sub => {
                        results.push({
                            id: sub.id,
                            lang: 'tr',
                            url: sub.url,
                            provider: 'opensubtitles',
                            score: Number(sub.score) || 0,
                            label: `Türkçe (${sub.score} - OS)`
                        });
                    });
                }
                if (subtitles.en) {
                    subtitles.en.forEach(sub => {
                        results.push({
                            id: sub.id,
                            lang: 'en',
                            url: sub.url,
                            provider: 'opensubtitles',
                            score: Number(sub.score) || 0,
                            label: `English (${sub.score} - OS)`
                        });
                    });
                }
                return results;
            } catch (e) {
                console.error("OpenSubtitles API Error:", e.message);
                return [];
            }
        })();

        const [stremioSubs, osSubs] = await Promise.all([stremioPromise, osPromise]);
        const allSubs = await prioritizeExternalSubtitleResults(
            dedupeSubtitleResults([...osSubs, ...stremioSubs])
        );

        if (preferMoreTurkishStremio) {
            stremioSubs
                .filter(sub => sub.lang === 'tr' && sub.preserveOption)
                .forEach(sub => {
                    if (!allSubs.some(existing => existing.url === sub.url)) {
                        allSubs.push(sub);
                    }
                });
        }

        // Sort: Turkish first, then English
        allSubs.sort((a, b) => {
            if (a.lang === b.lang) return 0;
            return (a.lang === 'tur' || a.lang === 'tr') ? -1 : 1;
        });

        // Wrap URLs in local proxy to ensure VTT format and CORS compliance
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const finalSubs = allSubs.map(sub => ({
            ...sub,
            url: `${baseUrl}/api/subtitle-proxy?url=${encodeURIComponent(sub.url)}`
        }));
        
        res.json(finalSubs);
    } catch (e) {
        console.error("Subtitle Endpoint Error:", e);
        res.json([]);
    }
});

const createSlug = (text) => {
    if (!text) return "";
    const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ı': 'i', 'ö': 'o', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'İ': 'i', 'Ö': 'o' };
    return text.split('').map(char => trMap[char] || char).join('')
        .toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
};

app.get('/api/scrape-iframe', async (req, res) => {
    const { site, slug, title, original, s, e } = req.query;
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0 Safari/537.36' };

    try {
        let iframeSrc = null;

        if (site === 'filmizlejet') {
            const searchSlug = createSlug(title);
            const directUrl = `https://filmizlejet.com/${searchSlug}/`;
            
            try {
                const resp = await axios.get(directUrl, { headers, timeout: 5000 });
                if (resp.data.includes('player-frame')) {
                    const $ = cheerio.load(resp.data);
                    iframeSrc = $('iframe').attr('src') || $('iframe').attr('data-src');
                }
            } catch (err) { }
        }

        else if (site === 'yabancidizibox' && s && e) {
            const url = `https://yabancidizibox.com/dizi/${slug}/sezon-${s}-bolum-${e}`;
            try {
                const resp = await axios.get(url, { headers, timeout: 5000 });
                const $ = cheerio.load(resp.data);
                iframeSrc = $('iframe').attr('src') || $('iframe').attr('data-src');
            } catch (err) { }
        }

        else if (site === 'hdfilmizle') {
            const url = s && e 
                ? `https://www.hdfilmizle.life/dizi/${slug}/sezon-${s}-bolum-${e}/`
                : `https://www.hdfilmizle.life/${slug}-izle-hd/`;
            
            try {
                const resp = await axios.get(url, { headers, timeout: 5000 });
                const $ = cheerio.load(resp.data);
                iframeSrc = $('iframe[src*="vidrame"], iframe[data-src*="vidrame"]').first().attr('src') 
                         || $('iframe[src*="vidrame"], iframe[data-src*="vidrame"]').first().attr('data-src');
            } catch (err) { }
        }

        if (iframeSrc) {
            if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
            return res.json({ success: true, url: iframeSrc });
        }
        res.status(404).json({ success: false, error: 'Not found' });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/stream', async (req, res) => {
    const { magnet, index, season, episode } = req.query;
    if (!magnet) return res.status(400).send("Magnet required");

    try {
        const fileData = await debrid.resolveMagnet(magnet, index, season, episode);
        if (!fileData) return res.status(502).send("Debrid resolution failed");

        if (fileData.isMp4) {
            try {
                const response = await axios({
                    url: fileData.url,
                    method: 'GET',
                    responseType: 'stream',
                    headers: { 'Range': req.headers.range || 'bytes=0-' }
                });
                res.status(response.status);
                ['content-length', 'content-range', 'content-type', 'accept-ranges'].forEach(h => {
                    if (response.headers[h]) res.setHeader(h, response.headers[h]);
                });
                response.data.pipe(res);
            } catch (err) { res.status(502).end(); }
            return;
        }

        const ffmpegProc = ffmpeg(fileData.url)
            .inputOptions(['-reconnect 1', '-reconnect_streamed 1', '-reconnect_delay_max 5'])
            .outputOptions([
                '-movflags frag_keyframe+empty_moov+default_base_moof',
                '-f mp4',
                '-preset ultrafast',
                '-c:v libx264', '-crf 23', '-profile:v main', '-pix_fmt yuv420p',
                '-c:a aac', '-ac 2', '-b:a 128k'
            ])
            .on('error', (err) => {
                console.error('[Stream Error]', err.message);
                if (ffmpegProc) ffmpegProc.kill();
            });
        
        ffmpegProc.pipe(res, { end: true });
        req.on('close', () => {
            if (ffmpegProc) ffmpegProc.kill();
        });

    } catch (e) {
        if (!res.headersSent) res.status(500).send("Server Error");
    }
});

// Image Proxy Endpoint - handles CORS bypass for poster color extraction
app.get('/api/image-proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL required");
    try {
        const targetUrl = new URL(url);
        const allowed = CONFIG.ALLOWED_PROXY_DOMAINS.some(domain => 
            targetUrl.hostname === domain || targetUrl.hostname.endsWith('.' + domain)
        ) || targetUrl.hostname === 'image.tmdb.org' || targetUrl.hostname.endsWith('.tmdb.org');

        if (!allowed) {
            return res.status(403).send("Domain not allowed");
        }

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

        response.data.pipe(res);
    } catch (e) {
        console.error("Image Proxy Error:", e.message);
        if (!res.headersSent) {
            res.status(502).send("Proxy Error: " + e.message + "\nStack: " + e.stack);
        }
    }
});

app.get('/api/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });
    try {
        const targetUrl = new URL(url);
        const allowed = CONFIG.ALLOWED_PROXY_DOMAINS.some(domain => 
            targetUrl.hostname === domain || targetUrl.hostname.endsWith('.' + domain)
        );
        if (!allowed) return res.status(403).json({ error: "Domain not allowed" });

        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
        res.json(response.data);
    } catch (e) { res.status(502).json({ error: "Proxy Error" }); }
});

app.get(['/subtitle-proxy', '/api/subtitle-proxy'], async (req, res) => {
    const { url, offset } = req.query;
    if (!url) return res.status(400).send("URL required");

    try {
        const targetUrl = new URL(url);
        const allowed = CONFIG.ALLOWED_PROXY_DOMAINS.some(domain => 
            targetUrl.hostname === domain || targetUrl.hostname.endsWith('.' + domain)
        );
        if (!allowed) return res.status(403).send("Domain not allowed");

        const response = await axios.get(url, { responseType: 'text' });
        let content = response.data;

        // Check for OpenSubtitles VIP placeholder
        if (content.includes("Become OpenSubtitles.org VIP member")) {
             // Return empty VTT or a user-friendly message if desired, 
             // but empty is safer for the player to not break or show ads.
             res.setHeader('Content-Type', 'text/vtt');
             res.setHeader('Access-Control-Allow-Origin', '*');
             return res.send("WEBVTT\n\n");
        }
        
        const isSrt = !content.trim().startsWith('WEBVTT');
        if (isSrt) {
            content = 'WEBVTT\n\n' + content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        }

        if (offset && parseFloat(offset) !== 0) {
            const shift = parseFloat(offset);
            
            content = content.replace(/(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})/g, (match, h, m, s, ms) => {
                let total = (parseInt(h ? h.replace(':', '') : 0) * 3600) + 
                            (parseInt(m) * 60) + 
                            parseInt(s) + 
                            (parseInt(ms) / 1000);
                
                total += shift;
                if (total < 0) total = 0;

                const nh = Math.floor(total / 3600);
                const nm = Math.floor((total % 3600) / 60);
                const ns = Math.floor(total % 60);
                const nms = Math.round((total % 1) * 1000);

                const hh = nh.toString().padStart(2, '0');
                const mm = nm.toString().padStart(2, '0');
                const ss = ns.toString().padStart(2, '0');
                const mms = nms.toString().padStart(3, '0');

                return h ? `${hh}:${mm}:${ss}.${mms}` : `${mm}:${ss}.${mms}`;
            });
        }

        res.setHeader('Content-Type', 'text/vtt');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(content);
    } catch (e) {
        console.error("Subtitle Proxy Error:", e.message);
        res.status(500).send("Error");
    }
});

const parseM3U8Manifest = (content, baseUrl) => {
    const result = {
        videos: [],
        audios: [],
        subtitles: []
    };

    const lines = content.split('\n');
    
    const resolveUrl = (url) => {
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        const base = baseUrl.replace(/\/[^\/]*$/, '');
        return url.startsWith('/') ? baseUrl.split('/').slice(0, 3).join('/') + url : base + '/' + url;
    };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES')) {
            const nameMatch = line.match(/NAME="([^"]+)"/);
            const langMatch = line.match(/LANGUAGE="([^"]+)"/);
            const uriMatch = line.match(/URI="([^"]+)"/);
            
            if (uriMatch) {
                result.subtitles.push({
                    name: nameMatch?.[1] || langMatch?.[1] || 'Unknown',
                    lang: langMatch?.[1] || 'und',
                    url: resolveUrl(uriMatch[1])
                });
            }
        }
        
        if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
            const nameMatch = line.match(/NAME="([^"]+)"/);
            const langMatch = line.match(/LANGUAGE="([^"]+)"/);
            const uriMatch = line.match(/URI="([^"]+)"/);
            const defaultMatch = line.match(/DEFAULT=(YES|NO)/);
            
            if (uriMatch) {
                result.audios.push({
                    name: nameMatch?.[1] || langMatch?.[1] || 'Unknown',
                    lang: langMatch?.[1] || 'und',
                    url: resolveUrl(uriMatch[1]),
                    isDefault: defaultMatch?.[1] === 'YES'
                });
            }
        }
        
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
            const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            
            const nextLine = lines[i + 1]?.trim();
            if (nextLine && !nextLine.startsWith('#')) {
                result.videos.push({
                    bandwidth: parseInt(bandwidthMatch?.[1] || 0),
                    resolution: resolutionMatch?.[1] || 'unknown',
                    url: resolveUrl(nextLine)
                });
            }
        }
    }

    result.videos.sort((a, b) => b.bandwidth - a.bandwidth);

    return result;
};

const normalizeSubtitleLangCode = (lang = '') => {
    const normalized = String(lang || '').toLowerCase();
    if (normalized === 'tur') return 'tr';
    if (normalized === 'eng') return 'en';
    return normalized;
};

const dedupeSubtitleResults = (subtitles = []) => {
    const seen = new Set();
    const result = [];

    subtitles.forEach((subtitle) => {
        if (!subtitle?.url) return;
        const key = subtitle.url || `${subtitle.id || ''}:${subtitle.lang || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(subtitle);
    });

    return result;
};

const subtitleCandidateCache = new LRUCache({ max: 500, ttl: 1000 * 60 * 30 });

const getExternalSubtitleProvider = (subtitle = {}) => {
    const provider = String(subtitle.provider || '').toLowerCase();
    if (provider) return provider;

    const label = `${subtitle.label || ''} ${subtitle.name || ''}`.toLowerCase();
    const url = String(subtitle.url || '').toLowerCase();

    if (label.includes('stremio') || url.includes('strem.io')) return 'stremio';
    if (label.includes('opensubtitles') || label.includes('- os') || url.includes('opensubtitles')) return 'opensubtitles';
    return 'other';
};

const getExternalSubtitleScore = (subtitle = {}) => {
    const numericScore = Number(subtitle.score);
    if (Number.isFinite(numericScore)) return numericScore;

    const label = `${subtitle.label || ''} ${subtitle.name || ''}`;
    const scoreMatch = label.match(/\(([\d.]+)\s*-\s*OS\)/i);
    if (scoreMatch) return Number(scoreMatch[1]);

    return -1;
};

const hasUsableSubtitlePayload = (content = '') => {
    const text = String(content || '').trim();
    if (!text) return false;
    if (text.includes('Become OpenSubtitles.org VIP member')) return false;

    if (text.startsWith('WEBVTT')) {
        return /-->/m.test(text);
    }

    return /-->/m.test(text) || /^\d+\s*$/m.test(text);
};

const validateExternalSubtitleCandidate = async (subtitle = {}) => {
    if (!subtitle?.url) return false;

    if (subtitleCandidateCache.has(subtitle.url)) {
        return subtitleCandidateCache.get(subtitle.url);
    }

    try {
        const response = await axios.get(subtitle.url, {
            responseType: 'text',
            timeout: 8000,
            maxContentLength: 1024 * 1024,
            validateStatus: (status) => status >= 200 && status < 400
        });
        const usable = hasUsableSubtitlePayload(response.data);
        subtitleCandidateCache.set(subtitle.url, usable);
        return usable;
    } catch (e) {
        subtitleCandidateCache.set(subtitle.url, false);
        return false;
    }
};

const prioritizeExternalSubtitleResults = async (subtitles = []) => {
    const grouped = new Map();

    subtitles.forEach((subtitle) => {
        if (!subtitle?.url) return;
        const lang = normalizeSubtitleLangCode(subtitle.lang || 'und');
        const list = grouped.get(lang) || [];
        list.push(subtitle);
        grouped.set(lang, list);
    });

    const languageOrder = ['tr', 'en'];
    const sortedLanguages = [
        ...languageOrder.filter(lang => grouped.has(lang)),
        ...Array.from(grouped.keys()).filter(lang => !languageOrder.includes(lang))
    ];

    const optimized = [];

    for (const lang of sortedLanguages) {
        const items = grouped.get(lang) || [];
        const opensubtitles = items
            .filter(item => getExternalSubtitleProvider(item) === 'opensubtitles')
            .sort((a, b) => getExternalSubtitleScore(b) - getExternalSubtitleScore(a));

        const stremio = items
            .filter(item => getExternalSubtitleProvider(item) === 'stremio')
            .sort((a, b) => getExternalSubtitleScore(b) - getExternalSubtitleScore(a));

        const others = items.filter(item => {
            const provider = getExternalSubtitleProvider(item);
            return provider !== 'opensubtitles' && provider !== 'stremio';
        });

        const candidates = [...opensubtitles, ...stremio, ...others];
        let selected = null;

        for (const candidate of candidates) {
            if (await validateExternalSubtitleCandidate(candidate)) {
                selected = candidate;
                break;
            }
        }

        if (!selected && candidates.length > 0) {
            selected = candidates[0];
        }

        if (selected) {
            optimized.push(selected);
        }
    }

    return optimized;
};

const findFirstPlaylistAssetUrl = (playlistText, playlistUrl) => {
    const lines = playlistText.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        try {
            return new URL(line, playlistUrl).href;
        } catch {
            return null;
        }
    }
    return null;
};

const isPlayableHttpStatus = (status) => status === 200 || status === 206;

const getVidmodyHeaderVariants = (headers = {}) => {
    const baseHeaders = { ...headers };
    const baseUserAgent = baseHeaders['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const baseAccept = baseHeaders['Accept'] || '*/*';
    const baseAcceptLanguage = baseHeaders['Accept-Language'] || 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7';

    const variants = [
        {
            ...baseHeaders,
            Referer: baseHeaders.Referer || 'https://vidmody.com/',
            Origin: baseHeaders.Origin || 'https://vidmody.com'
        },
        (() => {
            const nextHeaders = { ...baseHeaders };
            delete nextHeaders.Referer;
            delete nextHeaders.Origin;
            return nextHeaders;
        })(),
        {
            'User-Agent': baseUserAgent,
            'Accept': baseAccept,
            'Accept-Language': baseAcceptLanguage
        }
    ];

    const seen = new Set();
    return variants.filter((variant) => {
        const key = JSON.stringify(variant);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const probeRemoteAsset = async (assetUrl, headers) => {
    for (const requestHeaders of getVidmodyHeaderVariants(headers)) {
        try {
            const headResponse = await axios.head(assetUrl, {
                headers: requestHeaders,
                timeout: 5000,
                validateStatus: (s) => s < 500
            });
            if (isPlayableHttpStatus(headResponse.status)) return true;
        } catch (e) {}
    }

    for (const requestHeaders of getVidmodyHeaderVariants(headers)) {
        try {
            const rangeResponse = await axios.get(assetUrl, {
                headers: {
                    ...requestHeaders,
                    Range: 'bytes=0-0'
                },
                timeout: 5000,
                responseType: 'arraybuffer',
                validateStatus: (s) => s < 500
            });
            if (isPlayableHttpStatus(rangeResponse.status)) return true;
        } catch (e) {}
    }

    return false;
};

const validateVidmodyPlaylistUrl = async (playlistUrl, headers) => {
    if (!playlistUrl) return false;

    for (const requestHeaders of getVidmodyHeaderVariants(headers)) {
        try {
            const response = await axios.get(playlistUrl, {
                headers: requestHeaders,
                timeout: 8000,
                responseType: 'text',
                validateStatus: (s) => s < 400
            });

            const content = typeof response.data === 'string' ? response.data : '';
            if (!content) continue;

            if (content.trim().startsWith('WEBVTT')) {
                return true;
            }

            if (!content.includes('#EXTM3U')) {
                continue;
            }

            const firstAssetUrl = findFirstPlaylistAssetUrl(content, playlistUrl);
            if (!firstAssetUrl) continue;

            if (await probeRemoteAsset(firstAssetUrl, requestHeaders)) {
                return true;
            }
        } catch (e) {}
    }

    return false;
};

const filterPlayableVidmodyTracks = async (tracks = [], headers) => {
    const checks = await Promise.all(
        tracks.map(async (track) => {
            const isPlayable = await validateVidmodyPlaylistUrl(track.url, headers);
            return isPlayable ? track : null;
        })
    );

    return checks.filter(Boolean);
};

const normalizeAudioValue = (value) => (value || '').toLowerCase();

const isTurkishAudioTrack = (audio) => {
    const lang = normalizeAudioValue(audio?.lang);
    const name = normalizeAudioValue(audio?.name);
    return lang === 'tr' || lang === 'tur' || name.includes('turk') || name.includes('türk') || name.includes('dublaj');
};

const isOriginalAudioTrack = (audio) => {
    const lang = normalizeAudioValue(audio?.lang);
    const name = normalizeAudioValue(audio?.name);
    return lang === 'en' || lang === 'eng' || name.includes('english') || name.includes('ingilizce') || name.includes('orijinal') || name.includes('original');
};

const normalizeVidmodyAudios = (audios = []) => {
    const ordered = [];
    const used = new Set();

    const appendMatch = (matcher) => {
        const index = audios.findIndex((audio, idx) => !used.has(idx) && matcher(audio));
        if (index === -1) return;
        used.add(index);
        ordered.push(audios[index]);
    };

    appendMatch(isTurkishAudioTrack);
    appendMatch(isOriginalAudioTrack);

    audios.forEach((audio, index) => {
        if (used.has(index)) return;
        used.add(index);
        ordered.push(audio);
    });

    return ordered.map((audio, index) => ({
        ...audio,
        trackId: audio.trackId || `a${index + 1}`
    }));
};

const getVidmodyWorkingAudio = (audios = []) => {
    const defaultAudio = audios.find(audio => audio.isDefault && audio.trackId);
    if (defaultAudio) return defaultAudio.trackId;

    const turkishAudio = audios.find(audio => isTurkishAudioTrack(audio) && audio.trackId);
    if (turkishAudio) return turkishAudio.trackId;

    return audios[0]?.trackId || null;
};

const STREAMIMDB_WRAPPER_ORIGIN = 'https://streamimdb.ru';
const STREAMIMDB_PLAYER_ORIGIN = 'https://nextgencloudfabric.com';
const STREAMIMDB_DATA_API = 'https://streamdata.vaplayer.ru/api.php';

const streamimdbCache = new LRUCache({ max: 200, ttl: 1000 * 60 * 2 });

const getStreamimdbMediaType = (type, season, episode) => {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'tv' || normalized === 'series') return 'tv';
    return season && episode ? 'tv' : 'movie';
};

const buildStreamimdbEmbedPath = (imdbId, mediaType, season, episode) => {
    if (mediaType === 'tv' && season && episode) {
        return `/embed/tv/${imdbId}/${season}/${episode}`;
    }
    return `/embed/movie/${imdbId}`;
};

const getStreamimdbApiHeaders = (referer) => ({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer,
    'Origin': STREAMIMDB_PLAYER_ORIGIN
});

const getStreamimdbPlaylistHeaders = () => ({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': `${STREAMIMDB_PLAYER_ORIGIN}/`,
    'Origin': STREAMIMDB_PLAYER_ORIGIN
});

const getStreamimdbQualityLabel = (streamUrl, index) => {
    try {
        const host = new URL(streamUrl).hostname;
        if (host === 'tmstrd.justhd.tv' || host.endsWith('.justhd.tv')) return 'JustHD';
        if (host.includes('onlinecoachingacademy')) return `Source ${index + 1}`;
        return host.replace(/^www\./, '');
    } catch {
        return `Source ${index + 1}`;
    }
};

const normalizeStreamimdbSubtitles = (subtitles = [], req) => {
    const host = req ? `${req.protocol}://${req.get('host')}` : '';
    return subtitles
        .map((subtitle) => {
            if (!subtitle.url) return null;
            // CORS bypass ve SRT->VTT dönüşümü için subtitle-proxy kullanalım (mutlak URL)
            const proxiedUrl = `${host}/api/subtitle-proxy?url=${encodeURIComponent(subtitle.url)}`;
            return {
                name: subtitle.lang || subtitle.label || 'Subtitle',
                label: subtitle.lang || subtitle.label || 'Subtitle',
                lang: normalizeSubtitleLangCode(subtitle.code || subtitle.lang || 'und'),
                url: proxiedUrl,
                provider: 'streamimdb'
            };
        })
        .filter(Boolean);
};

const normalizeStreamimdbVideos = async (streamUrls = [], req, embedUrl) => {
    const uniqueUrls = Array.from(new Set(
        streamUrls.filter(url => typeof url === 'string' && /^https?:\/\//i.test(url))
    ));

    const workerUrl = process.env.VITE_WORKER_URL || 'https://ancient-math-1d1b.arslab.workers.dev';
    const results = [];

    const useBackendProxy = USE_TOR && torAgent;
    const getStreamProxyUrl = (targetUrl) => {
        if (useBackendProxy) {
            // If Tor is active, proxy the HLS stream/segments through Render's backend Tor proxy
            // to bypass Cloudflare WAF blocks that affect Cloudflare Worker IP ranges.
            return `${req.protocol}://${req.get('host')}/api/video-proxy?` + 
                (embedUrl ? `referer=${encodeURIComponent(embedUrl)}&` : '') + 
                `url=${encodeURIComponent(targetUrl)}`;
        } else {
            // Otherwise, route through Cloudflare Worker proxy
            return `${workerUrl}?url=${encodeURIComponent(targetUrl)}&mode=proxy` + 
                (embedUrl ? `&referer=${encodeURIComponent(embedUrl)}` : '');
        }
    };

    for (let index = 0; index < uniqueUrls.length; index++) {
        const playlistUrl = uniqueUrls[index];
        const qualityBase = getStreamimdbQualityLabel(playlistUrl, index);
        
        try {
            // WE MUST ALWAYS FETCH/PARSE MANIFESTS VIA BACKEND (TOR OR DIRECT)
            // TO BYPASS CORRUPTION/ACCESS RESTRICTIONS FROM REVENUE SITES.
            let requestUrl = playlistUrl;
            let proxyAgent = undefined;

            if (USE_TOR && torAgent) {
                proxyAgent = torAgent;
            } else {
                requestUrl = `${workerUrl}?url=${encodeURIComponent(playlistUrl)}&mode=proxy` + 
                    (embedUrl ? `&referer=${encodeURIComponent(embedUrl)}` : '');
            }

            const response = await axios.get(requestUrl, {
                headers: getStreamimdbPlaylistHeaders(),
                timeout: 8000,
                responseType: 'text',
                httpAgent: proxyAgent,
                httpsAgent: proxyAgent,
                validateStatus: (status) => status < 400
            });

            const content = typeof response.data === 'string' ? response.data : '';
            if (content.includes('#EXTM3U')) {
                const masterProxiedUrl = getStreamProxyUrl(playlistUrl);
                results.push({
                    resolution: 'auto',
                    quality: `${qualityBase} (Otomatik)`,
                    url: masterProxiedUrl,
                    sourceIndex: index,
                    isPlayable: true,
                    label: `${qualityBase} - Otomatik`
                });

                // Parse HLS Master Playlist
                const parsed = parseM3U8Manifest(content, playlistUrl);
                
                if (parsed.videos && parsed.videos.length > 0) {
                    parsed.videos.forEach((video) => {
                        const resolution = video.resolution || 'unknown';
                        let qual = 'auto';
                        
                        if (resolution.includes('1920x1080')) qual = '1080p';
                        else if (resolution.includes('1280x720')) qual = '720p';
                        else if (resolution.includes('854x480')) qual = '480p';
                        else if (resolution.includes('640x360')) qual = '360p';
                        else if (resolution.includes('unknown') && video.bandwidth) {
                            if (video.bandwidth > 3000000) qual = '1080p';
                            else if (video.bandwidth > 1500000) qual = '720p';
                            else if (video.bandwidth > 800000) qual = '480p';
                            else qual = '360p';
                        } else {
                            qual = resolution;
                        }

                        const proxiedUrl = getStreamProxyUrl(video.url);
                        results.push({
                            resolution,
                            quality: `${qualityBase} (${qual})`,
                            url: proxiedUrl,
                            sourceIndex: index,
                            isPlayable: true,
                            label: `${qualityBase} - ${qual}`
                        });
                    });
                    continue;
                }
            }
        } catch (e) {
            console.warn(`[StreamIMDb Parse] Failed to parse/fetch playlist ${playlistUrl}:`, e.message);
        }

        // Fallback: Point to selected proxy URL.
        const proxiedUrl = getStreamProxyUrl(playlistUrl);
        results.push({
            resolution: 'auto',
            quality: qualityBase,
            url: proxiedUrl,
            sourceIndex: index,
            isPlayable: true,
            label: qualityBase
        });
    }

    return results;
};

app.get('/api/streamimdb/resolve', async (req, res) => {
    const { imdbId, tmdbId, type, season, episode } = req.query;
    const forceRefresh = req.query.refresh === '1';
    const mediaId = imdbId || tmdbId;
    const idType = imdbId ? 'imdb' : 'tmdb';
    if (!mediaId) return res.status(400).json({ success: false, error: 'IMDB veya TMDB ID gerekli', source: 'streamimdb' });

    const mediaType = getStreamimdbMediaType(type, season, episode);
    const cacheKey = `${idType}_${mediaId}_${mediaType}_${season || 0}_${episode || 0}`;
    if (!forceRefresh && streamimdbCache.has(cacheKey)) {
        return res.json({ success: true, ...streamimdbCache.get(cacheKey) });
    }

    const embedPath = buildStreamimdbEmbedPath(mediaId, mediaType, season, episode);
    const embedUrl = `${STREAMIMDB_PLAYER_ORIGIN}${embedPath}`;
    const wrapperUrl = `${STREAMIMDB_WRAPPER_ORIGIN}${embedPath}`;

    const apiUrl = new URL(STREAMIMDB_DATA_API);
    apiUrl.searchParams.set(idType, mediaId);
    apiUrl.searchParams.set('type', mediaType);
    if (mediaType === 'tv' && season && episode) {
        apiUrl.searchParams.set('season', season);
        apiUrl.searchParams.set('episode', episode);
    }

    try {
        let requestUrl = apiUrl.toString();
        let proxyAgent = undefined;

        if (USE_TOR && torAgent) {
            proxyAgent = torAgent;
        } else {
            const workerUrl = process.env.VITE_WORKER_URL || 'https://ancient-math-1d1b.arslab.workers.dev';
            requestUrl = `${workerUrl}?url=${encodeURIComponent(apiUrl.toString())}&mode=proxy&referer=${encodeURIComponent(embedUrl)}`;
        }

        const response = await axios.get(requestUrl, {
            headers: getStreamimdbApiHeaders(embedUrl),
            timeout: 10000,
            responseType: 'json',
            httpAgent: proxyAgent,
            httpsAgent: proxyAgent,
            validateStatus: (status) => status < 500
        });

        const payload = response.data || {};
        const isSuccess = payload.status_code === '200' || payload.status_code === 200;
        const streamUrls = Array.isArray(payload.data?.stream_urls) ? payload.data.stream_urls : [];

        if (!isSuccess || streamUrls.length === 0) {
            return res.json({ success: false, error: 'Kaynak bulunamadı', source: 'streamimdb' });
        }

        const videos = await normalizeStreamimdbVideos(streamUrls, req, embedUrl);
        if (videos.length === 0) {
            return res.json({ success: false, error: 'Kaynak bulunamadı', source: 'streamimdb' });
        }

        const subtitles = normalizeStreamimdbSubtitles(payload.default_subs || [], req);
        const result = {
            source: 'streamimdb',
            wrapperUrl,
            embedUrl,
            streamDataApiUrl: apiUrl.toString(),
            title: payload.data?.title || null,
            fileName: payload.data?.file_name || null,
            backdrop: payload.data?.backdrop || null,
            videos,
            audios: [],
            workingAudio: null,
            audioSwitchStrategy: 'none',
            subtitles,
            hasTurkishAudio: false,
            hasTurkishSub: subtitles.some(subtitle => subtitle.lang === 'tr' || subtitle.lang === 'tur')
        };

        streamimdbCache.set(cacheKey, result);
        return res.json({ success: true, ...result });
    } catch (e) {
        console.error('[StreamIMDb Resolver] Error:', e.message);
        return res.status(500).json({ success: false, error: e.message, source: 'streamimdb' });
    }
});

const getWorkerProxyUrl = (targetUrl) => {
    // Proxy sarmalama işini worker'a bırak - backend ham vidmody URL'leri döndürsün.
    // Frontend buildVidmodyMasterUrl ile bu URL'leri worker'a mode=master olarak gönderir,
    // worker da bunları proxy URL'lerine çevirir. Backend'de sarmalarsak double-wrapping olur.
    return targetUrl || '';
};

const vidmodyCache = new LRUCache({ max: 200, ttl: 1000 * 60 * 30 });

app.get('/api/vidmody/resolve', async (req, res) => {
    const { imdbId, season, episode } = req.query;
    if (!imdbId) return res.status(400).json({ success: false, error: 'IMDB ID gerekli' });

    const cacheKey = `${imdbId}_${season || 0}_${episode || 0}`;
    if (vidmodyCache.has(cacheKey) && req.query.nocache !== 'true') {
        return res.json({ success: true, ...vidmodyCache.get(cacheKey) });
    }

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://vidmody.com/'
    };

    try {
        const manifestUrls = [];
        
        manifestUrls.push(`https://vidmody.com/vs/${imdbId}/`);
        
        if (season && episode) {
            const sStr = season.toString().padStart(2, '0');
            const eStr = episode.toString().padStart(2, '0');
            manifestUrls.push(`https://vidmody.com/vs/${imdbId}/${sStr}x${eStr}/`);
            manifestUrls.push(`https://vidmody.com/vs/${imdbId}/s${season}e${episode}/`);
            manifestUrls.push(`https://vidmody.com/vs/${imdbId}/S${sStr}E${eStr}/`);
        }

        let manifestContent = null;
        let manifestUrl = null;

        for (const url of manifestUrls) {
            for (const requestHeaders of getVidmodyHeaderVariants(headers)) {
                try {
                    const response = await axios.get(url, {
                        headers: requestHeaders,
                        timeout: 8000,
                        validateStatus: (s) => s < 400
                    });
                    const text = response.data;
                    if (text && (text.includes('#EXTM3U') || text.includes('#EXT-X-'))) {
                        manifestContent = text;
                        manifestUrl = url;
                        break;
                    }
                } catch (e) {}
            }

            if (manifestContent) break;
        }

        if (manifestContent) {
            const parsed = parseM3U8Manifest(manifestContent, manifestUrl);

            // Manifest vidmody.com'dan başarıyla alındıysa, parse edilen track'ler geçerlidir.
            // Her track'i ayrıca doğrulamak (filterPlayableVidmodyTracks) gereksiz yere
            // çok sayıda network isteği yapıp timeout'a neden oluyordu.
            const normalizedAudios = normalizeVidmodyAudios(parsed.audios);
            const workingAudio = getVidmodyWorkingAudio(normalizedAudios);

            if (parsed.videos.length === 0) {
                manifestContent = null;
            } else {
            
            const result = {
                source: 'vidmody',
                manifestUrl,
                videos: parsed.videos.map(v => ({ ...v, url: getWorkerProxyUrl(v.url) })),
                audios: normalizedAudios.map(a => ({ ...a, url: getWorkerProxyUrl(a.url) })),
                workingAudio,
                audioSwitchStrategy: normalizedAudios.length > 1 ? 'hls-track' : 'none',
                subtitles: parsed.subtitles.map(s => ({ ...s, url: getWorkerProxyUrl(s.url) })),
                hasTurkishAudio: normalizedAudios.some(a => isTurkishAudioTrack(a)),
                hasTurkishSub: parsed.subtitles.some(s => s.lang === 'tr' || s.name.toLowerCase().includes('türk'))
            };
            
            vidmodyCache.set(cacheKey, result);
            return res.json({ success: true, ...result });
            }
        }

        const qualityPatterns = [
            'main2', 'main1080dualcr', 'main1080encr', 'main_1080p', 'main_1080', 'main',
            'main720dualcr', 'main720encr', 'main_720p', 'main720',
            'main480dualcr', 'main480encr', 'main480', 'main_480p'
        ];

        const createVidmodyAssetUrl = (quality, asset = 'muxed-a1') => {
            const fileName = (() => {
                switch (asset) {
                    case 'video':
                        return 'index-v1.gif';
                    case 'audio-a1':
                        return 'index-a1.gif';
                    case 'audio-a2':
                        return 'index-a2.gif';
                    case 'muxed-a2':
                        return 'index-v1-a2.gif';
                    case 'muxed-a1':
                    default:
                        return 'index-v1-a1.gif';
                }
            })();

            if (season && episode) {
                const eStr = episode.toString().padStart(2, '0');
                return `https://vidmody.com/mm/${imdbId}/s${season}/e${eStr}/${quality}/${fileName}`;
            }
            return `https://vidmody.com/mm/${imdbId}/${quality}/${fileName}`;
        };

        const sortVidmodySources = (sources = []) => {
            const sortOrder = ['1080', '720', '480', '360'];
            return sources.sort((a, b) => {
                const aIdx = sortOrder.findIndex(q => a.quality.includes(q));
                const bIdx = sortOrder.findIndex(q => b.quality.includes(q));
                return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
            });
        };

        const sourceChecks = qualityPatterns.map(async (quality) => {
            const videoUrl = createVidmodyAssetUrl(quality, 'video');
            const muxedUrl = createVidmodyAssetUrl(quality, 'muxed-a1');
            const [hasVideoOnly, hasMuxed] = await Promise.all([
                validateVidmodyPlaylistUrl(videoUrl, headers),
                validateVidmodyPlaylistUrl(muxedUrl, headers)
            ]);

            if (!hasVideoOnly && !hasMuxed) return null;

            return {
                quality,
                videoUrl,
                muxedUrl,
                hasVideoOnly,
                hasMuxed
            };
        });

        const sourceResults = (await Promise.all(sourceChecks)).filter(Boolean);
        const splitSources = sortVidmodySources(sourceResults.filter(source => source.hasVideoOnly));
        const muxedSources = sortVidmodySources(sourceResults.filter(source => source.hasMuxed));

        if (splitSources.length > 0 || muxedSources.length > 0) {

            const subtitles = [];
            try {
                let subUrl;
                if (season && episode) {
                    const eStr = episode.toString().padStart(2, '0');
                    subUrl = `https://vidmody.com/mm/${imdbId}/s${season}/e${eStr}/lang/tur/sub_tr.vtt/index.gif`;
                } else {
                    subUrl = `https://vidmody.com/mm/${imdbId}/lang/tur/sub_tr.vtt/index.gif`;
                }
                
                if (await validateVidmodyPlaylistUrl(subUrl, headers)) {
                    subtitles.push({ name: 'Türkçe', lang: 'tr', url: subUrl });
                }
            } catch (e) {}

            const bestSplitSource = splitSources[0] || null;
            const a1Url = bestSplitSource ? createVidmodyAssetUrl(bestSplitSource.quality, 'audio-a1') : null;
            const a2Url = bestSplitSource ? createVidmodyAssetUrl(bestSplitSource.quality, 'audio-a2') : null;
            let workingAudio = null;

            let a1Available = false;
            let a2Available = false;
            if (bestSplitSource && a1Url && a2Url) {
                try {
                    [a1Available, a2Available] = await Promise.all([
                        validateVidmodyPlaylistUrl(a1Url, headers),
                        validateVidmodyPlaylistUrl(a2Url, headers)
                    ]);

                    if (a1Available) {
                        workingAudio = 'a1';
                    } else if (a2Available) {
                        workingAudio = 'a2';
                    }
                } catch (e) {}
            }

            const audios = [];
            if (a1Available) {
                audios.push({ name: 'Türkçe', lang: 'tr', url: a1Url, trackId: 'a1' });
            }
            if (a2Available) {
                audios.push({ name: 'English', lang: 'en', url: a2Url, trackId: 'a2' });
            }

            if (splitSources.length > 0 && audios.length > 0) {
                const result = {
                    source: 'vidmody',
                    videos: splitSources.map(v => ({
                        resolution: v.quality.includes('1080') ? '1920x1080' : 
                                   v.quality.includes('720') ? '1280x720' : 
                                   v.quality.includes('480') ? '854x480' : 'unknown',
                        quality: v.quality,
                        url: getWorkerProxyUrl(v.videoUrl)
                    })),
                    audios: audios.map(a => ({ ...a, url: getWorkerProxyUrl(a.url) })),
                    workingAudio,
                    audioSwitchStrategy: 'hls-track',
                    subtitles: subtitles.map(s => ({ ...s, url: getWorkerProxyUrl(s.url) })),
                    hasTurkishAudio: audios.some(audio => isTurkishAudioTrack(audio)),
                    hasTurkishSub: subtitles.length > 0
                };

                vidmodyCache.set(cacheKey, result);
                return res.json({ success: true, ...result });
            }

            if (muxedSources.length === 0) {
                return res.json({ success: false, error: 'Kaynak bulunamadı', source: 'vidmody' });
            }

            const result = {
                source: 'vidmody',
                videos: muxedSources.map(v => ({
                    resolution: v.quality.includes('1080') ? '1920x1080' : 
                               v.quality.includes('720') ? '1280x720' : 
                               v.quality.includes('480') ? '854x480' : 'unknown',
                    quality: v.quality,
                    url: getWorkerProxyUrl(v.muxedUrl)
                })),
                audios: audios.map(a => ({ ...a, url: getWorkerProxyUrl(a.url) })),
                workingAudio,
                audioSwitchStrategy: audios.length > 1 ? 'source' : 'none',
                subtitles: subtitles.map(s => ({ ...s, url: getWorkerProxyUrl(s.url) })),
                hasTurkishAudio: audios.some(audio => isTurkishAudioTrack(audio)),
                hasTurkishSub: subtitles.length > 0
            };

            vidmodyCache.set(cacheKey, result);
            return res.json({ success: true, ...result });
        }

        return res.json({ success: false, error: 'Kaynak bulunamadı', source: 'vidmody' });

    } catch (e) {
        console.error('[Vidmody Resolver] Error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/ghost-search', async (req, res) => {
    const { title, season, episode } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    try {
        console.log(`👻 [API] Ghost Search başlatılıyor: ${title} S${season} E${episode}`);
        const result = await findSource(title, season, episode);
        
        if (result) {
            res.json({ success: true, ...result });
        } else {
            res.status(404).json({ success: false, error: 'Kaynak bulunamadı' });
        }
    } catch (e) {
        console.error('Ghost Search Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin Endpoints
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
    try {
        if (!isDbConnected) {
            return res.status(503).json({ success: false, error: 'Database not connected' });
        }

        // Kullanıcı istatistikleri
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true, isBanned: false });
        const bannedUsers = await User.countDocuments({ isBanned: true });
        const adminUsers = await User.countDocuments({ role: 'admin' });
        const newUsersToday = await User.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        const newUsersThisWeek = await User.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });

        // Oturum istatistikleri
        const totalSessions = await Session.countDocuments();
        const activeSessions = await Session.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        // Son giriş yapan kullanıcılar
        const recentLogins = await User.find({ lastLogin: { $exists: true } })
            .sort({ lastLogin: -1 })
            .limit(5)
            .select('username lastLogin role');

        res.json({
            success: true,
            stats: {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    banned: bannedUsers,
                    admins: adminUsers,
                    newToday: newUsersToday,
                    newThisWeek: newUsersThisWeek
                },
                sessions: {
                    total: totalSessions,
                    activeToday: activeSessions
                },
                recentLogins
            }
        });
    } catch (error) {
        console.error('Admin Stats Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

app.get('/api/admin/users', adminMiddleware, async (req, res) => {
    try {
        if (!isDbConnected) {
            return res.status(503).json({ success: false, error: 'Database not connected' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const role = req.query.role || '';
        const status = req.query.status || '';

        // Filtreleme koşulları
        const filter = {};
        
        if (search) {
            filter.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (role && ['user', 'admin', 'moderator'].includes(role)) {
            filter.role = role;
        }
        
        if (status === 'active') {
            filter.isActive = true;
            filter.isBanned = false;
        } else if (status === 'banned') {
            filter.isBanned = true;
        } else if (status === 'inactive') {
            filter.isActive = false;
        }

        // Kullanıcıları getir
        const users = await User.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('-hash -salt -twoFactorSecret -twoFactorBackupCodes -loginHistory');

        // Toplam sayı
        const total = await User.countDocuments(filter);

        // Her kullanıcı için aktif oturum sayısını bul
        const usersWithSessions = await Promise.all(
            users.map(async (user) => {
                const sessionCount = await Session.countDocuments({ userId: user._id });
                return {
                    ...user.toObject(),
                    sessionCount
                };
            })
        );

        res.json({
            success: true,
            users: usersWithSessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Admin Users Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

// ═══════════════════════════════════════════════════════════════
// SOCIAL SYSTEM API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// --- Profile Endpoints ---

// GET /api/profile/me - Get own profile with social data
app.get('/api/profile/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('username email avatarId bio profileVisibility watchHistory preferences createdAt');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const friendCount = await Friendship.countDocuments({
            $or: [{ requester: user._id }, { recipient: user._id }],
            status: 'accepted'
        });

        const pendingCount = await Friendship.countDocuments({
            recipient: user._id,
            status: 'pending'
        });

        res.json({
            success: true,
            profile: {
                ...user.toObject(),
                friendCount,
                pendingRequestCount: pendingCount
            }
        });
    } catch (err) {
        console.error('Profile/me error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/profile/update - Update own profile settings
app.post('/api/profile/update', authenticateToken, async (req, res) => {
    try {
        const { avatarId, bio, profileVisibility } = req.body;
        const updates = {};

        if (avatarId !== undefined) updates.avatarId = String(avatarId).slice(0, 100);
        if (bio !== undefined) updates.bio = String(bio).slice(0, 120);
        if (profileVisibility && ['public', 'friends', 'private'].includes(profileVisibility)) {
            updates.profileVisibility = profileVisibility;
        }

        const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true })
            .select('username avatarId bio profileVisibility');

        res.json({ success: true, profile: user });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/profile/:username - View someone's public profile
app.get('/api/profile/:username', authenticateToken, async (req, res) => {
    try {
        const targetUser = await User.findOne({ username: req.params.username.toLowerCase() })
            .select('username avatarId bio profileVisibility watchHistory createdAt onlineStatus');
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        const isOwnProfile = String(targetUser._id) === String(req.user.id);

        // Check friendship status
        let friendshipStatus = 'none';
        if (!isOwnProfile) {
            const friendship = await Friendship.findOne({
                $or: [
                    { requester: req.user.id, recipient: targetUser._id },
                    { requester: targetUser._id, recipient: req.user.id }
                ]
            });
            if (friendship) {
                friendshipStatus = friendship.status;
                if (friendship.status === 'pending') {
                    friendshipStatus = String(friendship.requester) === String(req.user.id)
                        ? 'pending_sent' : 'pending_received';
                }
            }
        }

        const isFriend = friendshipStatus === 'accepted';

        // Apply privacy rules
        const canViewFull = isOwnProfile ||
            targetUser.profileVisibility === 'public' ||
            (targetUser.profileVisibility === 'friends' && isFriend);

        const friendCount = await Friendship.countDocuments({
            $or: [{ requester: targetUser._id }, { recipient: targetUser._id }],
            status: 'accepted'
        });

        const lastSeenDate = targetUser.onlineStatus?.lastSeen || targetUser.updatedAt || targetUser.createdAt || new Date();
        const isRecentlyActive = (Date.now() - new Date(lastSeenDate).getTime()) < 3 * 60 * 1000;
        const isOnline = onlineUsers.has(String(targetUser._id)) || isRecentlyActive;

        const profileData = {
            username: targetUser.username,
            avatarId: targetUser.avatarId || '',
            bio: canViewFull ? (targetUser.bio || '') : '',
            profileVisibility: targetUser.profileVisibility,
            friendshipStatus,
            friendCount,
            isOnline,
            lastSeen: lastSeenDate,
            memberSince: targetUser.createdAt
        };

        if (canViewFull) {
            // Calculate watch stats from watchHistory
            const history = targetUser.watchHistory || {};
            const entries = Object.values(history);
            profileData.stats = {
                totalWatched: entries.length,
                movieCount: entries.filter(e => !e.season).length,
                episodeCount: entries.filter(e => e.season).length,
                totalHours: Math.round(entries.reduce((sum, e) => sum + ((e.currentTime || 0) / 3600), 0))
            };

            // Calculate Level, XP, Unvan & 12 Badges (Identical to analytics.js)
            const totalHours = profileData.stats.totalHours;
            const movieCount = profileData.stats.movieCount;
            const episodeCount = profileData.stats.episodeCount;
            const completedTotal = movieCount + episodeCount;

            const totalXP = Math.round(totalHours * 100) + (episodeCount * 25) + (movieCount * 40);
            const level = Math.floor(totalXP / 250) + 1;
            const currentLevelXP = totalXP % 250;
            const progressPercent = Math.min(100, Math.round((currentLevelXP / 250) * 100));

            const getLevelTitle = (lvl) => {
                if (lvl >= 10) return { name: 'Final Boss', icon: '👑', color: '#f59e0b' };
                if (lvl >= 7) return { name: 'Sinema Gurmesi', icon: '💎', color: '#a855f7' };
                if (lvl >= 5) return { name: 'Maraton Avcısı', icon: '🔥', color: '#ef4444' };
                if (lvl >= 3) return { name: 'Binge Watching', icon: '📺', color: '#3b82f6' };
                return { name: 'Cinema Starter', icon: '🍿', color: '#10b981' };
            };

            const hasLateNightWatch = entries.some(e => {
                if (!e.updatedAt) return false;
                const h = new Date(e.updatedAt).getHours();
                return h >= 23 || h < 4;
            });
            const hasWeekendWatch = entries.some(e => {
                if (!e.updatedAt) return false;
                const day = new Date(e.updatedAt).getDay();
                return day === 0 || day === 6;
            });

            const allBadges = [
                { id: 'first_watch', title: 'Origin Story', desc: 'İlk içeriğini %85+ oranında bitirdin.', icon: '🎬', unlocked: completedTotal >= 1 },
                { id: 'night_owl', title: '3 AM Demon', desc: 'Gece 23:00 - 04:00 saatlerinde ekran başındaydın.', icon: '🌙', unlocked: hasLateNightWatch },
                { id: 'binge_master', title: 'Binge God', desc: 'En az 10 dizi bölümünü tek hamlede bitirdin.', icon: '📺', unlocked: episodeCount >= 10 },
                { id: 'movie_buff', title: 'Movie Addict', desc: 'En az 5 film tamamladın.', icon: '🍿', unlocked: movieCount >= 5 },
                { id: 'marathon_hero', title: 'Unstoppable', desc: '24 saati aşan ekran süresine ulaştın.', icon: '⚡', unlocked: totalHours >= 24 },
                { id: 'sci_fi_explorer', title: 'Cyberpunk', desc: 'Bilim kurgu türünde takıldın.', icon: '🚀', unlocked: false },
                { id: 'action_junkie', title: 'Adrenalin Overdose', desc: 'Aksiyon/Macera türünde 5+ içerik izledin.', icon: '🔥', unlocked: false },
                { id: 'genre_guru', title: 'Aura Master', desc: '5 farklı türde takıldın.', icon: '🎯', unlocked: false },
                { id: 'weekend_warrior', title: 'Weekend Chill', desc: 'Haftasonu maraton modunu açtın.', icon: '📅', unlocked: hasWeekendWatch },
                { id: 'cinephile_master', title: 'Letterboxd Boss', desc: '50 saatten fazla sinema mesaisi yaptın.', icon: '👑', unlocked: totalHours >= 50 },
                { id: 'completionist', title: 'Skip Yok!', desc: 'İçeriklerin %80+ kısmını bitiriyorsun.', icon: '🎯', unlocked: completedTotal >= 3 },
                { id: 'cult_collector', title: 'Archivist', desc: 'Toplamda 20+ içerik tamamladın.', icon: '💎', unlocked: completedTotal >= 20 }
            ];

            const nextLevelXP = 250;
            const levelTitle = getLevelTitle(level);

            profileData.levelData = {
                level,
                totalXP,
                currentLevelXP,
                nextLevelXP,
                progressPercent,
                levelInfo: levelTitle,
                badges: allBadges
            };

            // Recent Watched Items (WITHOUT completion percentage)
            const sortedEntries = entries
                .filter(e => e && e.title)
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                .slice(0, 4);

            profileData.recentWatched = sortedEntries.map(e => ({
                title: e.title,
                poster_path: e.poster_path || null,
                media_type: e.media_type || (e.season ? 'tv' : 'movie'),
                season: e.season || null,
                episode: e.episode || null,
                updatedAt: e.updatedAt || null
            }));

            // Currently watching
            if (isOnline && targetUser.onlineStatus?.currentlyWatching?.title) {
                profileData.currentlyWatching = targetUser.onlineStatus.currentlyWatching;
            }
        }

        res.json({ success: true, profile: profileData, canViewFull });
    } catch (err) {
        console.error('Profile view error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- Friends Endpoints ---

// GET /api/friends/search?q=username - Search users by username
app.get('/api/friends/search', authenticateToken, async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        if (q.length < 2) return res.json({ success: true, users: [] });

        const searchFilter = {
            username: { $regex: q, $options: 'i' },
            isActive: { $ne: false },
            isBanned: { $ne: true }
        };

        if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
            searchFilter._id = { $ne: req.user.id };
        }

        const rawUsers = await User.find(searchFilter)
            .select('username avatarId bio profileVisibility')
            .limit(20);

        // Exclude current user by username
        const users = rawUsers.filter(u => u.username?.toLowerCase() !== req.user?.username?.toLowerCase());

        // Get friendship statuses for found users
        const userIds = users.map(u => u._id);
        let friendships = [];
        if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
            friendships = await Friendship.find({
                $or: [
                    { requester: req.user.id, recipient: { $in: userIds } },
                    { requester: { $in: userIds }, recipient: req.user.id }
                ]
            });
        }

        const friendMap = new Map();
        friendships.forEach(f => {
            const otherId = String(f.requester) === String(req.user.id)
                ? String(f.recipient) : String(f.requester);
            let status = f.status;
            if (f.status === 'pending') {
                status = String(f.requester) === String(req.user.id)
                    ? 'pending_sent' : 'pending_received';
            }
            friendMap.set(otherId, status);
        });

        const results = users.map(u => ({
            username: u.username,
            avatarId: u.avatarId || '',
            bio: u.bio || '',
            isOnline: onlineUsers.has(String(u._id)),
            friendshipStatus: friendMap.get(String(u._id)) || 'none'
        }));

        res.json({ success: true, users: results });
    } catch (err) {
        console.error('Friend search error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/friends/request - Send friend request
app.post('/api/friends/request', authenticateToken, async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });

        const recipient = await User.findOne({ username: username.toLowerCase() }).select('_id username');
        if (!recipient) return res.status(404).json({ error: 'User not found' });
        if (String(recipient._id) === String(req.user.id)) {
            return res.status(400).json({ error: 'Cannot send request to yourself' });
        }

        // Check if already friends or pending
        const existing = await Friendship.findOne({
            $or: [
                { requester: req.user.id, recipient: recipient._id },
                { requester: recipient._id, recipient: req.user.id }
            ]
        });

        if (existing) {
            if (existing.status === 'accepted') return res.status(400).json({ error: 'Already friends' });
            if (existing.status === 'pending') return res.status(400).json({ error: 'Request already pending' });
            if (existing.status === 'rejected') {
                // Allow re-request after rejection
                existing.status = 'pending';
                existing.requester = req.user.id;
                existing.recipient = recipient._id;
                existing.createdAt = new Date();
                existing.acceptedAt = undefined;
                await existing.save();

                // Notify via Socket.IO
                const recipientSockets = onlineUsers.get(String(recipient._id));
                if (recipientSockets) {
                    recipientSockets.forEach(sid => {
                        io.to(sid).emit('friend_request', {
                            from: req.user.username,
                            requestId: existing._id
                        });
                    });
                }

                return res.json({ success: true, status: 'pending' });
            }
        }

        const friendship = new Friendship({
            requester: req.user.id,
            recipient: recipient._id
        });
        await friendship.save();

        // Notify recipient via Socket.IO
        const recipientSockets = onlineUsers.get(String(recipient._id));
        if (recipientSockets) {
            recipientSockets.forEach(sid => {
                io.to(sid).emit('friend_request', {
                    from: req.user.username,
                    requestId: friendship._id
                });
            });
        }

        res.json({ success: true, status: 'pending' });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ error: 'Request already exists' });
        console.error('Friend request error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/friends/accept - Accept friend request
app.post('/api/friends/accept', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.body;
        if (!requestId) return res.status(400).json({ error: 'Request ID required' });

        const friendship = await Friendship.findOne({
            _id: requestId,
            recipient: req.user.id,
            status: 'pending'
        });

        if (!friendship) return res.status(404).json({ error: 'Request not found' });

        friendship.status = 'accepted';
        friendship.acceptedAt = new Date();
        await friendship.save();

        // Notify requester
        const requesterSockets = onlineUsers.get(String(friendship.requester));
        if (requesterSockets) {
            requesterSockets.forEach(sid => {
                io.to(sid).emit('friend_accepted', {
                    by: req.user.username
                });
            });
        }

        res.json({ success: true, status: 'accepted' });
    } catch (err) {
        console.error('Friend accept error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/friends/reject - Reject friend request
app.post('/api/friends/reject', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.body;
        const friendship = await Friendship.findOne({
            _id: requestId,
            recipient: req.user.id,
            status: 'pending'
        });

        if (!friendship) return res.status(404).json({ error: 'Request not found' });

        friendship.status = 'rejected';
        await friendship.save();

        res.json({ success: true });
    } catch (err) {
        console.error('Friend reject error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/friends/remove - Remove friend
app.post('/api/friends/remove', authenticateToken, async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });

        const targetUser = await User.findOne({ username: username.toLowerCase() }).select('_id');
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        await Friendship.findOneAndDelete({
            $or: [
                { requester: req.user.id, recipient: targetUser._id, status: 'accepted' },
                { requester: targetUser._id, recipient: req.user.id, status: 'accepted' }
            ]
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Friend remove error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/friends/list - Get friends list with online status
app.get('/api/friends/list', authenticateToken, async (req, res) => {
    try {
        const friendships = await Friendship.find({
            $or: [{ requester: req.user.id }, { recipient: req.user.id }],
            status: 'accepted'
        }).populate('requester recipient', 'username avatarId bio profileVisibility onlineStatus');

        const friends = friendships.map(f => {
            const friend = String(f.requester._id) === String(req.user.id)
                ? f.recipient : f.requester;
            const friendLastSeen = friend.onlineStatus?.lastSeen || friend.updatedAt || friend.createdAt || new Date();
            const isRecentlyActive = (Date.now() - new Date(friendLastSeen).getTime()) < 3 * 60 * 1000;
            const isOnline = onlineUsers.has(String(friend._id)) || isRecentlyActive;
            return {
                username: friend.username,
                avatarId: friend.avatarId || '',
                bio: friend.bio || '',
                isOnline,
                lastSeen: friendLastSeen,
                currentlyWatching: isOnline ? (friend.onlineStatus?.currentlyWatching || null) : null,
                friendSince: f.acceptedAt
            };
        });

        // Sort: online first, then by username
        friends.sort((a, b) => {
            if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
            return a.username.localeCompare(b.username);
        });

        res.json({ success: true, friends });
    } catch (err) {
        console.error('Friends list error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/friends/requests - Get pending requests
app.get('/api/friends/requests', authenticateToken, async (req, res) => {
    try {
        const incoming = await Friendship.find({
            recipient: req.user.id,
            status: 'pending'
        }).populate('requester', 'username avatarId bio');

        const outgoing = await Friendship.find({
            requester: req.user.id,
            status: 'pending'
        }).populate('recipient', 'username avatarId bio');

        res.json({
            success: true,
            incoming: incoming.map(f => ({
                requestId: f._id,
                username: f.requester.username,
                avatarId: f.requester.avatarId || '',
                bio: f.requester.bio || '',
                sentAt: f.createdAt
            })),
            outgoing: outgoing.map(f => ({
                requestId: f._id,
                username: f.recipient.username,
                avatarId: f.recipient.avatarId || '',
                bio: f.recipient.bio || '',
                sentAt: f.createdAt
            }))
        });
    } catch (err) {
        console.error('Friend requests error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/friends/activity - Update currently watching status
app.post('/api/friends/activity', authenticateToken, async (req, res) => {
    try {
        const { title, imdbId, poster, season, episode } = req.body;

        await User.findByIdAndUpdate(req.user.id, {
            'onlineStatus.currentlyWatching': {
                title: title || '',
                imdbId: imdbId || '',
                poster: poster || '',
                season: season || null,
                episode: episode || null,
                updatedAt: new Date()
            }
        });

        // Broadcast to friends via Socket.IO
        const friendships = await Friendship.find({
            $or: [{ requester: req.user.id }, { recipient: req.user.id }],
            status: 'accepted'
        });

        const friendIds = friendships.map(f =>
            String(f.requester) === String(req.user.id)
                ? String(f.recipient) : String(f.requester)
        );

        friendIds.forEach(fid => {
            const sockets = onlineUsers.get(fid);
            if (sockets) {
                sockets.forEach(sid => {
                    io.to(sid).emit('friend_watching', {
                        username: req.user.username,
                        title, imdbId, poster, season, episode
                    });
                });
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Activity update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Use httpServer to listen instead of app.listen
httpServer.listen(CONFIG.PORT, () => {
    startKeepAlive();

// LiveKit Token Endpoint
app.post('/api/livekit/token', authenticateToken, async (req, res) => {
    try {
        const { roomName, participantName } = req.body;

        if (!roomName || !participantName) {
            return res.status(400).json({ error: 'Missing roomName or participantName' });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const wsUrl = process.env.LIVEKIT_URL;

        if (!apiKey || !apiSecret || !wsUrl) {
            console.error("LiveKit config missing");
            return res.status(500).json({ error: 'Server misconfiguration' });
        }

        const at = new AccessToken(apiKey, apiSecret, {
            identity: participantName,
        });

        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        res.json({ token, wsUrl });
    } catch (e) {
        console.error("LiveKit Token Error:", e);
        res.status(500).json({ error: "Token generation failed" });
    }
});
    console.log(`🚀 Noxis Server running on port ${CONFIG.PORT}`);
    console.log(`🔌 Socket.IO Server initialized`);
});

