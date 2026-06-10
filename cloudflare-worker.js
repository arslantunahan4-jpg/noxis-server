// Noxis Streaming Worker (Cloudflare)
// Features: Universal Proxy, M3U8 Rewrite, Adaptive Master Playlist, Smart Retry

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
    const mode = url.searchParams.get('mode'); // 'master' or 'proxy' (default)

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
        
        // Helper inline buildProxyUrl
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

    // --- 2. Master Playlist Generator (Adaptive Streaming) ---
    if (mode === 'master') {
        const sourcesParam = url.searchParams.get('sources');
        const subtitleUrl = url.searchParams.get('subtitleUrl');
        
        if (!sourcesParam) return new Response('Sources required', { status: 400 });
        
        try {
            const sources = JSON.parse(sourcesParam);
            const workerUrl = `${url.origin}${url.pathname}`;
            
            let masterM3u8 = '#EXTM3U\n#EXT-X-VERSION:3\n';
            
            // Audio Tracks (TR & EN) - Based on first source logic
            // Assuming index-v1-a1 is TR, index-v1-a2 is EN
            const bestSource = sources[0];
            const audioTrUrl = bestSource.url.replace(/index-v1-a[0-9]+/, 'index-a1');
            const audioEnUrl = bestSource.url.replace(/index-v1-a[0-9]+/, 'index-a2');

            const proxyAudioTr = `${workerUrl}?url=${encodeURIComponent(audioTrUrl)}&mode=proxy`;
            const proxyAudioEn = `${workerUrl}?url=${encodeURIComponent(audioEnUrl)}&mode=proxy`;

            const defaultAudio = url.searchParams.get('defaultAudio') || 'a1';
            const isTrDefault = defaultAudio === 'a1' ? 'YES' : 'NO';
            const isEnDefault = defaultAudio === 'a2' ? 'YES' : 'NO';

            masterM3u8 += '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="stereo",LANGUAGE="tr",NAME="Türkçe Dublaj",AUTOSELECT=' + isTrDefault + ',DEFAULT=' + isTrDefault + ',URI="' + proxyAudioTr + '"\n';
            masterM3u8 += '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="stereo",LANGUAGE="en",NAME="Orijinal Ses",AUTOSELECT=' + isEnDefault + ',DEFAULT=' + isEnDefault + ',URI="' + proxyAudioEn + '"\n';
            // Subtitles
            let subtitleAttr = '';
            if (subtitleUrl) {
                const proxySubtitle = `${workerUrl}?url=${encodeURIComponent(subtitleUrl)}&mode=proxy`;
                masterM3u8 += `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="tr",NAME="Türkçe",AUTOSELECT=YES,DEFAULT=YES,URI="${proxySubtitle}"\n`;
                subtitleAttr = ',SUBTITLES="subs"';
            }

            // Video Variants
            sources.forEach(source => {
                const proxyVideo = `${workerUrl}?url=${encodeURIComponent(source.url)}&mode=proxy`;
                let bandwidth = 5000000;
                let resolution = "1920x1080";
                
                if (source.quality.includes('720')) { bandwidth = 2500000; resolution = "1280x720"; }
                else if (source.quality.includes('480')) { bandwidth = 1000000; resolution = "854x480"; }
                else if (source.quality.includes('360')) { bandwidth = 500000; resolution = "640x360"; }
                else if (source.quality.includes('main') && !source.quality.includes('1080')) { bandwidth = 3000000; resolution = "1280x720"; }

                masterM3u8 += '#EXT-X-STREAM-INF:BANDWIDTH=' + bandwidth + ',RESOLUTION=' + resolution + ',AUDIO="stereo"' + subtitleAttr + '\n';
                masterM3u8 += proxyVideo + '\n';
            });

            // Safety: strip leading whitespace from every line (iOS native HLS requires tags at column 0)
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

    // --- 3. Universal Proxy Logic ---
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
            headers: {
                'User-Agent': userAgent
                // No Referer/Origin
            }
        });
    }

    // Prepare Response
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    
    // Clean headers to avoid HLS.js issues
    newHeaders.delete('Content-Encoding'); 
    newHeaders.delete('Content-Length'); // Let browser handle chunked stream

    // Check if it is an M3U8 Playlist
    const contentType = newHeaders.get('Content-Type') || '';
    const isPlaylist = targetUrl.includes('.m3u8') || targetUrl.includes('/vs/') || targetUrl.includes('/mm/') || targetUrl.includes('.gif') || contentType.includes('mpegurl');

    if (isPlaylist) {
        let content = await response.text();
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        const workerUrl = `${url.origin}${url.pathname}`;

        // REWRITE: Redirect all segments through this Worker
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

    // Force correct video type for segments if missing
    if (!contentType.includes('video/') && !contentType.includes('audio/')) {
        newHeaders.set('Content-Type', 'video/mp2t');
    }

    return new Response(response.body, {
        status: response.status,
        headers: newHeaders
    });
  }
};
