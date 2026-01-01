// Service Worker Disabled for WebTorrent Compatibility
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
