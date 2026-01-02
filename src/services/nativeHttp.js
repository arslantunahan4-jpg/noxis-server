import { Capacitor, CapacitorHttp } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

export const nativeGet = async (url, options = {}) => {
  const headers = { ...defaultHeaders, ...options.headers };

  if (isNative) {
    try {
      console.log(`[NativeHttp] GET: ${url}`);
      const response = await CapacitorHttp.get({
        url,
        headers,
        connectTimeout: options.timeout || 15000,
        readTimeout: options.timeout || 15000
      });
      console.log(`[NativeHttp] Response status: ${response.status}`);
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data,
        text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        json: async () => typeof response.data === 'string' ? JSON.parse(response.data) : response.data
      };
    } catch (error) {
      console.error('[NativeHttp] Error:', error);
      return { ok: false, status: 0, error: error.message };
    }
  } else {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined
      });
      return {
        ok: response.ok,
        status: response.status,
        data: null,
        text: () => response.text(),
        json: () => response.json()
      };
    } catch (error) {
      console.error('[NativeHttp] Fetch Error:', error);
      return { ok: false, status: 0, error: error.message };
    }
  }
};

export const scrapeHdfilmizle = async (title, year, isSeries = false, season = null, episode = null) => {
  console.log(`[NativeHttp] Scraping: ${title} (${year})`);
  
  const createSlug = (text) => {
    if (!text) return "";
    const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ı': 'i', 'ö': 'o', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'İ': 'i', 'Ö': 'o' };
    return text.split('').map(char => trMap[char] || char).join('')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const slug = createSlug(title);
  const baseUrl = 'https://www.hdfilmizle.life';
  
  const searchForMovie = async (query) => {
    const searchUrl = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log(`[NativeHttp] Searching: ${searchUrl}`);
    
    const response = await nativeGet(searchUrl, {
      headers: { 
        Referer: baseUrl + '/',
        Origin: baseUrl
      },
      timeout: 10000
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const urlMatches = html.match(/href="(https?:\/\/www\.hdfilmizle\.life\/[^"]+izle[^"]*)/gi);
    
    if (urlMatches) {
      for (const match of urlMatches) {
        const url = match.replace('href="', '');
        if (url.includes(slug) || url.toLowerCase().includes(slug.replace(/-/g, ''))) {
          return url;
        }
      }
      return urlMatches[0]?.replace('href="', '');
    }
    return null;
  };

  const extractIframe = (html) => {
    const patterns = [
      /https?:\/\/vidrame\.pro\/[^\s"'<>\]\\]+/gi,
      /https?:\/\/vidframe\.pro\/[^\s"'<>\]\\]+/gi,
      /https?:\/\/[^"'\s<>]+(?:rapid|vidmoly|closeload|fastload|hdplayer|videoseyred|supervideo|vidsrc|streamtape|mixdrop)[^"'\s<>]*/gi,
      /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi,
      /data-src=["']([^"']+)["']/gi,
      /data-player=["']([^"']+)["']/gi,
      /player["']?\s*[:=]\s*["']([^"']+)["']/gi
    ];

    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          let url = match;
          if (match.includes('src=')) {
            const srcMatch = match.match(/src=["']([^"']+)["']/);
            if (srcMatch) url = srcMatch[1];
          } else if (match.includes('data-')) {
            const dataMatch = match.match(/=["']([^"']+)["']/);
            if (dataMatch) url = dataMatch[1];
          } else if (match.includes(':') && !match.startsWith('http')) {
            const colonMatch = match.match(/["']([^"']+)["']/);
            if (colonMatch) url = colonMatch[1];
          }
          
          url = url.replace(/\\+/g, '').trim();
          if (url.startsWith('http') && (url.includes('vidrame') || url.includes('vidframe') || url.includes('rapid'))) {
            if (!url.includes('ap=')) url += (url.includes('?') ? '&' : '?') + 'ap=1';
            return url;
          }
        }
      }
    }
    return null;
  };

  try {
    let moviePageUrl = null;
    
    const directUrls = isSeries
      ? [
          `${baseUrl}/${slug}-${season}-sezon-${episode}-bolum-izle/`,
          `${baseUrl}/${slug}-sezon-${season}-bolum-${episode}-izle/`,
          `${baseUrl}/${slug}-izle/`
        ]
      : [
          `${baseUrl}/${slug}-izle-hd/`,
          `${baseUrl}/${slug}-izle/`,
          `${baseUrl}/${slug}-${year}-izle/`,
          `${baseUrl}/${slug}-filmi-izle/`
        ];

    for (const url of directUrls) {
      console.log(`[NativeHttp] Trying: ${url}`);
      const response = await nativeGet(url, {
        headers: { 
          Referer: baseUrl + '/',
          Origin: baseUrl
        },
        timeout: 8000
      });
      
      if (response.ok) {
        const html = await response.text();
        const iframe = extractIframe(html);
        if (iframe) {
          console.log(`[NativeHttp] ✅ Found iframe: ${iframe}`);
          return { success: true, iframeUrl: iframe, moviePage: url };
        }
        moviePageUrl = url;
      }
    }

    const searchQueries = [title, `${title} ${year}`, slug.replace(/-/g, ' ')];
    for (const query of searchQueries) {
      const foundUrl = await searchForMovie(query);
      if (foundUrl && foundUrl !== moviePageUrl) {
        console.log(`[NativeHttp] Found via search: ${foundUrl}`);
        const response = await nativeGet(foundUrl, {
          headers: { 
            Referer: baseUrl + '/',
            Origin: baseUrl
          },
          timeout: 8000
        });
        
        if (response.ok) {
          const html = await response.text();
          const iframe = extractIframe(html);
          if (iframe) {
            console.log(`[NativeHttp] ✅ Found iframe: ${iframe}`);
            return { success: true, iframeUrl: iframe, moviePage: foundUrl };
          }
        }
      }
    }

    console.log(`[NativeHttp] ❌ No iframe found for: ${title}`);
    return { success: false, error: 'Iframe bulunamadı', moviePage: moviePageUrl };
    
  } catch (error) {
    console.error(`[NativeHttp] Error:`, error);
    return { success: false, error: error.message };
  }
};

export const isNativePlatform = () => isNative;
