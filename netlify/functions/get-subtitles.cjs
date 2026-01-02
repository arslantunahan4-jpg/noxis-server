const axios = require('axios');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    const { imdb, season, episode } = event.queryStringParameters;

    if (!imdb) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'IMDB ID required' })
        };
    }

    try {
        // Use Stremio's OpenSubtitles addon (v3) - no ads/watermarks
        let subUrl;
        if (season && episode) {
            subUrl = `https://opensubtitles-v3.strem.io/subtitles/series/${imdb}:${season}:${episode}.json`;
        } else {
            subUrl = `https://opensubtitles-v3.strem.io/subtitles/movie/${imdb}.json`;
        }

        console.log(`[Subtitles] Fetching from Stremio: ${subUrl}`);
        const response = await axios.get(subUrl, { timeout: 10000 });

        const subtitles = [];
        if (response.data && response.data.subtitles) {
            // Prioritize Turkish, then English
            const trSubs = response.data.subtitles.filter(s => s.lang === 'tur' || s.lang === 'tr');
            const enSubs = response.data.subtitles.filter(s => s.lang === 'eng' || s.lang === 'en');

            trSubs.slice(0, 3).forEach(sub => {
                subtitles.push({ label: 'Türkçe', lang: 'tr', url: sub.url });
            });
            enSubs.slice(0, 3).forEach(sub => {
                subtitles.push({ label: 'English', lang: 'en', url: sub.url });
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(subtitles)
        };
    } catch (err) {
        console.error('[Subtitles] Error:', err.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify([])
        };
    }
};
