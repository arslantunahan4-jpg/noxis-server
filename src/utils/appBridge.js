/**
 * Checks if the Noxis Android App Bridge is available.
 */
export const isAppBridgeAvailable = () => {
    return typeof window !== 'undefined' && !!(window.NoxisAppBridge || window.AndroidBridge);
};

/**
 * Filmi Android Uygulamasında Yerel Olarak İndirmeyi Başlatır
 * @param {string} videoUrl - İndirmek istediğiniz videonun doğrudan MP4/MKV bağlantısı
 * @param {string} videoTitle - Film veya videonun başlığı
 */
export const downloadNoxisMovie = (videoUrl, videoTitle, posterPath = null, backdropPath = null, mediaType = null, season = null, episode = null, subtitlesJson = null, audioTracksJson = null, quality = 'HD', wifiOnly = false) => {
    if (!videoUrl) {
        console.error("[AppBridge] Video URL is empty");
        return false;
    }
    
    console.log("[AppBridge] startDownload triggered for:", videoTitle, videoUrl, posterPath, backdropPath, mediaType, season, episode, "quality:", quality, "wifiOnly:", wifiOnly);

    const s = season ? parseInt(season, 10) : 0;
    const e = episode ? parseInt(episode, 10) : 0;

    if (window.NoxisAppBridge && typeof window.NoxisAppBridge.startDownload === 'function') {
        try {
            // Call the fully equipped native downloader bridge
            window.NoxisAppBridge.startDownload(videoUrl, videoTitle, posterPath, backdropPath, mediaType, s, e, subtitlesJson, audioTracksJson, quality, wifiOnly);
        } catch (err) {
            console.warn("[AppBridge] Fallback to legacy startDownload due to signature mismatch:", err);
            window.NoxisAppBridge.startDownload(videoUrl, videoTitle, posterPath, backdropPath, mediaType, s, e);
        }
        return true;
    } else if (window.AndroidBridge && typeof window.AndroidBridge.startDownload === 'function') {
        try {
            window.AndroidBridge.startDownload(videoUrl, videoTitle, posterPath, backdropPath, mediaType, s, e, subtitlesJson, audioTracksJson, quality, wifiOnly);
        } catch (err) {
            console.warn("[AppBridge] Fallback to legacy startDownload for AndroidBridge:", err);
            window.AndroidBridge.startDownload(videoUrl, videoTitle, posterPath, backdropPath, mediaType, s, e);
        }
        return true;
    } else {
        // Fallback for browser
        console.log("[AppBridge] Browser fallback - opening URL:", videoUrl);
        const nextWindow = window.open(videoUrl, '_blank');
        if (nextWindow) nextWindow.focus();
        return false;
    }
};

/**
 * Uygulamanın içerisindeki yerel İndirilenler sekmesini açar
 */
export const openAppDownloadsScreen = () => {
    if (window.NoxisAppBridge && typeof window.NoxisAppBridge.openDownloads === 'function') {
        window.NoxisAppBridge.openDownloads();
        return true;
    } else if (window.AndroidBridge && typeof window.AndroidBridge.openDownloads === 'function') {
        window.AndroidBridge.openDownloads();
        return true;
    } else {
        alert("Bu özellik yalnızca Noxis Android uygulamasında kullanılabilir!");
        return false;
    }
};
