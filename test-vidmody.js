import axios from 'axios';

const imdbId = 'tt1375666'; // Inception
const season = null;
const episode = null;

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://vidmody.com/'
};

const parseM3U8Manifest = (content, baseUrl) => {
    const result = {
        videos: [],
        audios: [],
        subtitles: []
    };

    const lines = content.split('\n');
    
    const resolveUrl = (url) => {
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        const base = baseUrl.replace(/\/[^\/]*$/, '');
        return url.startsWith('/') ? baseUrl.split('/').slice(0, 3).join('/') + url : base + '/' + url;
    };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES')) {
            const nameMatch = line.match(/NAME="([^"]+)"/);
            const langMatch = line.match(/LANGUAGE="([^"]+)"/);
            const uriMatch = line.match(/URI="([^"]+)"/);
            
            if (uriMatch) {
                result.subtitles.push({
                    name: nameMatch?.[1] || langMatch?.[1] || 'Unknown',
                    lang: langMatch?.[1] || 'und',
                    url: resolveUrl(uriMatch[1])
                });
            }
        }
        
        if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
            const nameMatch = line.match(/NAME="([^"]+)"/);
            const langMatch = line.match(/LANGUAGE="([^"]+)"/);
            const uriMatch = line.match(/URI="([^"]+)"/);
            
            if (uriMatch) {
                result.audios.push({
                    name: nameMatch?.[1] || langMatch?.[1] || 'Unknown',
                    lang: langMatch?.[1] || 'und',
                    url: resolveUrl(uriMatch[1])
                });
            }
        }
        
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
            const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            
            const nextLine = lines[i + 1]?.trim();
            if (nextLine && !nextLine.startsWith('#')) {
                result.videos.push({
                    bandwidth: parseInt(bandwidthMatch?.[1] || 0),
                    resolution: resolutionMatch?.[1] || 'unknown',
                    url: resolveUrl(nextLine)
                });
            }
        }
    }

    result.videos.sort((a, b) => b.bandwidth - a.bandwidth);
    
    return result;
};

async function testVidmody() {
    console.log(`Testing Vidmody for ${imdbId}...`);

    try {
        const manifestUrls = [];
        
        manifestUrls.push(`https://vidmody.com/vs/${imdbId}/`);
        
        if (season && episode) {
            const sStr = season.toString().padStart(2, '0');
            const eStr = episode.toString().padStart(2, '0');
            manifestUrls.push(`https://vidmody.com/vs/${imdbId}/${sStr}x${eStr}/`);
            manifestUrls.push(`https://vidmody.com/vs/${imdbId}/s${season}e${episode}/`);
            manifestUrls.push(`https://vidmody.com/vs/${imdbId}/S${sStr}E${eStr}/`);
        }

        let manifestContent = null;
        let manifestUrl = null;

        for (const url of manifestUrls) {
            console.log(`Checking manifest: ${url}`);
            try {
                const response = await axios.get(url, { 
                    headers, 
                    timeout: 8000,
                    validateStatus: (s) => s < 400
                });
                const text = response.data;
                if (text && (text.includes('#EXTM3U') || text.includes('#EXT-X-'))) {
                    manifestContent = text;
                    manifestUrl = url;
                    console.log('Manifest found!');
                    break;
                } else {
                    console.log('Manifest content invalid.');
                }
            } catch (e) {
                console.log(`Failed: ${e.message}`);
            }
        }

        if (manifestContent) {
            const parsed = parseM3U8Manifest(manifestContent, manifestUrl);
            console.log('Parsed Manifest:', JSON.stringify(parsed, null, 2));
            return;
        }

        console.log('No manifest found. Trying fallback URLs...');

        const qualityPatterns = [
            'main2', 'main1080dualcr', 'main1080encr', 'main_1080p', 'main_1080', 'main',
            'main720dualcr', 'main720encr', 'main_720p', 'main720',
            'main480dualcr', 'main480encr', 'main480', 'main_480p'
        ];

        const createVidmodyUrl = (quality, audioVer = 'a1') => {
            if (season && episode) {
                const eStr = episode.toString().padStart(2, '0');
                return `https://vidmody.com/mm/${imdbId}/s${season}/e${eStr}/${quality}/index-v1-${audioVer}.gif`;
            }
            return `https://vidmody.com/mm/${imdbId}/${quality}/index-v1-${audioVer}.gif`;
        };

        const validSources = [];
        
        const checkPromises = qualityPatterns.map(async (quality) => {
            try {
                const testUrl = createVidmodyUrl(quality, 'a1');
                console.log(`Checking fallback: ${testUrl}`);
                const response = await axios.head(testUrl, { 
                    headers, 
                    timeout: 5000,
                    validateStatus: (s) => s < 500
                });
                if (response.status === 200 || response.status === 206) {
                    return { quality, url: testUrl };
                }
            } catch (e) {
                // console.log(`Fallback failed for ${quality}: ${e.message}`);
            }
            return null;
        });

        const results = await Promise.all(checkPromises);
        results.forEach(r => { if (r) validSources.push(r); });

        console.log('Fallback results:', validSources);

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testVidmody();
