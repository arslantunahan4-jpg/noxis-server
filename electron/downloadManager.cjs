const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const ffmpegPath = require('ffmpeg-static');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 NoxisDesktop';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.ts': 'video/mp2t',
  '.vtt': 'text/vtt; charset=utf-8',
  '.srt': 'application/x-subrip; charset=utf-8'
};

function now() {
  return Date.now();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeName(value, fallback = 'noxis-video') {
  const cleaned = String(value || fallback)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 120) || fallback;
}

function slugify(value) {
  return sanitizeName(value)
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ\s_-]/gi, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'video';
}

function ensureArrayFromJson(value) {
  if (!value || value === 'null') return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      const tracks = [];
      if (parsed.dub) {
        tracks.push({
          name: 'Türkçe Dublaj',
          lang: 'tr',
          url: parsed.dub,
          trackId: 'dub',
          provider: parsed.provider,
          kind: parsed.switchStrategy === 'source' ? 'source' : parsed.kind
        });
      }
      if (parsed.original && parsed.original !== parsed.dub) {
        tracks.push({
          name: 'Orijinal',
          lang: 'en',
          url: parsed.original,
          trackId: 'original',
          provider: parsed.provider,
          kind: parsed.switchStrategy === 'source' ? 'source' : parsed.kind
        });
      }
      return tracks;
    }
  } catch {
    return [];
  }
  return [];
}

function isSourceVideoTrack(track = {}) {
  const provider = String(track.provider || '').toLowerCase();
  const kind = String(track.kind || '').toLowerCase();
  const strategy = String(track.switchStrategy || '').toLowerCase();
  const url = String(track.url || '').toLowerCase();
  return (
    kind === 'source' ||
    strategy === 'source' ||
    provider === 'diziyou' ||
    provider === 'dizimom' ||
    url.includes('diziyou') ||
    url.includes('hdmomplayer')
  );
}

function isDubTrack(track = {}) {
  const trackId = String(track.trackId || '').toLowerCase();
  const lang = String(track.lang || '').toLowerCase();
  const name = String(track.name || '').toLowerCase();
  return trackId === 'dub' || lang === 'tr' || lang === 'tur' || name.includes('dublaj') || name.includes('turk') || name.includes('türk');
}

function isOriginalTrack(track = {}) {
  const trackId = String(track.trackId || '').toLowerCase();
  const name = String(track.name || '').toLowerCase();
  return trackId === 'original' || name.includes('orijinal') || name.includes('original');
}

function isHlsLike(url = '') {
  const value = String(url).toLowerCase();
  return value.includes('.m3u8') || value.includes('mode=master') || value.includes('mode=proxy') || value.includes('workers.dev') || value.includes('video-proxy');
}

function resolveUrl(baseUrl, nextUrl) {
  try {
    return new URL(nextUrl, baseUrl).toString();
  } catch {
    return nextUrl;
  }
}

function parseFfmpegTime(line) {
  const match = /time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(line);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

function resolveFfmpegPath() {
  if (!ffmpegPath) return null;
  const candidate = String(ffmpegPath);
  if (candidate.includes('app.asar')) {
    const unpackedPath = candidate.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(unpackedPath)) {
      return unpackedPath;
    }
  }
  return candidate;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: '*/*',
        ...(options.headers || {})
      }
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, timeoutMs = 20000) {
  const response = await fetchWithTimeout(url, {}, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function getHlsDuration(url, depth = 0) {
  if (depth > 4) return 0;
  try {
    const text = await fetchText(url, 12000);
    if (!text.includes('#EXTM3U')) return 0;
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const hasStreamInf = lines.some(line => line.startsWith('#EXT-X-STREAM-INF'));
    if (hasStreamInf) {
      let bestBandwidth = -1;
      let bestUrl = null;
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line.startsWith('#EXT-X-STREAM-INF')) continue;
        const bandwidth = Number((/BANDWIDTH=(\d+)/.exec(line) || [])[1] || 0);
        const nextLine = lines.slice(i + 1).find(item => item && !item.startsWith('#'));
        if (nextLine && bandwidth >= bestBandwidth) {
          bestBandwidth = bandwidth;
          bestUrl = resolveUrl(url, nextLine);
        }
      }
      return bestUrl ? getHlsDuration(bestUrl, depth + 1) : 0;
    }

    return lines.reduce((total, line) => {
      if (!line.startsWith('#EXTINF:')) return total;
      const duration = Number(line.substring(8).split(',')[0]);
      return Number.isFinite(duration) ? total + duration : total;
    }, 0);
  } catch {
    return 0;
  }
}

class DesktopDownloadManager {
  constructor({ rootDir, onUpdate }) {
    this.rootDir = rootDir;
    this.dbPath = path.join(rootDir, 'downloads.json');
    this.onUpdate = onUpdate || (() => {});
    this.tasks = new Map();
    this.jobs = new Map();
    this.mediaServer = null;
    this.mediaPort = null;
  }

  async init() {
    await fsp.mkdir(this.rootDir, { recursive: true });
    await this.load();
    await this.startMediaServer();
    for (const task of this.tasks.values()) {
      if (task.status === 'DOWNLOADING' || task.status === 'PENDING') {
        task.status = 'PAUSED';
        task.isPaused = true;
        task.updatedAt = now();
      }
    }
    await this.save();
  }

  async load() {
    try {
      const raw = await fsp.readFile(this.dbPath, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach(task => this.tasks.set(String(task.id), task));
      }
    } catch {
      this.tasks.clear();
    }
  }

  async save() {
    const list = Array.from(this.tasks.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const tmpPath = `${this.dbPath}.tmp`;
    await fsp.writeFile(tmpPath, JSON.stringify(list, null, 2), 'utf8');
    await fsp.rename(tmpPath, this.dbPath);
  }

  emitUpdate() {
    this.onUpdate(this.listDownloads());
  }

  async updateTask(id, patch) {
    const key = String(id);
    const current = this.tasks.get(key);
    if (!current) return null;
    const next = {
      ...current,
      ...patch,
      updatedAt: now()
    };
    this.tasks.set(key, next);
    await this.save();
    this.emitUpdate();
    return next;
  }

  async startMediaServer() {
    if (this.mediaServer) return;

    this.mediaServer = http.createServer((req, res) => {
      this.handleMediaRequest(req, res).catch(error => {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(error.message || 'Internal error');
      });
    });

    await new Promise((resolve, reject) => {
      this.mediaServer.once('error', reject);
      this.mediaServer.listen(0, '127.0.0.1', () => {
        this.mediaPort = this.mediaServer.address().port;
        resolve();
      });
    });
  }

  resolveMediaFileFromParts(parts) {
    if (parts[0] !== 'media' || !parts[1]) {
      return null;
    }

    const task = this.tasks.get(String(parts[1]));
    if (!task) {
      return null;
    }

    const requestedName = parts.slice(2).join('/') || 'video.mp4';
    const safeName = path.basename(requestedName);
    const baseDir = path.dirname(task.localFile || path.join(this.rootDir, task.folderName || '', 'video.mp4'));
    const filePath = path.join(baseDir, safeName);
    const resolvedBase = path.resolve(baseDir);
    const resolvedFile = path.resolve(filePath);
    const relative = path.relative(resolvedBase, resolvedFile);

    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(resolvedFile)) {
      return null;
    }

    return resolvedFile;
  }

  resolveMediaFileFromUrl(requestUrl) {
    try {
      const parsed = new URL(requestUrl, 'http://127.0.0.1');
      const rawParts = parsed.protocol === 'noxis-media:'
        ? [parsed.hostname, ...parsed.pathname.split('/').filter(Boolean)]
        : parsed.pathname.split('/').filter(Boolean);
      const parts = rawParts.map(part => decodeURIComponent(part));
      return this.resolveMediaFileFromParts(parts);
    } catch {
      return null;
    }
  }

  async handleMediaRequest(req, res) {
    const parsed = new URL(req.url, 'http://127.0.0.1');
    const parts = parsed.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));

    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, HEAD, OPTIONS');
    res.setHeader('access-control-allow-headers', 'Range, Content-Type');
    res.setHeader('access-control-expose-headers', 'Content-Length, Content-Range, Accept-Ranges');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const resolvedFile = this.resolveMediaFileFromParts(parts);
    if (!resolvedFile) {
      res.writeHead(404);
      res.end();
      return;
    }

    const stat = await fsp.stat(resolvedFile);
    const ext = path.extname(resolvedFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const range = req.headers.range;

    res.setHeader('accept-ranges', 'bytes');
    res.setHeader('content-type', contentType);

    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const [startRaw, endRaw] = range.replace('bytes=', '').split('-');
      const start = startRaw ? Number(startRaw) : 0;
      const end = endRaw ? Number(endRaw) : stat.size - 1;
      const safeStart = clamp(start, 0, stat.size - 1);
      const safeEnd = clamp(end, safeStart, stat.size - 1);
      const chunkSize = safeEnd - safeStart + 1;

      res.writeHead(206, {
        'content-length': chunkSize,
        'content-range': `bytes ${safeStart}-${safeEnd}/${stat.size}`
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      fs.createReadStream(resolvedFile, { start: safeStart, end: safeEnd }).pipe(res);
      return;
    }

    res.writeHead(200, { 'content-length': stat.size });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(resolvedFile).pipe(res);
  }

  getMediaUrl(id, fileName = 'video.mp4') {
    return `noxis-media://media/${encodeURIComponent(String(id))}/${encodeURIComponent(fileName)}`;
  }

  toPublicTask(task) {
    const localFile = task.localFile || path.join(this.rootDir, task.folderName || '', 'video.mp4');
    const infoFile = path.join(path.dirname(localFile), 'video.info.json');
    return {
      ...task,
      localUrl: this.getMediaUrl(task.id, 'video.mp4'),
      metadataUrl: this.getMediaUrl(task.id, 'video.info.json'),
      originalUrl: fs.existsSync(path.join(path.dirname(localFile), 'video_original.mp4'))
        ? this.getMediaUrl(task.id, 'video_original.mp4')
        : null,
      hasMetadata: fs.existsSync(infoFile),
      canPlay: task.status === 'COMPLETED' && fs.existsSync(localFile)
    };
  }

  listDownloads() {
    return Array.from(this.tasks.values())
      .map(task => this.toPublicTask(task))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  getStats() {
    let bytes = 0;
    for (const task of this.tasks.values()) {
      const folder = path.join(this.rootDir, task.folderName || '');
      bytes += this.getFolderSize(folder);
    }
    return {
      downloadBytes: bytes,
      rootDir: this.rootDir,
      count: this.tasks.size
    };
  }

  getFolderSize(folder) {
    if (!folder || !fs.existsSync(folder)) return 0;
    let total = 0;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const entryPath = path.join(folder, entry.name);
      if (entry.isDirectory()) total += this.getFolderSize(entryPath);
      else total += fs.statSync(entryPath).size;
    }
    return total;
  }

  async startDownload(payload = {}) {
    if (!payload.videoUrl || !payload.title) {
      throw new Error('Video URL veya başlık eksik.');
    }

    const id = String(now());
    const folderName = `${id}-${slugify(payload.title)}`;
    const folder = path.join(this.rootDir, folderName);
    const localFile = path.join(folder, 'video.mp4');
    await fsp.mkdir(folder, { recursive: true });

    const task = {
      id,
      title: String(payload.title),
      videoUrl: String(payload.videoUrl),
      localFile,
      folderName,
      progress: 0,
      status: 'PENDING',
      isPaused: false,
      createdAt: now(),
      updatedAt: now(),
      posterPath: payload.posterPath || null,
      backdropPath: payload.backdropPath || null,
      mediaType: payload.mediaType || null,
      season: Number(payload.season) || null,
      episode: Number(payload.episode) || null,
      subtitlesJson: payload.subtitlesJson || null,
      audioTracksJson: payload.audioTracksJson || null,
      quality: payload.quality || 'HD',
      wifiOnly: !!payload.wifiOnly,
      error: null
    };

    this.tasks.set(id, task);
    await this.save();
    this.emitUpdate();
    this.runTask(id);
    return this.toPublicTask(task);
  }

  async runTask(id) {
    const task = this.tasks.get(String(id));
    if (!task) return;

    try {
      await this.updateTask(id, { status: 'DOWNLOADING', isPaused: false, progress: Math.max(task.progress || 0, 1), error: null });

      const tracks = ensureArrayFromJson(task.audioTracksJson);
      const sourceTracks = tracks.filter(isSourceVideoTrack);
      const dubTrack = sourceTracks.find(isDubTrack);
      const originalTrack = sourceTracks.find(isOriginalTrack);
      const mainUrl = dubTrack?.url || task.videoUrl;
      const hasOriginalSource = originalTrack?.url && originalTrack.url !== mainUrl;

      await this.downloadMedia(mainUrl, task.localFile, id, 1, hasOriginalSource ? 72 : 82);
      await this.updateTask(id, { progress: hasOriginalSource ? 74 : 84 });

      const localSubtitles = await this.writeSubtitles(task);
      await this.updateTask(id, { progress: hasOriginalSource ? 78 : 90 });

      let audioTracks = null;
      if (hasOriginalSource) {
        const originalFile = path.join(path.dirname(task.localFile), 'video_original.mp4');
        await this.downloadMedia(originalTrack.url, originalFile, id, 78, 96);
        audioTracks = {
          provider: 'local',
          switchStrategy: 'source',
          dub: this.getMediaUrl(id, 'video.mp4'),
          original: this.getMediaUrl(id, 'video_original.mp4'),
          active: 'dub'
        };
      }

      await this.writeMetadata(task, localSubtitles, audioTracks);
      await this.updateTask(id, { status: 'COMPLETED', isPaused: false, progress: 100, error: null });
    } catch (error) {
      const latest = this.tasks.get(String(id));
      if (latest?.status === 'PAUSED') return;
      await this.updateTask(id, {
        status: 'FAILED',
        isPaused: false,
        error: error?.message || 'İndirme başarısız oldu.'
      });
    } finally {
      this.jobs.delete(String(id));
    }
  }

  async downloadMedia(url, outputFile, taskId, progressStart, progressEnd) {
    await fsp.mkdir(path.dirname(outputFile), { recursive: true });
    const isHlsDownload = isHlsLike(url);
    const legacyTempFile = `${outputFile}.part`;
    const tempFile = isHlsDownload ? `${outputFile}.download.mp4` : legacyTempFile;
    if (fs.existsSync(tempFile)) await fsp.rm(tempFile, { force: true });
    if (isHlsDownload && fs.existsSync(legacyTempFile)) {
      await fsp.rm(legacyTempFile, { force: true }).catch(() => {});
    }

    if (isHlsDownload) {
      await this.downloadWithFfmpeg(url, tempFile, taskId, progressStart, progressEnd);
    } else {
      await this.downloadDirect(url, tempFile, taskId, progressStart, progressEnd);
    }

    const latest = this.tasks.get(String(taskId));
    if (latest?.status === 'PAUSED') {
      await fsp.rm(tempFile, { force: true }).catch(() => {});
      throw new Error('İndirme duraklatıldı.');
    }

    await fsp.rename(tempFile, outputFile);
  }

  async downloadDirect(url, outputFile, taskId, progressStart, progressEnd) {
    const controller = new AbortController();
    this.jobs.set(String(taskId), { type: 'fetch', controller });

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: '*/*'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const total = Number(response.headers.get('content-length')) || 0;
    let downloaded = 0;
    const stream = fs.createWriteStream(outputFile);
    const readable = Readable.fromWeb(response.body);

    await new Promise((resolve, reject) => {
      readable.on('data', chunk => {
        downloaded += chunk.length;
        if (total > 0) {
          const ratio = downloaded / total;
          const progress = Math.round(progressStart + ratio * (progressEnd - progressStart));
          this.updateTask(taskId, { progress }).catch(() => {});
        }
      });
      readable.on('error', reject);
      stream.on('error', reject);
      stream.on('finish', resolve);
      readable.pipe(stream);
    });
  }

  async downloadWithFfmpeg(url, outputFile, taskId, progressStart, progressEnd) {
    const activeFfmpegPath = resolveFfmpegPath();
    if (!activeFfmpegPath) {
      throw new Error('ffmpeg-static bulunamadı.');
    }

    const duration = await getHlsDuration(url);
    const args = [
      '-hide_banner',
      '-y',
      '-nostdin',
      '-user_agent',
      USER_AGENT,
      '-i',
      url,
      '-map',
      '0:v:0?',
      '-map',
      '0:a:0?',
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      '-f',
      'mp4',
      outputFile
    ];

    await new Promise((resolve, reject) => {
      const child = spawn(activeFfmpegPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe']
      });
      let stderr = '';
      this.jobs.set(String(taskId), { type: 'ffmpeg', child });

      child.stderr.on('data', chunk => {
        const text = chunk.toString();
        stderr += text;
        const seconds = parseFfmpegTime(text);
        if (duration > 0 && seconds !== null) {
          const ratio = clamp(seconds / duration, 0, 1);
          const progress = Math.round(progressStart + ratio * (progressEnd - progressStart));
          this.updateTask(taskId, { progress }).catch(() => {});
        }
      });

      child.on('error', reject);
      child.on('close', code => {
        const latest = this.tasks.get(String(taskId));
        if (latest?.status === 'PAUSED') {
          resolve();
          return;
        }
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg indirme hatası (${code}). ${stderr.slice(-500)}`));
        }
      });
    });
  }

  async writeSubtitles(task) {
    const subtitles = ensureArrayFromJson(task.subtitlesJson);
    const parentDir = path.dirname(task.localFile);
    const localSubtitles = [];

    for (let i = 0; i < Math.min(subtitles.length, 24); i += 1) {
      const subtitle = subtitles[i];
      if (!subtitle?.url) continue;
      const lang = sanitizeName(subtitle.lang || `sub${i}`, `sub${i}`).toLowerCase();
      const label = subtitle.label || subtitle.lang || `Altyazı ${i + 1}`;

      try {
        const extFromUrl = path.extname(new URL(subtitle.url, 'http://noxis.local').pathname).toLowerCase();
        const ext = extFromUrl === '.srt' ? '.srt' : '.vtt';
        const fileName = `subtitle_${i}_${lang}${ext}`;
        const filePath = path.join(parentDir, fileName);
        const response = await fetchWithTimeout(subtitle.url, {}, 20000);
        if (!response.ok) continue;
        const buffer = Buffer.from(await response.arrayBuffer());
        await fsp.writeFile(filePath, buffer);
        localSubtitles.push({
          lang,
          label,
          url: this.getMediaUrl(task.id, fileName)
        });
      } catch {
        // Subtitle failures should not fail the video download.
      }
    }

    return localSubtitles;
  }

  async writeMetadata(task, subtitles, audioTracks) {
    const infoFile = path.join(path.dirname(task.localFile), 'video.info.json');
    const metadata = {
      title: task.title,
      mediaType: task.mediaType,
      season: task.season,
      episode: task.episode,
      subtitles: subtitles || []
    };

    if (audioTracks) {
      metadata.audioTracks = audioTracks;
    }

    await fsp.writeFile(infoFile, JSON.stringify(metadata, null, 2), 'utf8');
  }

  async pauseDownload(id) {
    const key = String(id);
    const job = this.jobs.get(key);
    await this.updateTask(key, { status: 'PAUSED', isPaused: true });

    if (job?.type === 'fetch') {
      job.controller.abort();
    } else if (job?.type === 'ffmpeg') {
      job.child.kill('SIGTERM');
    }
    this.jobs.delete(key);
    return this.tasks.get(key) ? this.toPublicTask(this.tasks.get(key)) : null;
  }

  async resumeDownload(id) {
    const key = String(id);
    const task = this.tasks.get(key);
    if (!task) return null;
    if (task.status === 'COMPLETED') return this.toPublicTask(task);
    await this.updateTask(key, { status: 'PENDING', isPaused: false, error: null });
    this.runTask(key);
    return this.toPublicTask(this.tasks.get(key));
  }

  async deleteDownload(id) {
    const key = String(id);
    const task = this.tasks.get(key);
    if (!task) return false;
    await this.pauseDownload(key).catch(() => {});
    const folder = path.join(this.rootDir, task.folderName || '');
    this.tasks.delete(key);
    await this.save();
    await fsp.rm(folder, { recursive: true, force: true }).catch(() => {});
    this.emitUpdate();
    return true;
  }

  getPlayable(id) {
    const task = this.tasks.get(String(id));
    if (!task) return null;
    return this.toPublicTask(task);
  }
}

module.exports = {
  DesktopDownloadManager,
  MIME_TYPES
};
