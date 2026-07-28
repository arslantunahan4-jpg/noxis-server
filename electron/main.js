import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);
const { DesktopDownloadManager, MIME_TYPES } = require('./downloadManager.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const productionWebUrl = process.env.NOXIS_DESKTOP_WEB_URL || 'https://noxis.tech';

let mainWindow = null;
let staticServer = null;
let staticServerUrl = null;
let downloadManager = null;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'noxis-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

function getDistDir() {
  return path.join(app.getAppPath(), 'dist');
}

function sendDownloadsChanged() {
  if (!mainWindow || mainWindow.isDestroyed() || !downloadManager) return;
  mainWindow.webContents.send('downloads:changed', {
    downloads: downloadManager.listDownloads(),
    stats: downloadManager.getStats()
  });
}

function mediaHeaders(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'Range, Content-Type',
    'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges',
    ...extra
  };
}

async function createMediaProtocolResponse(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: mediaHeaders() });
  }

  if (!downloadManager || !['GET', 'HEAD'].includes(request.method)) {
    return new Response('Not allowed', { status: 405, headers: mediaHeaders({ 'content-type': 'text/plain; charset=utf-8' }) });
  }

  const filePath = downloadManager.resolveMediaFileFromUrl(request.url);
  if (!filePath) {
    return new Response('Not found', { status: 404, headers: mediaHeaders({ 'content-type': 'text/plain; charset=utf-8' }) });
  }

  const stat = await fs.promises.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const range = request.headers.get('range') || '';
  const headers = mediaHeaders({
    'accept-ranges': 'bytes',
    'content-type': contentType
  });

  if (/^bytes=\d*-\d*$/.test(range)) {
    const [startRaw, endRaw] = range.replace('bytes=', '').split('-');
    const parsedStart = startRaw ? Number(startRaw) : 0;
    const parsedEnd = endRaw ? Number(endRaw) : stat.size - 1;
    const start = Math.max(0, Math.min(parsedStart, stat.size - 1));
    const end = Math.max(start, Math.min(parsedEnd, stat.size - 1));
    const chunkSize = end - start + 1;
    headers['content-length'] = String(chunkSize);
    headers['content-range'] = `bytes ${start}-${end}/${stat.size}`;

    return new Response(
      request.method === 'HEAD' ? null : Readable.toWeb(fs.createReadStream(filePath, { start, end })),
      { status: 206, headers }
    );
  }

  headers['content-length'] = String(stat.size);
  return new Response(
    request.method === 'HEAD' ? null : Readable.toWeb(fs.createReadStream(filePath)),
    { status: 200, headers }
  );
}

function registerMediaProtocol() {
  protocol.handle('noxis-media', createMediaProtocolResponse);
}

function createStaticServer(distDir) {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname);
    const hasExtension = path.extname(pathname) !== '';
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const requestedPath = path.resolve(distDir, relativePath);
    const distRoot = path.resolve(distDir);
    const indexPath = path.join(distRoot, 'index.html');

    let filePath = requestedPath;
    if (!filePath.startsWith(distRoot)) {
      res.writeHead(403);
      res.end();
      return;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      if (hasExtension) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      filePath = indexPath;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable'
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        url: `http://127.0.0.1:${port}`
      });
    });
  });
}

async function getAppUrl() {
  if (isDev) {
    return process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5000';
  }

  if (process.env.NOXIS_DESKTOP_LOCAL === '1') {
    if (!staticServerUrl) {
      const result = await createStaticServer(getDistDir());
      staticServer = result.server;
      staticServerUrl = result.url;
    }

    return staticServerUrl;
  }

  return productionWebUrl;
}

function isAllowedNavigation(url) {
  try {
    const target = new URL(url);
    const allowed = new Set([
      new URL(productionWebUrl).origin,
      'https://noxis.tech',
      'https://www.noxis.tech'
    ]);

    if (isDev) {
      allowed.add(new URL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5000').origin);
    }

    if (staticServerUrl) {
      allowed.add(new URL(staticServerUrl).origin);
    }

    return allowed.has(target.origin);
  } catch {
    return false;
  }
}

async function getLocalAppUrl() {
  if (!staticServerUrl) {
    const result = await createStaticServer(getDistDir());
    staticServer = result.server;
    staticServerUrl = result.url;
  }

  return staticServerUrl;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#050506',
    title: 'Noxis',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedNavigation(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  const appUrl = await getAppUrl();
  await mainWindow.loadURL(appUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function registerIpc() {
  ipcMain.handle('desktop:get-state', () => ({
    isDesktop: true,
    downloads: downloadManager.listDownloads(),
    stats: downloadManager.getStats()
  }));

  ipcMain.handle('downloads:start', async (_event, payload) => {
    const task = await downloadManager.startDownload(payload);
    sendDownloadsChanged();
    return task;
  });

  ipcMain.handle('downloads:list', () => ({
    downloads: downloadManager.listDownloads(),
    stats: downloadManager.getStats()
  }));

  ipcMain.handle('downloads:pause', async (_event, id) => {
    const task = await downloadManager.pauseDownload(id);
    sendDownloadsChanged();
    return task;
  });

  ipcMain.handle('downloads:resume', async (_event, id) => {
    const task = await downloadManager.resumeDownload(id);
    sendDownloadsChanged();
    return task;
  });

  ipcMain.handle('downloads:delete', async (_event, id) => {
    const ok = await downloadManager.deleteDownload(id);
    sendDownloadsChanged();
    return ok;
  });

  ipcMain.handle('downloads:playable', (_event, id) => downloadManager.getPlayable(id));

  ipcMain.handle('downloads:open', () => true);
}

app.whenReady().then(async () => {
  downloadManager = new DesktopDownloadManager({
    rootDir: path.join(app.getPath('userData'), 'downloads'),
    onUpdate: sendDownloadsChanged
  });
  await downloadManager.init();
  registerMediaProtocol();
  registerIpc();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
});
