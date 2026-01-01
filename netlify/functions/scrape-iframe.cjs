const axios = require('axios');
const cheerio = require('cheerio');

// Helper for slugs
const createSlug = (text) => {
  if (!text) return "";
  const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ı': 'i', 'ö': 'o', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'İ': 'i', 'Ö': 'o' };
  return text.split('').map(char => trMap[char] || char).join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const params = event.queryStringParameters || {};
  const site = params.site;
  const slug = params.slug;
  const title = params.title || slug;
  const originalTitle = params.original || title;
  const season = params.s;
  const episode = params.e;

  // Enhanced headers for better anti-blocking with full browser fingerprint
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Pragma': 'no-cache'
  };

  console.log(`[Scraper] Request: site=${site}, title=${title}, slug=${slug}`);

  try {
    let iframeSrc = null;
    let moviePageUrl = null;

    if (site === 'yabancidizibox') {
      console.log(`[YabanciDiziBox] Searching for: "${title}"`);

      const isTvSeries = season && episode;
      const searchUrl = `https://yabancidizibox.com/?s=${encodeURIComponent(title)}`;

      try {
        const searchResponse = await axios.get(searchUrl, {
          headers: { ...headers, Referer: 'https://yabancidizibox.com/' },
          timeout: 10000
        });

        let contentUrl = null;
        if (searchResponse.status === 200) {
          const $ = cheerio.load(searchResponse.data);
          const results = [];
          $('.result-item, .poster, .movie, article').each((i, el) => {
            const $el = $(el);
            const link = $el.find('a').attr('href');
            const resultTitle = $el.text().toLowerCase();
            if (link) {
              results.push({ link, title: resultTitle });
            }
          });

          const normalizeTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedTitle = normalizeTitle(title);
          const bestMatch = results.find(r => normalizeTitle(r.title).includes(normalizedTitle));

          if (bestMatch) {
            contentUrl = bestMatch.link;
          }
        }

        if (!contentUrl) {
          const baseSlug = createSlug ? createSlug(originalTitle || title) : slug;
          if (isTvSeries) {
            contentUrl = `https://yabancidizibox.com/dizi/${baseSlug}`;
          } else {
            contentUrl = `https://yabancidizibox.com/film/${baseSlug}`;
          }
        }

        if (contentUrl && isTvSeries) {
          if (!contentUrl.includes('sezon-') && !contentUrl.includes('bolum-')) {
            const cleanUrl = contentUrl.endsWith('/') ? contentUrl.slice(0, -1) : contentUrl;
            contentUrl = `${cleanUrl}/sezon-${season}-bolum-${episode}`;
          }
        }

        console.log(`[YabanciDiziBox] Fetching content from: ${contentUrl}`);

        const contentResponse = await axios.get(contentUrl, {
          headers: { ...headers, Referer: 'https://yabancidizibox.com/' },
          timeout: 10000,
          validateStatus: (status) => status < 500
        });

        if (contentResponse.status === 200) {
          moviePageUrl = contentUrl;
          const html = contentResponse.data;
          const $ = cheerio.load(html);

          const normalizeUrl = (src) => {
            if (!src) return null;
            let url = src.trim();
            if (url.startsWith('//')) url = 'https:' + url;
            if (!url.startsWith('http')) return null;
            if (!url.includes('?')) url += '?ap=1';
            else if (!url.includes('ap=')) url += '&ap=1';
            return url;
          };

          $('iframe').each((i, el) => {
            if (iframeSrc) return;
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src && !src.includes('facebook') && !src.includes('google')) {
              iframeSrc = normalizeUrl(src);
              console.log(`[YabanciDiziBox] Found iframe: ${iframeSrc}`);
            }
          });

          if (!iframeSrc) {
            const vidmodyMatch = html.match(/https?:\/\/(?:player\.)?(?:vidmody\.com|vidmoly\.to)\/[a-zA-Z0-9_]+/);
            if (vidmodyMatch) {
              iframeSrc = normalizeUrl(vidmodyMatch[0]);
              console.log(`[YabanciDiziBox] Found vidmody url: ${iframeSrc}`);
            }

            if (!iframeSrc) {
              const match = html.match(/(?:source|src|file|video_url|url)["']?\s*:\s*["']([^"']+)["']/i);
              if (match && (match[1].includes('vidmody') || match[1].includes('vidmoly') || match[1].includes('embed'))) {
                iframeSrc = normalizeUrl(match[1]);
                console.log(`[YabanciDiziBox] Found source in script: ${iframeSrc}`);
              }
            }
          }
        }

      } catch (e) {
        console.log(`[YabanciDiziBox] Error: ${e.message}`);
      }

    } else if (site === 'filmizlejet') {
      // filmizlejet.com - Türkçe dublaj filmler
      console.log(`[Filmizlejet] Searching for: "${title}" (original: "${originalTitle}")`);

      const normalizeTitle = (t) => t.toLowerCase()
        .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[şŞ]/g, 's')
        .replace(/[üÜ]/g, 'u').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o')
        .replace(/[^a-z0-9]/g, '');

      const normalizeUrl = (src) => {
        if (!src) return null;
        let url = src.trim();
        if (url.startsWith('//')) url = 'https:' + url;
        if (!url.startsWith('http')) return null;
        return url;
      };

      // Helper function to search and get content URL
      const searchFilm = async (searchTerm) => {
        const searchSlug = encodeURIComponent(searchTerm.replace(/\s+/g, '+'));
        const searchUrl = `https://filmizlejet.com/arama/${searchSlug}/`;
        console.log(`[Filmizlejet] Searching: ${searchUrl}`);

        try {
          const searchResponse = await axios.get(searchUrl, {
            headers: { ...headers, Referer: 'https://filmizlejet.com/' },
            timeout: 15000,
            validateStatus: (status) => status < 500
          });

          if (searchResponse.status === 200) {
            const html = searchResponse.data;
            const $ = cheerio.load(html);

            // Find first movie link in results - multiple selector patterns
            let foundUrl = null;

            // Method 1: Common selectors
            $('article a, .movie-item a, .film-item a, .poster a, .movie a, .film a, .item a, .card a, .konu a').each((i, el) => {
              if (foundUrl) return;
              const href = $(el).attr('href');
              if (href && href.includes('filmizlejet.com') && !href.includes('/arama/') && !href.includes('/kategori/')) {
                foundUrl = href;
              }
            });

            // Method 2: All links containing filmizlejet
            if (!foundUrl) {
              $('a[href*="filmizlejet.com"]').each((i, el) => {
                if (foundUrl) return;
                const href = $(el).attr('href');
                if (href && !href.includes('/arama/') && !href.includes('/kategori/') && !href.includes('/sayfa/')) {
                  // Check if it looks like a movie page
                  const parts = href.split('/').filter(p => p);
                  if (parts.length >= 3) { // https://filmizlejet.com/movie-name/
                    foundUrl = href;
                  }
                }
              });
            }

            // Method 3: Regex fallback for movie URLs
            if (!foundUrl) {
              const urlMatches = html.match(/https?:\/\/filmizlejet\.com\/[a-z0-9-]+\//gi);
              if (urlMatches) {
                for (const url of urlMatches) {
                  if (!url.includes('/arama/') && !url.includes('/kategori/') && !url.includes('/sayfa/')) {
                    foundUrl = url;
                    break;
                  }
                }
              }
            }

            if (foundUrl) {
              console.log(`[Filmizlejet] Found movie URL: ${foundUrl}`);
            }

            return foundUrl;
          }
        } catch (e) {
          console.log(`[Filmizlejet] Search error: ${e.message}`);
        }
        return null;
      };

      try {
        // Try direct URL with Turkish title first
        const baseSlug = createSlug(title);
        const directUrl = `https://filmizlejet.com/${baseSlug}/`;

        console.log(`[Filmizlejet] Trying direct URL: ${directUrl}`);

        let contentUrl = null;
        const directResponse = await axios.get(directUrl, {
          headers: { ...headers, Referer: 'https://filmizlejet.com/' },
          timeout: 10000,
          validateStatus: (status) => status < 500
        });

        if (directResponse.status === 200 && directResponse.data.includes('player-frame')) {
          contentUrl = directUrl;
          console.log(`[Filmizlejet] Direct URL valid: ${contentUrl}`);
        }

        // If direct URL failed, try original title direct URL
        if (!contentUrl && originalTitle && originalTitle !== title) {
          const origSlug = createSlug(originalTitle);
          const origUrl = `https://filmizlejet.com/${origSlug}/`;
          console.log(`[Filmizlejet] Trying original title URL: ${origUrl}`);
          try {
            const origResponse = await axios.get(origUrl, {
              headers: { ...headers, Referer: 'https://filmizlejet.com/' },
              timeout: 10000,
              validateStatus: (status) => status < 500
            });
            if (origResponse.status === 200 && origResponse.data.includes('player-frame')) {
              contentUrl = origUrl;
              console.log(`[Filmizlejet] Original title URL valid: ${contentUrl}`);
            }
          } catch (e) { /* ignore */ }
        }

        // If still not found, try search with original title (English)
        if (!contentUrl && originalTitle) {
          contentUrl = await searchFilm(originalTitle);
          if (contentUrl) {
            console.log(`[Filmizlejet] Found via original title search: ${contentUrl}`);
          }
        }

        // Final fallback - search with Turkish title
        if (!contentUrl) {
          contentUrl = await searchFilm(title);
          if (contentUrl) {
            console.log(`[Filmizlejet] Found via Turkish title search: ${contentUrl}`);
          }
        }

        // Fetch content page and extract iframe
        if (contentUrl) {
          console.log(`[Filmizlejet] Fetching content page: ${contentUrl}`);

          const contentResponse = await axios.get(contentUrl, {
            headers: { ...headers, Referer: 'https://filmizlejet.com/' },
            timeout: 10000,
            validateStatus: (status) => status < 500
          });

          if (contentResponse.status === 200) {
            moviePageUrl = contentUrl;
            const html = contentResponse.data;
            const $ = cheerio.load(html);

            // Method 1: Find iframe in player-frame div
            $('.player-frame iframe, #player iframe, .video-player iframe, iframe').each((i, el) => {
              if (iframeSrc) return;
              const src = $(el).attr('src') || $(el).attr('data-src');
              if (src && (src.includes('epikplayer') || src.includes('player') || src.includes('embed'))) {
                iframeSrc = normalizeUrl(src);
                console.log(`[Filmizlejet] Found iframe: ${iframeSrc}`);
              }
            });

            // Method 2: Find player URL in script tags
            if (!iframeSrc) {
              const epikMatch = html.match(/https?:\/\/epikplayer\.xyz\/embed\/[a-zA-Z0-9_-]+/i);
              if (epikMatch) {
                iframeSrc = normalizeUrl(epikMatch[0]);
                console.log(`[Filmizlejet] Found epikplayer in script: ${iframeSrc}`);
              }
            }

            // Method 3: Any iframe with src containing player domains
            if (!iframeSrc) {
              $('iframe').each((i, el) => {
                if (iframeSrc) return;
                const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
                if (src && src.length > 10) {
                  const normalized = normalizeUrl(src);
                  if (normalized && (
                    normalized.includes('epikplayer') ||
                    normalized.includes('vidmoly') ||
                    normalized.includes('vidmody') ||
                    normalized.includes('player') ||
                    normalized.includes('rapid') ||
                    normalized.includes('embed')
                  )) {
                    iframeSrc = normalized;
                    console.log(`[Filmizlejet] Found iframe via generic scan: ${iframeSrc}`);
                  }
                }
              });
            }

            // Method 4: Find player URL in script tags or inline JS
            if (!iframeSrc) {
              const patterns = [
                /https?:\/\/epikplayer\.xyz\/embed\/[a-zA-Z0-9_-]+/gi,
                /https?:\/\/[^"'\s]+vidmoly[^"'\s]+/gi,
                /https?:\/\/[^"'\s]+vidmody[^"'\s]+/gi,
                /https?:\/\/[^"'\s]+rapidrame[^"'\s]+/gi,
                /https?:\/\/[^"'\s]+\/embed\/[a-zA-Z0-9_-]+/gi
              ];

              for (const pattern of patterns) {
                const matches = html.match(pattern);
                if (matches && matches.length > 0) {
                  iframeSrc = normalizeUrl(matches[0]);
                  console.log(`[Filmizlejet] Found via regex pattern: ${iframeSrc}`);
                  break;
                }
              }
            }

            // Method 5: Generic embed URL pattern (more relaxed)
            if (!iframeSrc) {
              const embedMatch = html.match(/["'](https?:\/\/[^"']+(?:embed|player|video|watch)[^"']*)['"]/i);
              if (embedMatch) {
                iframeSrc = normalizeUrl(embedMatch[1]);
                console.log(`[Filmizlejet] Found embed in pattern: ${iframeSrc}`);
              }
            }
          }
        }

      } catch (e) {
        console.log(`[Filmizlejet] Error: ${e.message}`);
      }

    } else if (site === 'hdfilmizle') {
      const isTvSeries = season && episode;

      console.log(`[HDFilmizle] Searching for: "${title}" (slug: ${slug})`);

      const normalizeTitle = (t) => t.toLowerCase()
        .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[şŞ]/g, 's')
        .replace(/[üÜ]/g, 'u').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o')
        .replace(/[^a-z0-9]/g, '');

      const searchWithQuery = async (query) => {
        const searchUrl = `https://www.hdfilmizle.life/?s=${encodeURIComponent(query)}`;
        console.log(`[HDFilmizle] Requesting Search URL: ${searchUrl}`);

        try {
          const searchResponse = await axios.get(searchUrl, {
            headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
            timeout: 15000,
            validateStatus: (status) => status < 500
          });

          // NOTE: hdfilmizle sometimes returns 404 for search results even if content exists (weird server config)
          // We process the body regardless of 404 if it looks like a page
          if (searchResponse.status === 200 || searchResponse.status === 404) {
            const html = searchResponse.data;
            const $ = cheerio.load(html);
            const results = [];

            $('article, .movie-item, .film-item, .poster, .movie, a[href*="hdfilmizle.life"]').each((i, el) => {
              const $el = $(el);
              let link = $el.find('a').first().attr('href') || $el.attr('href');
              let resultTitle = $el.find('.title, h2, h3, .movie-title, .film-title').first().text().trim()
                || $el.find('a').first().attr('title')
                || $el.find('img').first().attr('alt')
                || '';

              if (link && link.includes('hdfilmizle.life') && !link.includes('?s=') && resultTitle) {
                results.push({ link, title: resultTitle });
              }
            });

            console.log(`[HDFilmizle] Parsed ${results.length} results from search page (Status: ${searchResponse.status}).`);
            return results;
          } else {
            console.log(`[HDFilmizle] Search failed with status ${searchResponse.status}`);
          }
        } catch (e) {
          console.log(`[HDFilmizle] Search error for "${query}":`, e.message);
        }
        return [];
      };

      let allResults = [];
      const searchTerms = [title];
      if (originalTitle && originalTitle !== title) {
        searchTerms.push(originalTitle);
      }

      for (const term of searchTerms) {
        const results = await searchWithQuery(term);
        allResults = [...allResults, ...results];
        if (results.length > 0) break; // Stop if we found something
      }

      // Filter duplicates
      const uniqueResults = allResults.filter((r, i, arr) =>
        arr.findIndex(x => x.link === r.link) === i
      );

      // Find best match
      let contentUrl = null;
      if (uniqueResults.length > 0) {
        // Simple fuzzy match
        const normalizedTarget = normalizeTitle(title);
        const match = uniqueResults.find(r => normalizeTitle(r.title).includes(normalizedTarget));
        if (match) {
          contentUrl = match.link;
          console.log(`[HDFilmizle] Best match found: ${contentUrl}`);
        } else {
          contentUrl = uniqueResults[0].link;
          console.log(`[HDFilmizle] No exact match, using first result: ${contentUrl}`);
        }
      }

      // Fallback: Direct URL guess
      if (!contentUrl) {
        console.log(`[HDFilmizle] No search results. Trying direct URL guessing.`);
        const urlVariations = isTvSeries ? [
          `https://www.hdfilmizle.life/dizi/${slug}/`,
          `https://www.hdfilmizle.life/dizi/${slug}-izle/`
        ] : [
          `https://www.hdfilmizle.life/${slug}-izle-hd/`,
          `https://www.hdfilmizle.life/${slug}-izle/`,
          `https://www.hdfilmizle.life/${slug}/`
        ];

        for (const tryUrl of urlVariations) {
          try {
            console.log(`[HDFilmizle] Trying direct URL: ${tryUrl}`);
            const resp = await axios.get(tryUrl, {
              headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
              timeout: 5000,
              validateStatus: (status) => status < 500
            });
            // Accept 404 if it contains iframe/player content (as seen in some cases)
            if ((resp.status === 200 || resp.status === 404) && (resp.data.includes('iframe') || resp.data.includes('player') || resp.data.includes('parts'))) {
              contentUrl = tryUrl;
              console.log(`[HDFilmizle] Direct URL valid (Status ${resp.status}): ${contentUrl}`);
              break;
            }
          } catch (e) {
            // ignore
          }
        }
      }

      if (contentUrl) {
        // Handle TV Series Episodes
        if (isTvSeries) {
          // Try to construct episode URL from the series URL
          // Format usually: .../dizi/slug/sezon-X/bolum-Y/
          const baseSlug = contentUrl.replace('https://www.hdfilmizle.life/', '').replace('dizi/', '').replace(/\/$/, '');
          const episodeVariations = [
            `${contentUrl.replace(/\/$/, '')}/sezon-${season}/bolum-${episode}/`,
            `https://www.hdfilmizle.life/dizi/${baseSlug}/sezon-${season}/bolum-${episode}/`
          ];

          let episodeUrlFound = null;
          for (const epUrl of episodeVariations) {
            try {
              console.log(`[HDFilmizle] Checking episode URL: ${epUrl}`);
              const epResponse = await axios.get(epUrl, { // Changed HEAD to GET to check content
                headers: { ...headers, Referer: contentUrl },
                timeout: 5000,
                validateStatus: (status) => status < 500
              });
              if (epResponse.status === 200 || epResponse.status === 404) {
                // Double check content if 404
                if (epResponse.status === 404 && !epResponse.data.includes('player') && !epResponse.data.includes('iframe')) {
                  continue;
                }
                episodeUrlFound = epUrl;
                break;
              }
            } catch (e) { }
          }
          if (episodeUrlFound) contentUrl = episodeUrlFound;
          else console.log(`[HDFilmizle] Could not verify episode URL, using base: ${contentUrl}`);
        }

        console.log(`[HDFilmizle] Fetching movie page: ${contentUrl}`);

        try {
          const response = await axios.get(contentUrl, {
            headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
            timeout: 15000,
            validateStatus: (status) => status < 500
          });

          const html = response.data;
          moviePageUrl = contentUrl;

          const normalizeUrl = (src) => {
            if (!src) return null;
            let url = src.trim();
            if (url.startsWith('//')) url = 'https:' + url;
            if (!url.startsWith('http')) return null;
            if (!url.includes('?')) url += '?ap=1';
            else if (!url.includes('ap=')) url += '&ap=1';
            return url;
          };

          // Regex to find iframes/players
          const vidramaMatch = html.match(/https?:\/\/vidrame\.pro\/[^\s"'<>\]\\]+/i);
          if (vidramaMatch) {
            iframeSrc = normalizeUrl(vidramaMatch[0].replace(/\\+/g, ''));
            console.log(`[HDFilmizle] Found vidrame.pro: ${iframeSrc}`);
          }

          if (!iframeSrc) {
            const $ = cheerio.load(html);
            $('iframe').each((i, el) => {
              if (iframeSrc) return;
              const src = $(el).attr('data-src') || $(el).attr('src');
              if (src && (src.includes('vidrame') || src.includes('vidframe') || src.includes('player'))) {
                iframeSrc = normalizeUrl(src);
                console.log(`[HDFilmizle] Found iframe: ${iframeSrc}`);
              }
            });
          }

          if (!iframeSrc) {
            // Check for parts variable in scripts (common in this template)
            const partsMatch = html.match(/let\s+parts\s*=\s*(\[[\s\S]*?\]);/);
            if (partsMatch) {
              const partsContent = partsMatch[1];
              const vidrameSrcMatch = partsContent.match(/vidrame\.pro[^\s"'<>\]\\]*/i);
              if (vidrameSrcMatch) {
                iframeSrc = normalizeUrl('https://' + vidrameSrcMatch[0].replace(/\\+/g, ''));
                console.log(`[HDFilmizle] Found in parts: ${iframeSrc}`);
              }
            }
          }

        } catch (e) {
          console.log(`[HDFilmizle] Error fetching content page:`, e.message);
        }
      } else {
        console.log(`[HDFilmizle] Failed to find any content URL.`);
      }

    } else if (site === 'selcukflix') {
      // ... (selcukflix implementation kept as is or minimal if not used)
    }

    if (iframeSrc) {
      console.log(`[Scraper] Success! URL: ${iframeSrc}`);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, url: iframeSrc, moviePage: moviePageUrl })
      };
    } else {
      console.log(`[Scraper] No iframe found.`);
      return {
        statusCode: 404, // Keep 404 for client to know it failed
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Iframe bulunamadı', moviePage: moviePageUrl })
      };
    }
  } catch (error) {
    console.error(`[Scraper] Fatal Error:`, error.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
