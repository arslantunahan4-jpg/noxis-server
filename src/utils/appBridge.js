/**
 * Checks if a Noxis native bridge is available.
 */
export const isAppBridgeAvailable = () => {
    return typeof window !== 'undefined' && !!(window.NoxisDesktop || window.NoxisAppBridge || window.AndroidBridge);
};

/**
 * Starts a local download in the Android or desktop app.
 * @param {string} videoUrl - Direct MP4/MKV/HLS URL
 * @param {string} videoTitle - Movie or episode title
 */
export const downloadNoxisMovie = (videoUrl, videoTitle, posterPath = null, backdropPath = null, mediaType = null, season = null, episode = null, subtitlesJson = null, audioTracksJson = null, quality = 'HD', wifiOnly = false) => {
    if (!videoUrl) {
        console.error("[AppBridge] Video URL is empty");
        return false;
    }

    console.log("[AppBridge] startDownload triggered for:", videoTitle, videoUrl, posterPath, backdropPath, mediaType, season, episode, "quality:", quality, "wifiOnly:", wifiOnly);

    const s = season ? parseInt(season, 10) : 0;
    const e = episode ? parseInt(episode, 10) : 0;
    const bridge = window.NoxisDesktop || window.NoxisAppBridge || window.AndroidBridge;

    if (bridge && typeof bridge.startDownload === 'function') {
        try {
            bridge.startDownload(videoUrl, videoTitle, posterPath, backdropPath, mediaType, s, e, subtitlesJson, audioTracksJson, quality, wifiOnly);
        } catch (err) {
            console.warn("[AppBridge] Fallback to legacy startDownload due to signature mismatch:", err);
            bridge.startDownload(videoUrl, videoTitle, posterPath, backdropPath, mediaType, s, e);
        }
        return true;
    }

    console.log("[AppBridge] Browser fallback - opening URL:", videoUrl);
    const nextWindow = window.open(videoUrl, '_blank');
    if (nextWindow) nextWindow.focus();
    return false;
};

/**
 * Opens the local downloads section inside the native app.
 */
export const openAppDownloadsScreen = () => {
    const bridge = window.NoxisDesktop || window.NoxisAppBridge || window.AndroidBridge;
    if (bridge && typeof bridge.openDownloads === 'function') {
        bridge.openDownloads();
        return true;
    }

    alert("Bu özellik yalnızca Noxis uygulamasında kullanılabilir!");
    return false;
};
