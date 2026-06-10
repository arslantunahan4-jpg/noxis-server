// Noxis Streaming Worker with M3U Fallback
// Features: Universal Proxy, M3U8 Rewrite, Adaptive Master Playlist, Smart Retry, M3U Fallback

const M3U_URL = 'https://raw.githubusercontent.com/GitLatte/patr0n/refs/heads/site/lists/power-yabanci-dizi.m3u';

let cachedM3U = null;
let cacheTime = 0;
const CACHE_DURATION = 3600000; // 1 saat

async function fetchM3UList() {
    const now = Date.now();
    if (cachedM3U && (now - cacheTime) < CACHE_DURATION) {
        return cachedM3U;
    }
    
    try {
        const response = await fetch(M3U_URL);
        if (!response.ok) return [];
        
        const text = await response.text();
        const lines = text.split('\n');
        const entries = [];
        let currentInfo = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXTINF:')) {
                const titleMatch = line.match(/,(.+?)$/);
                const titlePart = titleMatch ? titleMatch[1] : '';
                
                let seriesName = '';
                let season = 1;
                let episode = 1;
                
                const sxeMatch = titlePart.match(/(.+?)\s+s(\d+)e(\d+)/i);
                const sezonMatch = titlePart.match(/(.+?)[-\s]+(\d+)\.\s*Sezon\s*(\d+)\.\s*Bölüm/i);
                
                if (sxeMatch) {
                    seriesName = sxeMatch[1].trim();
                    season = parseInt(sxeMatch[2]);
                    episode = parseInt(sxeMatch[3]);
                } else if (sezonMatch) {
                    seriesName = sezonMatch[1].trim();
                    season = parseInt(sezonMatch[2]);
                    episode = parseInt(sezonMatch[3]);
                } else {
                    seriesName = titlePart;
                }
                
                seriesName = seriesName.replace(/-$/, '').trim();
                currentInfo = { seriesName, season, episode, fullTitle: titlePart };
            } else if (line.startsWith('http')) {
                if (currentInfo) {
                    entries.push({ ...currentInfo, url: line });
                    currentInfo = null;
                }
            }
        }
        
        cachedM3U = entries;
        cacheTime = now;
        return entries;
    } catch (e) {
        console.error('M3U fetch error:', e);
        return [];
    }
}

function normalize(str) {
    if (!str) return '';
    const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ı': 'i', 'ö': 'o', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'İ': 'i', 'Ö': 'o' };
    return str.split('').map(c => trMap[c] || c).join('').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function findInM3U(title, season, episode) {
    if (!title) return null;
    const entries = await fetchM3UList();
    const searchTitle = normalize(title);
    const s = parseInt(season) || 1;
    const e = parseInt(episode) || 1;
    
    let match = entries.find(entry => {
        const entryTitle = normalize(entry.seriesName);
        return entryTitle === searchTitle && entry.season === s && entry.episode === e;
    });

    if (!match) {
        match = entries.find(entry => {
            const entryTitle = normalize(entry.seriesName);
            return (entryTitle.includes(searchTitle) || searchTitle.includes(entryTitle)) && 
                   entry.season === s && entry.episode === e;
        });
    }

    return match ? match.url : null;
}

const rewriteMasterManifest = (content, targetUrl, workerUrl, referer, buildProxyUrl) => {
  const lines = content.split(/\r?\n/);
  
  const resolveUrl = (u) => {
    if (!u) return u;
    if (u.startsWith('http')) return u;
    if (u.startsWith('//')) return 'https:' + u;
    try {
      return new URL(u, targetUrl).href;
    } catch {
      return u;
    }
  };

  const rewrittenLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // 1. Rewrite AUDIO tracks
    if (trimmed.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
      return line.replace(/URI="([^"]+)"/, (match, uri) => {
        const absUri = resolveUrl(uri);
        const proxyUri = buildProxyUrl(workerUrl, absUri, referer);
        return `URI="${proxyUri}"`;
      });
    }

    // 2. Rewrite SUBTITLES tracks
    if (trimmed.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES')) {
      return line.replace(/URI="([^"]+)"/, (match, uri) => {
        const absUri = resolveUrl(uri);
        const proxyUri = buildProxyUrl(workerUrl, absUri, referer);
        return `URI="${proxyUri}"`;
      });
    }

    // 3. Rewrite variant stream URLs (lines that don't start with #)
    if (!trimmed.startsWith('#')) {
      const absUri = resolveUrl(trimmed);
      return buildProxyUrl(workerUrl, absUri, referer);
    }

    return line;
  });

  return rewrittenLines.join('\n');
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url');
        const mode = url.searchParams.get('mode');
        const fallbackUrl = url.searchParams.get('fallback');
        
        // M3U arama parametreleri
        const searchTitle = url.searchParams.get('title');
        const searchSeason = url.searchParams.get('season');
        const searchEpisode = url.searchParams.get('episode');

        // --- 1. CORS Preflight ---
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': '*'
                }
            });
        }

        // --- 1a. Vidmody Master Manifest Parser (/vs/tt123456 or mode=vs) ---
        const isVsRequest = url.pathname.toLowerCase().startsWith('/vs/') || 
                            mode === 'vs' || 
                            mode === 'vidmody' || 
                            (targetUrl && targetUrl.toLowerCase().includes('/vs/'));

        if (isVsRequest) {
            let finalTarget = targetUrl;
            if (!finalTarget) {
                finalTarget = `https://vidmody.com${url.pathname}${url.search}`;
            }
            
            const referer = url.searchParams.get('referer') || 'https://vidmody.com/';
            const workerUrl = `${url.origin}${url.pathname}`;

            try {
                const userAgent = request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
                let response = await fetch(finalTarget, {
                    method: request.method,
                    headers: {
                        'Referer': referer,
                        'Origin': 'https://vidmody.com',
                        'User-Agent': userAgent
                    }
                });

                if (response.status === 403 || response.status === 401) {
                    response = await fetch(finalTarget, {
                        method: request.method,
                        headers: {
                            'User-Agent': userAgent
                        }
                    });
                }

                if (!response.ok) {
                    return new Response(`Vidmody Source Error: ${response.status}`, { 
                        status: response.status, 
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'text/plain'
                        }
                    });
                }

                let content = await response.text();
                
                const buildProxyUrl = (wUrl, tUrl, ref) => {
                    const params = new URLSearchParams({ url: tUrl, mode: 'proxy' });
                    if (ref) params.set('referer', ref);
                    return `${wUrl}?${params.toString()}`;
                };

                const rewritten = rewriteMasterManifest(content, finalTarget, workerUrl, referer, buildProxyUrl);

                return new Response(rewritten, {
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/vnd.apple.mpegurl'
                    }
                });
            } catch (error) {
                return new Response(`Vidmody Master Manifest Error: ${error.message}`, { 
                    status: 502, 
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'text/plain'
                    }
                });
            }
        }

        // --- 2. M3U Search Mode ---
        if (mode === 'search' && searchTitle) {
            const m3uUrl = await findInM3U(searchTitle, searchSeason, searchEpisode);
            return new Response(JSON.stringify({ 
                success: !!m3uUrl, 
                url: m3uUrl,
                title: searchTitle,
                season: searchSeason,
                episode: searchEpisode
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // --- 3. Master Playlist Generator (Adaptive Streaming) ---
        if (mode === 'master') {
            const sourcesParam = url.searchParams.get('sources');
            const subtitleUrl = url.searchParams.get('subtitleUrl');
            if (!sourcesParam) return new Response('Sources required', { status: 400 });
            try {
                const sources = JSON.parse(sourcesParam);
                const workerUrl = `${url.origin}${url.pathname}`;
                let masterM3u8 = '#EXTM3U\n#EXT-X-VERSION:3\n';
                
                const bestSource = sources[0];
                const audioTrUrl = bestSource.url.replace(/index-v1-a[0-9]+/, 'index-a1');
                const audioEnUrl = bestSource.url.replace(/index-v1-a[0-9]+/, 'index-a2');
                const proxyAudioTr = `${workerUrl}?url=${encodeURIComponent(audioTrUrl)}&mode=proxy`;
                const proxyAudioEn = `${workerUrl}?url=${encodeURIComponent(audioEnUrl)}&mode=proxy`;

                const defaultAudio = url.searchParams.get('defaultAudio') || 'a1';
                const isTrDefault = defaultAudio === 'a1' ? 'YES' : 'NO';
                const isEnDefault = defaultAudio === 'a2' ? 'YES' : 'NO';

                masterM3u8 += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="stereo",LANGUAGE="tr",NAME="Türkçe Dublaj",AUTOSELECT=${isTrDefault},DEFAULT=${isTrDefault},URI="${proxyAudioTr}"\n`;
                masterM3u8 += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="stereo",LANGUAGE="en",NAME="Orijinal Ses",AUTOSELECT=${isEnDefault},DEFAULT=${isEnDefault},URI="${proxyAudioEn}"\n`;
                let subtitleAttr = '';
                if (subtitleUrl) {
                    const proxySubtitle = `${workerUrl}?url=${encodeURIComponent(subtitleUrl)}&mode=proxy`;
                    masterM3u8 += `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="tr",NAME="Türkçe",AUTOSELECT=YES,DEFAULT=YES,URI="${proxySubtitle}"\n`;
                    subtitleAttr = ',SUBTITLES="subs"';
                }

                sources.forEach(source => {
                    const proxyVideo = `${workerUrl}?url=${encodeURIComponent(source.url)}&mode=proxy`;
                    let bandwidth = 5000000;
                    let resolution = "1920x1080";
                    if (source.quality.includes('720')) { bandwidth = 2500000; resolution = "1280x720"; }
                    else if (source.quality.includes('480')) { bandwidth = 1000000; resolution = "854x480"; }
                    else if (source.quality.includes('360')) { bandwidth = 500000; resolution = "640x360"; }
                    else if (source.quality.includes('main') && !source.quality.includes('1080')) { bandwidth = 3000000; resolution = "1280x720"; }
                    masterM3u8 += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},AUDIO="stereo"${subtitleAttr}\n${proxyVideo}\n`;
                });
                
                // Safety: strip leading whitespace (iOS native HLS requires tags at column 0)
                masterM3u8 = masterM3u8.split('\n').map(l => l.trimStart()).join('\n');
                
                return new Response(masterM3u8, {
                    headers: {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (e) {
                return new Response('Error generating master playlist', { status: 500 });
            }
        }

        // --- 4. Universal Proxy Logic ---
        if (!targetUrl) return new Response('Missing URL', { status: 400 });
        
        const userAgent = request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

        const customReferer = url.searchParams.get('referer');
        const refererHeader = customReferer || 'https://vidmody.com/';
        let originHeader = 'https://vidmody.com';
        try {
            if (customReferer) {
                originHeader = new URL(customReferer).origin;
            }
        } catch (e) {}

        // Strategy 1: Standard Request with Referer
        let response = await fetch(targetUrl, {
            method: request.method,
            headers: {
                'Referer': refererHeader,
                'Origin': originHeader,
                'User-Agent': userAgent
            }
        });

        // Strategy 2: Retry without Referer (if 403 Forbidden)
        if (response.status === 403 || response.status === 401) {
            response = await fetch(targetUrl, {
                method: request.method,
                headers: { 'User-Agent': userAgent }
            });
        }

        // Strategy 3: Try fallback URL if provided and primary failed
        if (!response.ok && fallbackUrl) {
            console.log('Primary failed, trying fallback:', fallbackUrl);
            response = await fetch(fallbackUrl, {
                method: request.method,
                headers: { 'User-Agent': userAgent }
            });
        }

        // Strategy 4: Auto-search M3U if title/season/episode provided and still failing
        if (!response.ok && searchTitle) {
            const m3uUrl = await findInM3U(searchTitle, searchSeason, searchEpisode);
            if (m3uUrl) {
                console.log('Using M3U fallback:', m3uUrl);
                response = await fetch(m3uUrl, {
                    method: request.method,
                    headers: { 'User-Agent': userAgent }
                });
            }
        }

        // Prepare Response
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.delete('Content-Encoding');
        newHeaders.delete('Content-Length');

        const contentType = newHeaders.get('Content-Type') || '';
        const isPlaylist = targetUrl.includes('.m3u8') || targetUrl.includes('/vs/') || targetUrl.includes('/mm/') || targetUrl.includes('.gif') || contentType.includes('mpegurl');

        if (isPlaylist) {
            let content = await response.text();
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            const workerUrl = `${url.origin}${url.pathname}`;

            content = content.replace(/(^(http|https):\/\/[^\s]+|^(?!#)[^\r\n]+)/gm, (match) => {
                if (match.startsWith('#')) return match;
                let absoluteUrl = match;
                if (!match.startsWith('http')) {
                    absoluteUrl = baseUrl + match;
                }
                return `${workerUrl}?url=${encodeURIComponent(absoluteUrl)}&mode=proxy`;
            });

            newHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
            return new Response(content, { status: response.status, headers: newHeaders });
        }

        if (!contentType.includes('video/') && !contentType.includes('audio/')) {
            newHeaders.set('Content-Type', 'video/mp2t');
        }

        return new Response(response.body, {
            status: response.status,
            headers: newHeaders
        });
    }
};
