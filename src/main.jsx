// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

const isLocalHost = (hostname = window.location.hostname) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

const cleanupLocalServiceWorkers = async () => {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));

    if ((registrations.length > 0 || cacheKeys.length > 0) && !sessionStorage.getItem('noxis_local_sw_reset')) {
      sessionStorage.setItem('noxis_local_sw_reset', 'true');
      window.location.reload();
    }
  } catch (error) {
    console.warn('SW cleanup failed: ', error);
  }
};

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (isLocalHost()) {
      cleanupLocalServiceWorkers();
      return;
    }

    let hasRefreshed = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasRefreshed) return;
      hasRefreshed = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
        registration.update().catch(() => {});

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              installingWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
