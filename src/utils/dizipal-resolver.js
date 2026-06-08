import axios from 'axios';
import * as cheerio from 'cheerio';
import CryptoJS from 'crypto-js';

/**
 * Decrypts encrypted post content from Dizipal
 * @param {string} content - Encrypted content (base64)
 * @param {string} key - Decryption key
 * @returns {string} Decrypted HTML content
 */
export function decryptContent(content, key) {
    try {
        const decrypted = CryptoJS.AES.decrypt(content, key);
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error('[DizipalResolver] Decryption failed:', e.message);
        return null;
    }
}

/**
 * Resolves Dizipal video stream URLs (Vidmody, StreamIMDb, etc.) from a given film/episode page URL.
 * @param {string} pageUrl - The Dizipal page URL (e.g. https://dizipal1554.com/movies/the-super-mario-galaxy-movie)
 * @returns {Promise<Array<{provider: string, url: string}>>} Resolved stream streams
 */
export async function resolveDizipal(pageUrl) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };

    try {
        console.log(`[DizipalResolver] Requesting main page: ${pageUrl}`);
        const response = await axios.get(pageUrl, { headers, timeout: 10000 });
        const html = response.data;

        // 1. Extract appCKey
        const appCKeyMatch = html.match(/window\.appCKey\s*=\s*'([^']+)';/);
        if (!appCKeyMatch) {
            console.error('[DizipalResolver] window.appCKey not found in page HTML.');
            return null;
        }

        const appCKeyBase64 = appCKeyMatch[1];
        const appCKeyDecoded = Buffer.from(appCKeyBase64, 'base64').toString('utf8');

        // Extract session cookies if returned
        const setCookie = response.headers['set-cookie'];
        const cookieStr = setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : '';

        // 2. Perform AJAX router request
        const routerUrl = `${pageUrl}?_=router`;
        console.log(`[DizipalResolver] Requesting router page with global-ckey: ${routerUrl}`);

        const ajaxHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'x-global-ckey': appCKeyDecoded,
            'x-requested-with': 'XMLHttpRequest',
            'referer': pageUrl,
            'cookie': cookieStr,
            'cache-control': 'no-cache',
            'pragma': 'no-cache'
        };

        const routerResponse = await axios.get(routerUrl, { headers: ajaxHeaders, timeout: 10000 });
        const routerData = routerResponse.data;

        let content = '';
        if (typeof routerData === 'object' && routerData !== null) {
            if (routerData.data && routerData.data.content) {
                content = routerData.data.content;
            } else if (routerData.encrypted && routerData.key) {
                // If the response is AES encrypted (for extra obfuscation)
                content = decryptContent(routerData.encrypted, routerData.key);
            }
        } else if (typeof routerData === 'string' && routerData.trim()) {
            // Sometimes it returns JSON string or raw HTML directly
            try {
                const parsed = JSON.parse(routerData);
                if (parsed.data && parsed.data.content) {
                    content = parsed.data.content;
                }
            } catch (e) {
                // Raw HTML fallback
                content = routerData;
            }
        }

        if (!content) {
            console.warn('[DizipalResolver] Router response returned empty content.');
            return null;
        }

        // 3. Parse with Cheerio to extract iframe and video sources
        const $ = cheerio.load(content);
        const streams = [];

        // Check iframes
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src) {
                if (src.includes('vidmody') || src.includes('streamimdb') || src.includes('brightpathsignals') || src.includes('nextgencloudfabric')) {
                    streams.push({
                        provider: src.includes('vidmody') ? 'Vidmody' : ((src.includes('streamimdb') || src.includes('nextgencloudfabric')) ? 'StreamIMDb' : 'BrightPath'),
                        url: src
                    });
                } else if (src.startsWith('http') || src.startsWith('//')) {
                    // General fallback for other hosts/players
                    const providerName = new URL(src.startsWith('//') ? 'https:' + src : src).hostname.replace('www.', '');
                    streams.push({
                        provider: providerName,
                        url: src
                    });
                }
            }
        });

        // Check data-video or option elements
        $('.player-option, .video-option, [data-video], [data-url], button').each((i, el) => {
            const label = $(el).text().trim();
            const dataVideo = $(el).attr('data-video') || $(el).attr('data-url') || $(el).attr('data-src');
            if (dataVideo) {
                const provider = label || 'Alternative';
                streams.push({
                    provider,
                    url: dataVideo
                });
            }
        });

        console.log(`[DizipalResolver] Resolved ${streams.length} stream sources from Dizipal.`);
        return streams;

    } catch (e) {
        console.error('[DizipalResolver] Error resolving Dizipal URL:', e.message);
        return null;
    }
}
