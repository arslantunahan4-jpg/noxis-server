import axios from 'axios';

const playlistUrl = 'https://vidmody.com/mm/tt22022452//main2/index-v1-a1.gif';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://vidmody.com/'
};

const getVidmodyHeaderVariants = (baseHeaders) => {
    return [
        baseHeaders,
        {
            ...baseHeaders,
            'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"'
        }
    ];
};

const findFirstPlaylistAssetUrl = (content, playlistUrl) => {
    const lines = content.split('\n');
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

const probeRemoteAsset = async (assetUrl, requestHeaders) => {
    console.log(`Probing asset: ${assetUrl}`);
    try {
        const headResponse = await axios.head(assetUrl, {
            headers: requestHeaders,
            timeout: 5000,
            validateStatus: (s) => s < 500
        });
        console.log(`HEAD status: ${headResponse.status}`);
        if (headResponse.status === 200 || headResponse.status === 206) return true;
    } catch (e) {
        console.log(`HEAD probe failed: ${e.message}`);
    }

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
        console.log(`GET range status: ${rangeResponse.status}`);
        if (rangeResponse.status === 200 || rangeResponse.status === 206) return true;
    } catch (e) {
        console.log(`GET range probe failed: ${e.message}`);
    }

    return false;
};

const validateVidmodyPlaylistUrl = async (playlistUrl, headers) => {
    if (!playlistUrl) return false;

    for (const requestHeaders of getVidmodyHeaderVariants(headers)) {
        try {
            console.log(`Fetching playlist: ${playlistUrl}`);
            const response = await axios.get(playlistUrl, {
                headers: requestHeaders,
                timeout: 8000,
                responseType: 'text',
                validateStatus: (s) => s < 400
            });

            const content = typeof response.data === 'string' ? response.data : '';
            if (!content) {
                console.log(`Empty content.`);
                continue;
            }

            console.log(`Playlist content length: ${content.length}`);
            if (content.trim().startsWith('WEBVTT')) {
                return true;
            }

            if (!content.includes('#EXTM3U')) {
                console.log(`Does not contain #EXTM3U`);
                continue;
            }

            const firstAssetUrl = findFirstPlaylistAssetUrl(content, playlistUrl);
            if (!firstAssetUrl) {
                console.log(`First asset url not found.`);
                continue;
            }

            console.log(`First asset URL: ${firstAssetUrl}`);
            if (await probeRemoteAsset(firstAssetUrl, requestHeaders)) {
                return true;
            }
        } catch (e) {
            console.log(`Error validating playlist: ${e.message}`);
        }
    }

    return false;
};

async function test() {
    const isPlayable = await validateVidmodyPlaylistUrl(playlistUrl, headers);
    console.log(`Is Playable?`, isPlayable);
}

test();
