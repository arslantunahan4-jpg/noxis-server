const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5000';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronCmd = process.platform === 'win32'
  ? path.join(rootDir, 'node_modules', '.bin', 'electron.cmd')
  : path.join(rootDir, 'node_modules', '.bin', 'electron');

function waitForUrl(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, res => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Vite dev server did not become ready: ${url}`));
          return;
        }
        setTimeout(tick, 500);
      });
      req.setTimeout(1000, () => {
        req.destroy();
      });
    };
    tick();
  });
}

const vite = spawn(npmCmd, ['run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  windowsHide: true
});

let electron = null;

const shutdown = () => {
  if (electron && !electron.killed) electron.kill();
  if (vite && !vite.killed) vite.kill();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

waitForUrl(devUrl)
  .then(() => {
    electron = spawn(electronCmd, ['.'], {
      cwd: rootDir,
      stdio: 'inherit',
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        VITE_DEV_SERVER_URL: devUrl
      }
    });

    electron.on('exit', code => {
      shutdown();
      process.exit(code || 0);
    });
  })
  .catch(error => {
    console.error(error);
    shutdown();
    process.exit(1);
  });
