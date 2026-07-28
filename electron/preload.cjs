const { contextBridge, ipcRenderer } = require('electron');

let panelHost = null;
let panelRoot = null;
let isPanelOpen = false;
let currentDownloadsPayload = { downloads: [], stats: null };
let nativePlayerSourceBeforeSwitch = null;
let nativePlayerIdleTimer = null;
let activeSubtitleIndex = null;
let nativeSubtitleTracks = [];
let activeSubtitleCues = [];
let lastRenderedCaption = '';
const PLAYER_PLAY_ICON = String.fromCharCode(9654);

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildDownloadPayload(
  videoUrl,
  title,
  posterPath = null,
  backdropPath = null,
  mediaType = null,
  season = null,
  episode = null,
  subtitlesJson = null,
  audioTracksJson = null,
  quality = 'HD',
  wifiOnly = false
) {
  return {
    videoUrl,
    title,
    posterPath,
    backdropPath,
    mediaType,
    season: toInt(season),
    episode: toInt(episode),
    subtitlesJson,
    audioTracksJson,
    quality,
    wifiOnly: !!wifiOnly
  };
}

function formatBytes(bytes = 0) {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function tmdbImage(path, size = 'w342') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function statusLabel(task) {
  if (task?.isPaused) return 'Duraklatıldı';
  switch (String(task?.status || '').toUpperCase()) {
    case 'COMPLETED':
      return 'İndirildi';
    case 'DOWNLOADING':
      return 'İndiriliyor';
    case 'PENDING':
      return 'Bekliyor';
    case 'FAILED':
      return 'Hata';
    case 'PAUSED':
      return 'Duraklatıldı';
    default:
      return task?.status || 'Bilinmiyor';
  }
}

function statusClass(task) {
  if (task?.isPaused) return 'is-waiting';
  switch (String(task?.status || '').toUpperCase()) {
    case 'COMPLETED':
      return 'is-ready';
    case 'DOWNLOADING':
      return 'is-active';
    case 'PENDING':
    case 'PAUSED':
      return 'is-waiting';
    case 'FAILED':
      return 'is-failed';
    default:
      return '';
  }
}

function mediaMeta(task) {
  const parts = [task?.mediaType === 'tv' ? 'Dizi' : 'Film'];
  if (task?.mediaType === 'tv' && task?.season && task?.episode) {
    parts.push(`S${task.season}E${task.episode}`);
  }
  if (task?.quality) parts.push(task.quality);
  return parts.join(' / ');
}

function ensurePanel() {
  if (panelRoot) return panelRoot;
  if (!document.body) return null;

  panelHost = document.createElement('div');
  panelHost.id = 'noxis-desktop-downloads-host';
  document.body.appendChild(panelHost);
  panelRoot = panelHost.attachShadow({ mode: 'open' });
  panelRoot.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: none;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #fff;
      }

      :host(.open) {
        display: block;
      }

      * {
        box-sizing: border-box;
      }

      button {
        font: inherit;
      }

      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(18px);
      }

      .panel {
        position: fixed;
        inset: 22px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #050506;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.65);
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        padding: 24px 26px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), transparent);
      }

      .kicker {
        color: rgba(255, 255, 255, 0.52);
        font-size: 11px;
        letter-spacing: 3px;
        font-weight: 900;
      }

      h1 {
        margin: 4px 0 0;
        color: #fff;
        font-size: 34px;
        line-height: 1;
        letter-spacing: 0;
      }

      .header-actions,
      .row-actions,
      .player-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .btn {
        min-height: 38px;
        padding: 0 14px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 7px;
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        font-size: 13px;
        font-weight: 850;
        cursor: pointer;
      }

      .btn:hover {
        background: rgba(255, 255, 255, 0.15);
      }

      .btn.primary {
        background: #fff;
        color: #050506;
        border-color: #fff;
      }

      .body {
        min-height: 0;
        flex: 1;
        overflow: auto;
        padding: 18px 26px 26px;
      }

      .summary {
        display: grid;
        grid-template-columns: auto auto minmax(0, 1fr);
        gap: 14px;
        align-items: center;
        margin-bottom: 14px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 13px;
        font-weight: 760;
      }

      .summary span:last-child {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        text-align: right;
      }

      .empty {
        min-height: 340px;
        display: grid;
        place-items: center;
        color: rgba(255, 255, 255, 0.62);
        border: 1px solid rgba(255, 255, 255, 0.10);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.035);
        font-weight: 750;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .row {
        display: grid;
        grid-template-columns: 74px minmax(0, 1fr) auto;
        gap: 14px;
        align-items: center;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.10);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.045);
      }

      .thumb {
        width: 74px;
        aspect-ratio: 2 / 3;
        border-radius: 6px;
        overflow: hidden;
        background: #151519;
        border: 1px solid rgba(255, 255, 255, 0.10);
        display: grid;
        place-items: center;
        color: #fff;
        font-size: 24px;
        font-weight: 950;
      }

      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .info {
        min-width: 0;
      }

      .title-line {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 14px;
      }

      h3 {
        margin: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: #fff;
        font-size: 17px;
        line-height: 1.25;
        letter-spacing: 0;
      }

      .status {
        flex: 0 0 auto;
        font-size: 12px;
        font-weight: 950;
        text-transform: uppercase;
      }

      .is-ready { color: #6fd49f; }
      .is-active { color: #83aaff; }
      .is-waiting { color: #e0b85e; }
      .is-failed { color: #ff6b6b; }

      .meta,
      .error {
        margin-top: 5px;
        font-size: 13px;
        font-weight: 750;
        color: rgba(255, 255, 255, 0.58);
      }

      .error {
        color: #ffb4b4;
        white-space: normal;
        word-break: break-word;
      }

      .progress {
        height: 5px;
        margin-top: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.10);
      }

      .progress > span {
        display: block;
        height: 100%;
        width: 0;
        border-radius: inherit;
        background: linear-gradient(90deg, #fff, #83aaff);
        transition: width 180ms ease;
      }

      .player {
        position: fixed;
        inset: 0;
        z-index: 2;
        display: none;
        flex-direction: column;
        overflow: hidden;
        background: #000;
        user-select: none;
      }

      .player.open {
        display: flex;
      }

      .player-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        min-height: 78px;
        padding: 24px 30px 20px;
        background: linear-gradient(180deg, rgba(0,0,0,0.88), rgba(0,0,0,0.34), transparent);
        position: absolute;
        inset: 0 0 auto;
        z-index: 4;
        transition: opacity 160ms ease;
      }

      .player-title {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: #fff;
        font-size: 18px;
        font-weight: 850;
        text-shadow: 0 2px 16px rgba(0,0,0,0.72);
      }

      .video-shell {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        background: #000;
      }

      .player-video {
        width: 100%;
        height: 100%;
        background: #000;
        object-fit: contain;
      }

      .player-gradient {
        position: absolute;
        inset: auto 0 0;
        height: 260px;
        pointer-events: none;
        background: linear-gradient(0deg, rgba(0,0,0,0.92), rgba(0,0,0,0.48), transparent);
        z-index: 2;
        transition: opacity 160ms ease;
      }

      .center-play {
        position: absolute;
        inset: 50% auto auto 50%;
        transform: translate(-50%, -50%);
        z-index: 3;
        width: 70px;
        height: 70px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.28);
        background: rgba(8,8,10,0.68);
        color: #fff;
        font-size: 0;
        cursor: pointer;
        box-shadow: 0 18px 60px rgba(0,0,0,0.52);
        backdrop-filter: blur(18px);
        transition: transform 140ms ease, background 140ms ease, opacity 160ms ease;
      }

      .center-play:hover {
        background: rgba(255,255,255,0.14);
        transform: translate(-50%, -50%) scale(1.04);
      }

      .center-play::before {
        content: "";
        display: block;
        width: 0;
        height: 0;
        margin: 0 auto;
        border-top: 16px solid transparent;
        border-bottom: 16px solid transparent;
        border-left: 24px solid #fff;
        transform: translateX(4px);
      }

      .center-play.is-playing {
        opacity: 0;
        pointer-events: none;
      }

      .caption-layer {
        position: absolute;
        left: 50%;
        bottom: 112px;
        z-index: 3;
        width: min(84vw, 1180px);
        transform: translateX(-50%);
        display: flex;
        justify-content: center;
        pointer-events: none;
        text-align: center;
      }

      .caption-layer.empty {
        display: none;
      }

      .caption-box {
        max-width: 100%;
        padding: 5px 12px 6px;
        border-radius: 6px;
        background: rgba(0,0,0,0.64);
        color: #fff;
        font-size: 23px;
        line-height: 1.34;
        font-weight: 740;
        letter-spacing: 0;
        text-shadow: 0 1px 2px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.82);
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      }

      .caption-box i {
        font-style: italic;
      }

      .caption-box b {
        font-weight: 900;
      }

      .caption-box u {
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .player-controls {
        position: absolute;
        inset: auto 0 0;
        z-index: 4;
        padding: 0 30px 24px;
        transition: opacity 160ms ease;
      }

      .player.is-idle:not(.is-paused) .player-top,
      .player.is-idle:not(.is-paused) .player-controls,
      .player.is-idle:not(.is-paused) .player-gradient {
        opacity: 0;
        pointer-events: none;
      }

      .seek {
        width: 100%;
        height: 18px;
        margin: 0 0 10px;
        accent-color: #fff;
        cursor: pointer;
      }

      .control-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }

      .control-left,
      .control-right {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .player-btn {
        min-width: 38px;
        height: 38px;
        padding: 0 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(12,12,14,0.58);
        color: #fff;
        font-size: 13px;
        font-weight: 820;
        cursor: pointer;
        backdrop-filter: blur(18px);
        transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
      }

      .player-btn:hover {
        background: rgba(255,255,255,0.14);
        border-color: rgba(255,255,255,0.26);
      }

      .player-btn.active {
        background: #fff;
        color: #050506;
        border-color: #fff;
      }

      .player-btn:active {
        transform: translateY(1px);
      }

      .player-btn.transport {
        min-width: 44px;
        border-radius: 999px;
      }

      .player-btn.play-main {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        font-size: 15px;
        background: rgba(255,255,255,0.16);
      }

      .time-readout {
        margin-left: 6px;
        color: rgba(255,255,255,0.82);
        font-size: 13px;
        font-weight: 760;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }

      .volume {
        width: 96px;
        accent-color: #fff;
      }

      .chip {
        height: 34px;
        padding: 0 12px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(12,12,14,0.56);
        color: #fff;
        font-size: 12px;
        font-weight: 820;
        cursor: pointer;
        transition: background 140ms ease, border-color 140ms ease;
      }

      .chip.active {
        background: #fff;
        color: #050506;
        border-color: #fff;
      }

      .menu-wrap {
        position: relative;
      }

      .track-menu {
        position: absolute;
        right: 0;
        bottom: 48px;
        width: min(280px, calc(100vw - 48px));
        max-height: 310px;
        overflow: auto;
        padding: 8px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(12,12,14,0.92);
        box-shadow: 0 20px 70px rgba(0,0,0,0.58);
        backdrop-filter: blur(24px);
        display: none;
      }

      .track-menu.open {
        display: block;
      }

      .track-menu-title {
        padding: 7px 9px 8px;
        color: rgba(255,255,255,0.54);
        font-size: 11px;
        font-weight: 850;
        letter-spacing: 1.2px;
        text-transform: uppercase;
      }

      .track-option {
        width: 100%;
        min-height: 38px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 0 10px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: rgba(255,255,255,0.82);
        font-size: 13px;
        font-weight: 760;
        text-align: left;
        cursor: pointer;
      }

      .track-option:hover {
        background: rgba(255,255,255,0.10);
        color: #fff;
      }

      .track-option.active {
        background: rgba(255,255,255,0.16);
        color: #fff;
      }

      .track-option.active::after {
        content: "✓";
        font-weight: 900;
      }

      .player-actions .chip,
      .player-actions .btn {
        backdrop-filter: blur(18px);
      }

      @media (max-width: 760px) {
        .panel,
        .player {
          inset: 0;
          border-radius: 0;
        }

        .header {
          flex-direction: column;
        }

        .summary {
          grid-template-columns: 1fr;
        }

        .summary span:last-child {
          text-align: left;
        }

        .row {
          grid-template-columns: 58px minmax(0, 1fr);
        }

        .thumb {
          width: 58px;
        }

        .row-actions {
          grid-column: 1 / -1;
          justify-content: flex-start;
        }

        .caption-layer {
          bottom: 96px;
          width: calc(100vw - 28px);
        }

        .caption-box {
          font-size: 18px;
        }
      }
    </style>
    <div class="backdrop" data-action="close"></div>
    <section class="panel" role="dialog" aria-label="Noxis indirilenler">
      <header class="header">
        <div>
          <div class="kicker">NOXIS DESKTOP</div>
          <h1>İndirilenler</h1>
        </div>
        <div class="header-actions">
          <button class="btn" type="button" data-action="refresh">Yenile</button>
          <button class="btn primary" type="button" data-action="close">Kapat</button>
        </div>
      </header>
      <main class="body">
        <div class="summary" id="summary"></div>
        <div id="content"></div>
      </main>
    </section>
    <section class="player" id="player" aria-label="Noxis offline player">
      <div class="player-top">
        <div class="player-title" id="player-title"></div>
        <div class="player-actions" id="player-actions"></div>
      </div>
      <div class="video-shell">
        <video class="player-video" id="player-video" autoplay playsinline crossorigin="anonymous"></video>
        <button class="center-play" id="player-center-toggle" type="button" data-action="player-toggle" aria-label="Oynat"></button>
        <div class="caption-layer empty" id="caption-layer" aria-live="off"></div>
        <div class="player-gradient"></div>
        <div class="player-controls">
          <input class="seek" id="player-seek" type="range" min="0" max="1000" value="0" data-control="seek" aria-label="Zaman çizgisi" />
          <div class="control-row">
            <div class="control-left">
              <button class="player-btn transport" type="button" data-action="seek-back" aria-label="30 saniye geri">-30</button>
              <button class="player-btn play-main" id="player-toggle" type="button" data-action="player-toggle" aria-label="Oynat veya duraklat">▶</button>
              <button class="player-btn transport" type="button" data-action="seek-forward" aria-label="30 saniye ileri">+30</button>
              <span class="time-readout" id="player-time">0:00 / 0:00</span>
            </div>
            <div class="control-right">
              <div class="menu-wrap">
                <button class="player-btn" id="player-subtitle" type="button" data-action="toggle-subtitle-menu" aria-label="Altyazı seç">CC</button>
                <div class="track-menu" id="subtitle-menu" role="menu" aria-label="Altyazılar"></div>
              </div>
              <button class="player-btn" id="player-mute" type="button" data-action="player-mute" aria-label="Sesi kapat">Ses</button>
              <input class="volume" id="player-volume" type="range" min="0" max="1" step="0.01" value="1" data-control="volume" aria-label="Ses" />
              <button class="player-btn" type="button" data-action="player-fullscreen" aria-label="Tam ekran">⛶</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  panelRoot.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) {
      closeSubtitleMenu();
      return;
    }
    const action = button.getAttribute('data-action');
    const id = button.getAttribute('data-id');

    if (action === 'close') {
      hideDownloadsPanel();
      return;
    }

    if (action === 'refresh') {
      await refreshDownloadsPanel();
      return;
    }

    if (action === 'pause') {
      await ipcRenderer.invoke('downloads:pause', id);
      await refreshDownloadsPanel();
      return;
    }

    if (action === 'resume') {
      await ipcRenderer.invoke('downloads:resume', id);
      await refreshDownloadsPanel();
      return;
    }

    if (action === 'delete') {
      await ipcRenderer.invoke('downloads:delete', id);
      await refreshDownloadsPanel();
      return;
    }

    if (action === 'play') {
      const task = await ipcRenderer.invoke('downloads:playable', id);
      await showNativePlayer(task);
      return;
    }

    if (action === 'player-close') {
      closeNativePlayer();
      return;
    }

    if (action === 'player-toggle') {
      toggleNativePlayback();
      return;
    }

    if (action === 'seek-back') {
      seekNativePlayer(-30);
      return;
    }

    if (action === 'seek-forward') {
      seekNativePlayer(30);
      return;
    }

    if (action === 'player-mute') {
      toggleNativeMute();
      return;
    }

    if (action === 'player-fullscreen') {
      toggleNativeFullscreen();
      return;
    }

    if (action === 'toggle-subtitle-menu') {
      toggleSubtitleMenu();
      return;
    }

    if (action === 'select-subtitle') {
      const index = Number(button.getAttribute('data-index'));
      await setActiveSubtitle(Number.isFinite(index) ? index : -1);
      closeSubtitleMenu();
      return;
    }

    if (action === 'switch-audio') {
      const src = button.getAttribute('data-src');
      const video = panelRoot.getElementById('player-video');
      if (src && video) {
        if (src === nativePlayerSourceBeforeSwitch) {
          return;
        }
        const time = video.currentTime || 0;
        nativePlayerSourceBeforeSwitch = src;
        video.src = src;
        const restore = () => {
          video.currentTime = Math.min(time, video.duration || time);
          video.play().catch(() => {});
          video.removeEventListener('loadedmetadata', restore);
        };
        video.addEventListener('loadedmetadata', restore);
        updateAudioChips(src);
        updateNativePlayerUi();
        wakeNativePlayerChrome();
      }
    }
  });

  panelRoot.addEventListener('input', (event) => {
    const control = event.target?.getAttribute?.('data-control');
    const video = panelRoot.getElementById('player-video');
    if (!video) return;

    if (control === 'seek') {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration > 0) {
        video.currentTime = (Number(event.target.value) / 1000) * duration;
      }
      return;
    }

    if (control === 'volume') {
      video.volume = Number(event.target.value);
      video.muted = video.volume <= 0;
      updateNativePlayerUi();
    }
  });

  const video = panelRoot.getElementById('player-video');
  const player = panelRoot.getElementById('player');
  if (video) {
    ['loadedmetadata', 'timeupdate', 'play', 'pause', 'volumechange', 'ended'].forEach((eventName) => {
      video.addEventListener(eventName, updateNativePlayerUi);
    });
    video.addEventListener('play', wakeNativePlayerChrome);
    video.addEventListener('pause', wakeNativePlayerChrome);
    video.addEventListener('click', () => toggleNativePlayback());
    video.addEventListener('dblclick', () => toggleNativeFullscreen());
  }
  if (player) {
    player.addEventListener('mousemove', wakeNativePlayerChrome);
  }

  return panelRoot;
}

function openWhenDomReady(callback) {
  if (document.body) {
    callback();
    return;
  }
  window.addEventListener('DOMContentLoaded', callback, { once: true });
}

function showDownloadsPanel() {
  openWhenDomReady(async () => {
    ensurePanel();
    if (!panelHost) return;
    isPanelOpen = true;
    panelHost.classList.add('open');
    await refreshDownloadsPanel();
  });
}

function hideDownloadsPanel() {
  closeNativePlayer();
  isPanelOpen = false;
  if (panelHost) panelHost.classList.remove('open');
}

async function refreshDownloadsPanel() {
  if (!panelRoot) return;
  currentDownloadsPayload = await ipcRenderer.invoke('downloads:list');
  renderDownloadsPanel(currentDownloadsPayload);
}

function renderDownloadsPanel(payload) {
  if (!panelRoot) return;
  const downloads = payload?.downloads || [];
  const stats = payload?.stats || {};
  const summary = panelRoot.getElementById('summary');
  const content = panelRoot.getElementById('content');
  if (!summary || !content) return;

  summary.replaceChildren(
    textSpan(`${downloads.length} içerik`),
    textSpan(`${formatBytes(stats.downloadBytes)} yerel depolama`),
    textSpan(stats.rootDir || '')
  );

  if (downloads.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Henüz indirilen içerik yok.';
    content.replaceChildren(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'list';

  downloads.forEach((task) => {
    list.appendChild(createDownloadRow(task));
  });

  content.replaceChildren(list);
}

function textSpan(value) {
  const span = document.createElement('span');
  span.textContent = value;
  return span;
}

function createDownloadRow(task) {
  const row = document.createElement('article');
  row.className = 'row';

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  const imageUrl = tmdbImage(task.posterPath || task.backdropPath, 'w342');
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    thumb.appendChild(image);
  } else {
    thumb.textContent = 'N';
  }

  const info = document.createElement('div');
  info.className = 'info';

  const titleLine = document.createElement('div');
  titleLine.className = 'title-line';
  const title = document.createElement('h3');
  title.textContent = task.title || 'İsimsiz içerik';
  const status = document.createElement('span');
  status.className = `status ${statusClass(task)}`;
  status.textContent = statusLabel(task);
  titleLine.append(title, status);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = mediaMeta(task);

  const progress = document.createElement('div');
  progress.className = 'progress';
  const progressFill = document.createElement('span');
  progressFill.style.width = `${Math.max(0, Math.min(100, Number(task.progress) || 0))}%`;
  progress.appendChild(progressFill);

  info.append(titleLine, meta);
  if (task.error) {
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = task.error;
    info.appendChild(error);
  }
  info.appendChild(progress);

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  if (task.canPlay) actions.appendChild(actionButton('Oynat', 'play', task.id, true));
  if (task.status === 'DOWNLOADING' || task.status === 'PENDING') {
    actions.appendChild(actionButton('Duraklat', 'pause', task.id));
  }
  if (task.status === 'PAUSED' || task.status === 'FAILED' || task.isPaused) {
    actions.appendChild(actionButton('Sürdür', 'resume', task.id));
  }
  actions.appendChild(actionButton('Sil', 'delete', task.id));

  row.append(thumb, info, actions);
  return row;
}

function actionButton(label, action, id, primary = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = primary ? 'btn primary' : 'btn';
  button.setAttribute('data-action', action);
  button.setAttribute('data-id', id);
  button.textContent = label;
  return button;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function getNativeVideo() {
  return panelRoot?.getElementById('player-video') || null;
}

function wakeNativePlayerChrome() {
  if (!panelRoot) return;
  const player = panelRoot.getElementById('player');
  const video = getNativeVideo();
  if (!player) return;

  player.classList.remove('is-idle');
  if (nativePlayerIdleTimer) {
    window.clearTimeout(nativePlayerIdleTimer);
    nativePlayerIdleTimer = null;
  }

  if (video && !video.paused) {
    nativePlayerIdleTimer = window.setTimeout(() => {
      if (!video.paused) {
        player.classList.add('is-idle');
      }
    }, 2200);
  }
}

function updateNativePlayerUi() {
  if (!panelRoot) return;
  const video = getNativeVideo();
  if (!video) return;

  const player = panelRoot.getElementById('player');
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const seek = panelRoot.getElementById('player-seek');
  const time = panelRoot.getElementById('player-time');
  const toggle = panelRoot.getElementById('player-toggle');
  const center = panelRoot.getElementById('player-center-toggle');
  const mute = panelRoot.getElementById('player-mute');
  const volume = panelRoot.getElementById('player-volume');

  if (player) {
    player.classList.toggle('is-paused', video.paused);
    if (video.paused) {
      player.classList.remove('is-idle');
    }
  }
  if (seek && panelRoot.activeElement !== seek) {
    seek.value = duration > 0 ? String(Math.round((currentTime / duration) * 1000)) : '0';
  }
  if (time) {
    time.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  }
  if (toggle) {
    toggle.textContent = video.paused ? PLAYER_PLAY_ICON : 'II';
  }
  if (center) {
    center.classList.toggle('is-playing', !video.paused);
  }
  if (mute) {
    mute.textContent = video.muted || video.volume <= 0 ? 'Kapalı' : 'Ses';
  }
  if (volume && panelRoot.activeElement !== volume) {
    volume.value = String(video.muted ? 0 : video.volume);
  }
  renderCurrentSubtitle();
}

function toggleNativePlayback() {
  const video = getNativeVideo();
  if (!video) return;
  if (video.paused) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
  updateNativePlayerUi();
}

function seekNativePlayer(deltaSeconds) {
  const video = getNativeVideo();
  if (!video) return;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const next = Math.max(0, Math.min(duration || Number.MAX_SAFE_INTEGER, (video.currentTime || 0) + deltaSeconds));
  video.currentTime = next;
  updateNativePlayerUi();
}

function toggleNativeMute() {
  const video = getNativeVideo();
  if (!video) return;
  video.muted = !video.muted;
  if (!video.muted && video.volume <= 0) {
    video.volume = 0.75;
  }
  updateNativePlayerUi();
}

function toggleNativeFullscreen() {
  const player = panelRoot?.getElementById('player');
  if (!player) return;
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    player.requestFullscreen?.();
  }
}

function updateAudioChips(activeSrc) {
  if (!panelRoot) return;
  const buttons = panelRoot.querySelectorAll('[data-action="switch-audio"]');
  buttons.forEach((button) => {
    button.classList.toggle('active', button.getAttribute('data-src') === activeSrc);
  });
}

function closeSubtitleMenu() {
  panelRoot?.getElementById('subtitle-menu')?.classList.remove('open');
}

function toggleSubtitleMenu() {
  const menu = panelRoot?.getElementById('subtitle-menu');
  if (!menu) return;
  menu.classList.toggle('open');
  wakeNativePlayerChrome();
}

function renderSubtitleMenu() {
  if (!panelRoot) return;
  const menu = panelRoot.getElementById('subtitle-menu');
  if (!menu) return;

  const title = document.createElement('div');
  title.className = 'track-menu-title';
  title.textContent = 'Altyazı';

  const off = document.createElement('button');
  off.type = 'button';
  off.className = 'track-option';
  off.setAttribute('data-action', 'select-subtitle');
  off.setAttribute('data-index', '-1');
  off.textContent = 'Kapalı';

  const options = nativeSubtitleTracks.map((track, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'track-option';
    button.setAttribute('data-action', 'select-subtitle');
    button.setAttribute('data-index', String(index));
    button.textContent = track.label || `Altyazı ${index + 1}`;
    return button;
  });

  menu.replaceChildren(title, off, ...options);
  updateSubtitleMenuUi();
}

function updateSubtitleMenuUi() {
  if (!panelRoot) return;
  const button = panelRoot.getElementById('player-subtitle');
  if (button) {
    button.classList.toggle('active', activeSubtitleIndex !== null);
    const label = activeSubtitleIndex === null
      ? 'Altyazı kapalı'
      : `Altyazı: ${nativeSubtitleTracks[activeSubtitleIndex]?.label || 'Açık'}`;
    button.setAttribute('aria-label', label);
  }

  const options = panelRoot.querySelectorAll('[data-action="select-subtitle"]');
  options.forEach((option) => {
    const index = Number(option.getAttribute('data-index'));
    option.classList.toggle(
      'active',
      (activeSubtitleIndex === null && index === -1) || activeSubtitleIndex === index
    );
  });
}

function clearCaptionLayer() {
  const layer = panelRoot?.getElementById('caption-layer');
  if (!layer) return;
  layer.replaceChildren();
  layer.classList.add('empty');
  lastRenderedCaption = '';
}

function parseSubtitleTime(value = '') {
  const match = String(value).trim().replace(',', '.').match(/(?:(\d+):)?(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const total = (hours * 3600) + (minutes * 60) + seconds;
  return Number.isFinite(total) ? total : null;
}

function parseSubtitleCues(text = '') {
  const clean = String(text).replace(/^\uFEFF/, '').replace(/\r/g, '');
  const blocks = clean.split(/\n{2,}/);
  const cues = [];

  blocks.forEach((block) => {
    const lines = block.split('\n').map((line) => line.trimEnd()).filter(Boolean);
    if (!lines.length) return;
    if (/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/i.test(lines[0])) return;

    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) return;

    const timing = lines[timingIndex].split(/\s+-->\s+/);
    if (timing.length < 2) return;

    const start = parseSubtitleTime(timing[0]);
    const end = parseSubtitleTime(timing[1].split(/\s+/)[0]);
    if (start === null || end === null || end <= start) return;

    const cueText = lines.slice(timingIndex + 1).join('\n').trim();
    if (!cueText) return;
    cues.push({ start, end, text: cueText });
  });

  return cues.sort((a, b) => a.start - b.start);
}

function normalizeSubtitleMarkup(value) {
  return String(value || '')
    .replace(/\\N/g, '\n')
    .replace(/\{\\i1\}/gi, '<i>')
    .replace(/\{\\i0\}/gi, '</i>')
    .replace(/\{\\b1\}/gi, '<b>')
    .replace(/\{\\b0\}/gi, '</b>')
    .replace(/\{\\u1\}/gi, '<u>')
    .replace(/\{\\u0\}/gi, '</u>')
    .replace(/\{\\[^}]+\}/g, '')
    .replace(/<\d{1,2}:\d{2}(?::\d{2})?[\.,]\d{3}>/g, '')
    .replace(/&lt;(\/?)(i|b|u)&gt;/gi, '<$1$2>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/<c(?:\.[^>]*)?>/gi, '<span>')
    .replace(/<\/c>/gi, '</span>')
    .replace(/<v(?:\s+[^>]*)?>/gi, '<span>')
    .replace(/<\/v>/gi, '</span>')
    .replace(/<lang(?:\s+[^>]*)?>/gi, '<span>')
    .replace(/<\/lang>/gi, '</span>')
    .replace(/\n/g, '<br>');
}

function appendSafeSubtitleNode(sourceNode, targetNode) {
  if (sourceNode.nodeType === Node.TEXT_NODE) {
    targetNode.appendChild(document.createTextNode(sourceNode.textContent || ''));
    return;
  }

  if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const tag = sourceNode.tagName.toLowerCase();
  const allowed = new Set(['i', 'b', 'u', 'br', 'span', 'ruby', 'rt']);
  if (!allowed.has(tag)) {
    sourceNode.childNodes.forEach((child) => appendSafeSubtitleNode(child, targetNode));
    return;
  }

  if (tag === 'br') {
    targetNode.appendChild(document.createElement('br'));
    return;
  }

  const next = document.createElement(tag);
  sourceNode.childNodes.forEach((child) => appendSafeSubtitleNode(child, next));
  targetNode.appendChild(next);
}

function renderStyledSubtitleText(rawText, container) {
  const markup = normalizeSubtitleMarkup(rawText);
  const parsed = new DOMParser().parseFromString(`<div>${markup}</div>`, 'text/html');
  const root = parsed.body.firstElementChild;
  container.replaceChildren();
  root?.childNodes.forEach((node) => appendSafeSubtitleNode(node, container));
}

function renderCurrentSubtitle() {
  if (!panelRoot) return;
  const video = getNativeVideo();
  const layer = panelRoot.getElementById('caption-layer');
  if (!video || !layer || activeSubtitleIndex === null || activeSubtitleCues.length === 0) {
    clearCaptionLayer();
    return;
  }

  const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const text = activeSubtitleCues
    .filter((cue) => currentTime >= cue.start && currentTime <= cue.end)
    .map((cue) => cue.text)
    .join('\n');

  if (!text) {
    clearCaptionLayer();
    return;
  }

  if (text === lastRenderedCaption) {
    return;
  }

  const box = document.createElement('div');
  box.className = 'caption-box';
  renderStyledSubtitleText(text, box);
  layer.replaceChildren(box);
  layer.classList.remove('empty');
  lastRenderedCaption = text;
}

async function setActiveSubtitle(index) {
  if (index < 0 || !nativeSubtitleTracks[index]) {
    activeSubtitleIndex = null;
    activeSubtitleCues = [];
    clearCaptionLayer();
    updateSubtitleMenuUi();
    return;
  }

  const track = nativeSubtitleTracks[index];
  activeSubtitleIndex = index;
  updateSubtitleMenuUi();

  if (!track.cues) {
    try {
      const response = await fetch(track.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      track.cues = parseSubtitleCues(await response.text());
    } catch {
      track.cues = [];
    }
  }

  activeSubtitleCues = track.cues || [];
  lastRenderedCaption = '';
  renderCurrentSubtitle();
}

function desktopMediaUrl(task, fileName = 'video.mp4') {
  return `noxis-media://media/${encodeURIComponent(String(task.id))}/${encodeURIComponent(fileName)}`;
}

function localMediaFileNameFromUrl(value) {
  try {
    const parsed = new URL(value);
    const rawParts = parsed.protocol === 'noxis-media:'
      ? [parsed.hostname, ...parsed.pathname.split('/').filter(Boolean)]
      : parsed.pathname.split('/').filter(Boolean);
    const parts = rawParts.map(part => decodeURIComponent(part));
    if (parts[0] !== 'media' || parts.length < 3) {
      return null;
    }
    const fileName = parts[parts.length - 1];
    return fileName && !fileName.includes('/') && !fileName.includes('\\') ? fileName : null;
  } catch {
    return null;
  }
}

function rewriteLocalMediaUrl(value, task) {
  const fileName = localMediaFileNameFromUrl(value);
  return fileName ? desktopMediaUrl(task, fileName) : value;
}

function normalizeOfflineMetadata(metadata, task) {
  if (!metadata || !task?.id) return metadata;

  const next = { ...metadata };
  if (metadata.audioTracks) {
    next.audioTracks = {
      ...metadata.audioTracks,
      dub: task.localUrl || rewriteLocalMediaUrl(metadata.audioTracks.dub, task),
      original: task.originalUrl || rewriteLocalMediaUrl(metadata.audioTracks.original, task)
    };
  }

  if (Array.isArray(metadata.subtitles)) {
    next.subtitles = metadata.subtitles.map((subtitle) => ({
      ...subtitle,
      url: rewriteLocalMediaUrl(subtitle.url, task)
    }));
  }

  return next;
}

async function showNativePlayer(task) {
  if (!task?.localUrl || !panelRoot) return;
  const player = panelRoot.getElementById('player');
  const title = panelRoot.getElementById('player-title');
  const actions = panelRoot.getElementById('player-actions');
  const video = panelRoot.getElementById('player-video');
  if (!player || !title || !actions || !video) return;

  let metadata = null;
  try {
    if (task.metadataUrl) {
      const response = await fetch(task.metadataUrl);
      if (response.ok) metadata = await response.json();
    }
  } catch {
    metadata = null;
  }
  metadata = normalizeOfflineMetadata(metadata, task);

  title.textContent = task.title || metadata?.title || 'Çevrimdışı video';
  actions.replaceChildren();

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'btn primary';
  closeButton.setAttribute('data-action', 'player-close');
  closeButton.textContent = 'Kapat';

  const audioTracks = metadata?.audioTracks;
  if (audioTracks?.dub && audioTracks?.original) {
    const dubButton = document.createElement('button');
    dubButton.type = 'button';
    dubButton.className = 'chip';
    dubButton.setAttribute('data-action', 'switch-audio');
    dubButton.setAttribute('data-src', audioTracks.dub);
    dubButton.textContent = 'Türkçe';

    const originalButton = document.createElement('button');
    originalButton.type = 'button';
    originalButton.className = 'chip';
    originalButton.setAttribute('data-action', 'switch-audio');
    originalButton.setAttribute('data-src', audioTracks.original);
    originalButton.textContent = 'Orijinal';
    actions.append(dubButton, originalButton);
  }

  actions.appendChild(closeButton);
  video.pause();
  video.controls = false;
  video.crossOrigin = 'anonymous';
  video.muted = false;
  video.replaceChildren();
  activeSubtitleIndex = null;
  activeSubtitleCues = [];
  nativeSubtitleTracks = [];
  clearCaptionLayer();
  nativePlayerSourceBeforeSwitch = audioTracks?.dub || task.localUrl;
  video.src = nativePlayerSourceBeforeSwitch;

  const subtitles = Array.isArray(metadata?.subtitles) ? metadata.subtitles : [];
  nativeSubtitleTracks = subtitles
    .filter((subtitle) => subtitle?.url)
    .map((subtitle, index) => ({
      label: subtitle.label || subtitle.lang || `Altyazı ${index + 1}`,
      lang: subtitle.lang || 'tr',
      url: subtitle.url
    }));
  renderSubtitleMenu();

  nativeSubtitleTracks.forEach((subtitle) => {
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = subtitle.label;
    track.srclang = subtitle.lang || 'tr';
    track.src = subtitle.url;
    video.appendChild(track);
  });
  Array.from(video.textTracks || []).forEach((track) => {
    track.mode = 'disabled';
  });

  player.classList.add('open');
  player.classList.add('is-paused');
  updateAudioChips(nativePlayerSourceBeforeSwitch);
  updateNativePlayerUi();
  wakeNativePlayerChrome();
  setActiveSubtitle(nativeSubtitleTracks.length ? 0 : -1);
  video.play().then(updateNativePlayerUi).catch(updateNativePlayerUi);
}

function closeNativePlayer() {
  if (!panelRoot) return;
  const player = panelRoot.getElementById('player');
  const video = panelRoot.getElementById('player-video');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.replaceChildren();
    video.load();
  }
  nativePlayerSourceBeforeSwitch = null;
  activeSubtitleIndex = null;
  activeSubtitleCues = [];
  nativeSubtitleTracks = [];
  clearCaptionLayer();
  closeSubtitleMenu();
  renderSubtitleMenu();
  if (nativePlayerIdleTimer) {
    window.clearTimeout(nativePlayerIdleTimer);
    nativePlayerIdleTimer = null;
  }
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  }
  if (player) player.classList.remove('open', 'is-paused', 'is-idle');
}

ipcRenderer.on('downloads:changed', (_event, payload) => {
  currentDownloadsPayload = payload || currentDownloadsPayload;
  if (isPanelOpen && panelRoot) {
    renderDownloadsPanel(currentDownloadsPayload);
  }
});

window.addEventListener('keydown', (event) => {
  const playerOpen = !!panelRoot?.getElementById('player')?.classList.contains('open');
  const subtitleMenuOpen = !!panelRoot?.getElementById('subtitle-menu')?.classList.contains('open');

  if (event.key === 'Escape' && subtitleMenuOpen) {
    closeSubtitleMenu();
    event.preventDefault();
    return;
  }

  if (event.key === 'Escape' && playerOpen) {
    closeNativePlayer();
    event.preventDefault();
    return;
  }

  if (event.key === 'Escape' && isPanelOpen) {
    hideDownloadsPanel();
    event.preventDefault();
    return;
  }

  if (!playerOpen) {
    return;
  }

  if (event.key === ' ' || event.key === 'Spacebar') {
    toggleNativePlayback();
    event.preventDefault();
    return;
  }

  if (event.key === 'ArrowLeft') {
    seekNativePlayer(-10);
    event.preventDefault();
    return;
  }

  if (event.key === 'ArrowRight') {
    seekNativePlayer(10);
    event.preventDefault();
    return;
  }

  if (event.key.toLowerCase() === 'm') {
    toggleNativeMute();
    event.preventDefault();
    return;
  }

  if (event.key.toLowerCase() === 'c') {
    toggleSubtitleMenu();
    event.preventDefault();
  }
});

const downloadsApi = {
  async list() {
    return ipcRenderer.invoke('downloads:list');
  },
  async pause(id) {
    return ipcRenderer.invoke('downloads:pause', id);
  },
  async resume(id) {
    return ipcRenderer.invoke('downloads:resume', id);
  },
  async delete(id) {
    return ipcRenderer.invoke('downloads:delete', id);
  },
  async playable(id) {
    return ipcRenderer.invoke('downloads:playable', id);
  },
  onChanged(callback) {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('downloads:changed', handler);
    return () => ipcRenderer.removeListener('downloads:changed', handler);
  }
};

const bridge = {
  isDesktop: true,
  platform: 'windows',
  async getState() {
    return ipcRenderer.invoke('desktop:get-state');
  },
  async startDownload(...args) {
    const payload = buildDownloadPayload(...args);
    const task = await ipcRenderer.invoke('downloads:start', payload);
    showDownloadsPanel();
    return task;
  },
  async openDownloads() {
    showDownloadsPanel();
    return ipcRenderer.invoke('downloads:open');
  },
  downloads: downloadsApi
};

contextBridge.exposeInMainWorld('NoxisDesktop', bridge);

contextBridge.exposeInMainWorld('NoxisAppBridge', {
  startDownload: (...args) => bridge.startDownload(...args),
  openDownloads: () => bridge.openDownloads()
});
