const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges',
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DEFAULT_REFERER = 'https://vidmody.com/';
const DIZIYOU_REFERER = 'https://www.diziyou.one/';

const getMode = (url) => (url.searchParams.get('mode') || '').toLowerCase();

const isMasterRequest = (url) => {
  const mode = getMode(url);
  if (mode) return mode === 'master';

  const pathname = url.pathname.toLowerCase();
  return pathname.endsWith('/master') || pathname.endsWith('/master.m3u8');
};

const isProxyRequest = (url) => {
  const mode = getMode(url);
  if (mode) return mode === 'proxy';

  const pathname = url.pathname.toLowerCase();
  return pathname.endsWith('/proxy') || pathname.endsWith('/proxy.m3u8');
};

const isDiziyouResolveRequest = (url) => {
  const mode = getMode(url);
  if (mode) return mode === 'diziyou-resolve';

  const pathname = url.pathname.toLowerCase();
  return pathname.endsWith('/diziyou-resolve');
};

const getWorkerBaseUrl = (url) => {
  const normalizedPath = url.pathname.replace(/\/(?:master(?:\.m3u8)?|proxy(?:\.m3u8)?|diziyou-resolve)$/i, '') || '/';
  return `${url.origin}${normalizedPath}`;
};

const buildProxyUrl = (workerUrl, targetUrl, referer) => {
  const proxyParams = new URLSearchParams({
    url: targetUrl,
    mode: 'proxy'
  });

  if (referer) {
    proxyParams.set('referer', referer);
  }

  return `${workerUrl}?${proxyParams.toString()}`;
};

const isPlaylistResponse = (targetUrl, contentType) => {
  const lowerUrl = targetUrl.toLowerCase();
  const lowerType = (contentType || '').toLowerCase();
  const isLikelySegment = /\.(ts|m4s|mp4|aac|jpg|jpeg|png|webp|vtt|srt)(\?|$)/i.test(targetUrl);

  if (isLikelySegment) return false;

  return (
    lowerUrl.includes('.m3u8') ||
    lowerUrl.includes('/vs/') ||
    lowerUrl.includes('/mm/') ||
    lowerUrl.includes('index-v1') ||
    lowerUrl.includes('index-a1') ||
    lowerUrl.includes('index-a2') ||
    lowerUrl.includes('index.gif') ||
    lowerType.includes('mpegurl') ||
    lowerType.includes('application/x-mpegurl')
  );
};

const isSubtitleAsset = (targetUrl, contentType) => {
  const lowerUrl = targetUrl.toLowerCase();
  const lowerType = (contentType || '').toLowerCase();
  return (
    /\.(vtt|srt)(\?|$)/i.test(targetUrl) ||
    lowerType.includes('text/vtt') ||
    lowerType.includes('application/vtt') ||
    lowerType.includes('application/x-subrip') ||
    lowerType.includes('text/plain')
  );
};

const isMediaSegment = (targetUrl) => /\.(ts|m4s|jpg|jpeg|png|webp)(\?|$)/i.test(targetUrl);

const getOriginFromReferer = (referer) => {
  try {
    return new URL(referer).origin;
  } catch {
    return 'https://vidmody.com';
  }
};

const createUpstreamHeaders = (request, referer, includeOrigin = true) => {
  const headers = new Headers();
  const range = request.headers.get('Range');

  headers.set('User-Agent', request.headers.get('User-Agent') || USER_AGENT);
  if (range) headers.set('Range', range);

  if (referer) {
    headers.set('Referer', referer);
    if (includeOrigin) {
      headers.set('Origin', getOriginFromReferer(referer));
    }
  }

  return headers;
};

const fetchWithFallback = async (targetUrl, request, referer) => {
  let response = await fetch(targetUrl, {
    method: request.method,
    headers: createUpstreamHeaders(request, referer, true)
  });

  if (response.status === 401 || response.status === 403) {
    response = await fetch(targetUrl, {
      method: request.method,
      headers: createUpstreamHeaders(request, referer, false)
    });
  }

  return response;
};

const findFirstPlaylistAsset = (playlistText, playlistUrl) => {
  const lines = playlistText.split(/\r?\n/);
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

const isValidStatus = (status) => status === 200 || status === 206;

const probeAsset = async (assetUrl, referer) => {
  const headers = createUpstreamHeaders(new Request(assetUrl), referer, true);

  try {
    const headResponse = await fetch(assetUrl, {
      method: 'HEAD',
      headers
    });
    if (isValidStatus(headResponse.status)) return true;
  } catch {}

  try {
    const getHeaders = new Headers(headers);
    getHeaders.set('Range', 'bytes=0-0');
    const response = await fetch(assetUrl, {
      method: 'GET',
      headers: getHeaders
    });
    return isValidStatus(response.status);
  } catch {
    return false;
  }
};

const validateSubtitleTrack = async (subtitleUrl, referer) => {
  if (!subtitleUrl) return false;

  try {
    const response = await fetch(subtitleUrl, {
      method: 'GET',
      headers: createUpstreamHeaders(new Request(subtitleUrl), referer, true)
    });

    if (!response.ok) return false;

    const contentType = response.headers.get('Content-Type') || '';
    const text = await response.text();

    if (text.trim().startsWith('WEBVTT')) {
      return true;
    }

    if (!isPlaylistResponse(subtitleUrl, contentType) || !text.includes('#EXTM3U')) {
      return false;
    }

    const firstAsset = findFirstPlaylistAsset(text, subtitleUrl);
    if (!firstAsset) return false;

    return probeAsset(firstAsset, referer);
  } catch {
    return false;
  }
};

const parseAudios = (audiosParam) => {
  if (!audiosParam) return [];

  try {
    const parsed = JSON.parse(audiosParam);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const rewriteMasterManifest = (content, targetUrl, workerUrl, referer) => {
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

  const rewrittenLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      rewrittenLines.push(line);
      continue;
    }

    // 1. Rewrite AUDIO tracks (if any)
    if (trimmed.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
      const rewritten = line.replace(/URI="([^"]+)"/, (match, uri) => {
        const absUri = resolveUrl(uri);
        const proxyUri = buildProxyUrl(workerUrl, absUri, referer);
        return `URI="${proxyUri}"`;
      });
      rewrittenLines.push(rewritten);
      continue;
    }

    // 2. Rewrite SUBTITLES tracks
    if (trimmed.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES')) {
      const rewritten = line.replace(/URI="([^"]+)"/, (match, uri) => {
        const absUri = resolveUrl(uri);
        const proxyUri = buildProxyUrl(workerUrl, absUri, referer);
        return `URI="${proxyUri}"`;
      });
      rewrittenLines.push(rewritten);
      continue;
    }

    // 3. Rewrite variant streams
    if (trimmed.startsWith('#EXT-X-STREAM-INF:')) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && !nextLine.startsWith('#')) {
        const absUri = resolveUrl(nextLine);
        
        // Check if this is a Vidmody stream with index-v1-a1
        if (absUri.includes('index-v1-a1')) {
          // Generate DUAL audio variants
          const trUrl = absUri;
          const enUrl = absUri.replace('index-v1-a1', 'index-v1-a2');
          
          const proxyTr = buildProxyUrl(workerUrl, trUrl, referer);
          const proxyEn = buildProxyUrl(workerUrl, enUrl, referer);
          
          // Add Türkçe Dublaj variant
          let trStreamInf = line;
          if (!trStreamInf.includes('NAME=')) {
            trStreamInf = trStreamInf.replace('#EXT-X-STREAM-INF:', '#EXT-X-STREAM-INF:NAME="Türkçe Dublaj",');
          }
          rewrittenLines.push(trStreamInf);
          rewrittenLines.push(proxyTr);
          
          // Add Orijinal Ses variant
          let enStreamInf = line;
          if (enStreamInf.includes('NAME=')) {
            enStreamInf = enStreamInf.replace(/NAME="[^"]+"/, 'NAME="Orijinal Ses (İngilizce)"');
          } else {
            enStreamInf = enStreamInf.replace('#EXT-X-STREAM-INF:', '#EXT-X-STREAM-INF:NAME="Orijinal Ses (İngilizce)",');
          }
          rewrittenLines.push('');
          rewrittenLines.push(enStreamInf);
          rewrittenLines.push(proxyEn);
        } else {
          // Standard rewrite for single variant
          const proxyUri = buildProxyUrl(workerUrl, absUri, referer);
          rewrittenLines.push(line);
          rewrittenLines.push(proxyUri);
        }
        
        i++; // skip next line since we processed it
        continue;
      }
    }

    rewrittenLines.push(line);
  }

  return rewrittenLines.join('\n');
};

const createDiziyouSlug = (text = '') => String(text)
  .toLowerCase()
  .replace(/&/g, '-')
  .replace(/\+/g, '-')
  .replace(/\//g, '-')
  .replace(/\\/g, '-')
  .replace(/\|/g, '-')
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const findDiziyouPlayerUrl = (html, episodeUrl) => {
  const iframeMatch = html.match(/iframe[^>]+src=["']((?:https:\/\/(?:play\.diziyou\.one|www\.diziyou\.one)\/player\/[^"']+)|(?:\/?player\/[^"']+))["']/i);
  if (iframeMatch?.[1]) {
    return new URL(iframeMatch[1], episodeUrl).href;
  }

  const loosePlayerMatch = html.match(/((?:https:\/\/(?:play\.diziyou\.one|www\.diziyou\.one))?\/player\/\d+\.html[^"'\\s<]*)/i);
  if (loosePlayerMatch?.[1]) {
    return new URL(loosePlayerMatch[1], episodeUrl).href;
  }

  return null;
};

const resolveDiziyouSource = async ({ request, workerUrl, title, season, episode, originalTitle }) => {
  const titlesToTry = [title];
  if (originalTitle && originalTitle !== title) {
    titlesToTry.push(originalTitle);
  }

  for (const currentTitle of titlesToTry) {
    try {
      const slug = createDiziyouSlug(currentTitle);
      const episodeUrl = `https://www.diziyou.one/${slug}-${season}-sezon-${episode}-bolum/`;
      const episodeResponse = await fetchWithFallback(episodeUrl, request, DIZIYOU_REFERER);

      if (!episodeResponse.ok) {
        continue;
      }

      const html = await episodeResponse.text();
      const playerUrl = findDiziyouPlayerUrl(html, episodeUrl);
      if (!playerUrl) {
        continue;
      }

      const videoIdMatch = playerUrl.match(/player\/(\d+)\.html/i);
      if (!videoIdMatch) {
        continue;
      }

      const videoId = videoIdMatch[1];
      let originalUrl = `https://storage.diziyou.one/episodes/${videoId}/play.m3u8`;
      const dubUrl = `https://storage.diziyou.one/episodes/${videoId}_tr/play.m3u8`;
      let subtitles = [];
      let hasOriginal = false;

      try {
        const playerResponse = await fetchWithFallback(playerUrl, request, episodeUrl);
        if (playerResponse.ok) {
          const playerHtml = await playerResponse.text();
          const sourceMatch = playerHtml.match(/<source[^>]+src=["'](https:\/\/storage\.diziyou\.one\/episodes\/[^"']+\.m3u8)["']/i);
          if (sourceMatch?.[1]) {
            originalUrl = sourceMatch[1];
            hasOriginal = true;
          }

          const subtitleMatches = [...playerHtml.matchAll(/<track[^>]+src=["'](https:\/\/storage\.diziyou\.one\/subtitles\/[^"']+\.vtt)["'][^>]+srclang=["']([^"']+)["'][^>]+label=["']([^"']+)["']/gi)];
          subtitles = subtitleMatches.map(([, subtitleUrl, lang, label]) => ({
            lang,
            label,
            url: subtitleUrl
          }));
        }
      } catch {}

      if (!hasOriginal) {
        hasOriginal = await probeAsset(originalUrl, DIZIYOU_REFERER);
      }

      const hasDub = await probeAsset(dubUrl, DIZIYOU_REFERER);
      if (!hasOriginal && !hasDub) {
        continue;
      }

      if (subtitles.length === 0) {
        subtitles = [
          { lang: 'tr', label: 'Turkce', url: `https://storage.diziyou.one/subtitles/${videoId}/tr.vtt` },
          { lang: 'en', label: 'English', url: `https://storage.diziyou.one/subtitles/${videoId}/en.vtt` }
        ];
      }

      return {
        success: true,
        original: hasOriginal ? buildProxyUrl(workerUrl, originalUrl, DIZIYOU_REFERER) : null,
        turkish_dub: hasDub ? buildProxyUrl(workerUrl, dubUrl, DIZIYOU_REFERER) : null,
        hasOriginal,
        hasDub,
        subtitles: subtitles.map((subtitle) => ({
          ...subtitle,
          url: buildProxyUrl(workerUrl, subtitle.url, DIZIYOU_REFERER)
        })),
        resolvedBy: 'worker'
      };
    } catch {}
  }

  return {
    success: false,
    error: 'No player found on Diziyou after trying all title variations',
    resolvedBy: 'worker'
  };
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const params = url.searchParams;
    const workerUrl = getWorkerBaseUrl(url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // --- 1. Vidmody Master Manifest Parser (/vs/tt123456 or mode=vs) ---
    const isVsRequest = url.pathname.toLowerCase().startsWith('/vs/') || 
                        params.get('mode') === 'vs' || 
                        params.get('mode') === 'vidmody' || 
                        (params.get('url') && params.get('url').toLowerCase().includes('/vs/'));

    if (isVsRequest) {
      let targetUrl = params.get('url');
      if (!targetUrl) {
        targetUrl = `https://vidmody.com${url.pathname}${url.search}`;
      }
      
      const referer = params.get('referer') || DEFAULT_REFERER;

      try {
        const response = await fetchWithFallback(targetUrl, request, referer);
        if (!response.ok) {
          return new Response(`Vidmody Source Error: ${response.status}`, { 
            status: response.status, 
            headers: corsHeaders 
          });
        }

        let content = await response.text();

        // Parse and rewrite all relative paths inside the master manifest
        const rewritten = rewriteMasterManifest(content, targetUrl, workerUrl, referer);

        return new Response(rewritten, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/vnd.apple.mpegurl'
          }
        });
      } catch (error) {
        return new Response(`Vidmody Master Manifest Error: ${error.message}`, { 
          status: 502, 
          headers: corsHeaders 
        });
      }
    }

    if (isDiziyouResolveRequest(url)) {
      const title = params.get('title');
      const season = params.get('season');
      const episode = params.get('episode');
      const originalTitle = params.get('originalTitle');

      if (!title || !season || !episode) {
        return new Response(JSON.stringify({ success: false, error: 'Missing parameters' }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      }

      const payload = await resolveDiziyouSource({
        request,
        workerUrl,
        title,
        season,
        episode,
        originalTitle
      });

      return new Response(JSON.stringify(payload), {
        status: payload.success ? 200 : 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    }

    if (isMasterRequest(url)) {
      const sourcesParam = params.get('sources');
      const subtitleUrl = params.get('subtitleUrl');
      const referer = params.get('referer') || DEFAULT_REFERER;
      const audioSwitchStrategy = params.get('audioSwitchStrategy') || 'hls-track';

      if (!sourcesParam) {
        return new Response('Sources required', { status: 400, headers: corsHeaders });
      }

      try {
        const sources = JSON.parse(sourcesParam);
        const audios = parseAudios(params.get('audios'));
        const defaultAudio = params.get('defaultAudio') || 'a1';
        const exposeAudioTracks = audioSwitchStrategy === 'hls-track';
        let masterM3u8 = '#EXTM3U\n#EXT-X-VERSION:3\n';
        let resolvedAudios = audios;

        if (resolvedAudios.length === 0 && exposeAudioTracks && sources.length > 0) {
          const bestSource = sources[0];
          resolvedAudios = [
            {
              trackId: 'a1',
              lang: 'tr',
              name: 'Turkce Dublaj',
              url: bestSource.url.replace(/index-v1-a[0-9]+/, 'index-a1')
            },
            {
              trackId: 'a2',
              lang: 'en',
              name: 'Original Audio',
              url: bestSource.url.replace(/index-v1-a[0-9]+/, 'index-a2')
            }
          ];
        }

        if (exposeAudioTracks && resolvedAudios.length > 0) {
          masterM3u8 += '\n# Audio Groups\n';
          resolvedAudios.forEach((audio, index) => {
            const trackId = audio.trackId || `a${index + 1}`;
            const isDefault = trackId === defaultAudio ? 'YES' : 'NO';
            const proxyAudio = buildProxyUrl(workerUrl, audio.url, referer);
            const lang = audio.lang || (index === 0 ? 'tr' : 'en');
            const name = audio.name || (index === 0 ? 'Turkce Dublaj' : 'Original Audio');
            masterM3u8 += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="stereo",LANGUAGE="${lang}",NAME="${name}",AUTOSELECT=${isDefault},DEFAULT=${isDefault},URI="${proxyAudio}"\n`;
          });
        }

        let subtitleAttr = '';
        if (subtitleUrl && await validateSubtitleTrack(subtitleUrl, referer)) {
          const proxySubtitle = buildProxyUrl(workerUrl, subtitleUrl, referer);
          masterM3u8 += '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="tr",NAME="Turkce",AUTOSELECT=YES,DEFAULT=NO,URI="' + proxySubtitle + '"\n';
          subtitleAttr = ',SUBTITLES="subs"';
        }

        sources.forEach((source) => {
          const proxyVideo = buildProxyUrl(workerUrl, source.url, referer);
          let bandwidth = 5000000;
          let resolution = '1920x1080';

          if ((source.quality || '').includes('720')) {
            bandwidth = 2500000;
            resolution = '1280x720';
          } else if ((source.quality || '').includes('480')) {
            bandwidth = 1000000;
            resolution = '854x480';
          } else if ((source.quality || '').includes('360')) {
            bandwidth = 500000;
            resolution = '640x360';
          } else if ((source.quality || '').includes('main') && !(source.quality || '').includes('1080')) {
            bandwidth = 3000000;
            resolution = '1280x720';
          }

          masterM3u8 += '\n';
          masterM3u8 += `#Variant: ${source.quality || 'main'}\n`;
          masterM3u8 += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}${exposeAudioTracks && resolvedAudios.length > 0 ? ',AUDIO="stereo"' : ''}${subtitleAttr}\n`;
          masterM3u8 += `${proxyVideo}\n`;
        });

        return new Response(masterM3u8, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/vnd.apple.mpegurl'
          }
        });
      } catch (error) {
        return new Response(`Error generating master playlist: ${error.message}`, {
          status: 500,
          headers: corsHeaders
        });
      }
    }

    if (isProxyRequest(url)) {
      const targetUrl = params.get('url');
      const referer = params.get('referer') || DEFAULT_REFERER;

      if (!targetUrl) {
        return new Response('URL required', { status: 400, headers: corsHeaders });
      }

      try {
        const response = await fetchWithFallback(targetUrl, request, referer);
        const newHeaders = new Headers(response.headers);
        const contentType = newHeaders.get('Content-Type') || '';

        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });

        newHeaders.delete('Content-Encoding');
        newHeaders.delete('Content-Length');

        if (isPlaylistResponse(targetUrl, contentType)) {
          let content = await response.text();
          const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

          content = content.replace(/(^(http|https):\/\/[^\s]+|^(?!#)[^\r\n]+)/gm, (match) => {
            if (match.startsWith('#')) return match;

            const absoluteUrl = match.startsWith('http')
              ? match
              : new URL(match, baseUrl).href;

            return buildProxyUrl(workerUrl, absoluteUrl, referer);
          });

          newHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
          return new Response(content, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
          });
        }

        if (isSubtitleAsset(targetUrl, contentType)) {
          newHeaders.set('Content-Type', 'text/vtt; charset=utf-8');
        } else if (isMediaSegment(targetUrl) && !contentType.toLowerCase().includes('video/') && !contentType.toLowerCase().includes('audio/')) {
          newHeaders.set('Content-Type', 'video/mp2t');
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } catch (error) {
        return new Response(`Proxy Error: ${error.message}`, {
          status: 502,
          headers: corsHeaders
        });
      }
    }

    return new Response('Noxis Worker Active. Use mode=master or mode=proxy.', {
      headers: corsHeaders
    });
  }
};
