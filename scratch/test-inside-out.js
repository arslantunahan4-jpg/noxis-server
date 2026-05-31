import axios from 'axios';

const imdbId = 'tt22022452'; // Ters Yüz 2 (Inside Out 2)
const season = null;
const episode = null;

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://vidmody.com/'
};

async function testVidmody() {
    console.log(`Testing Vidmody for Inside Out 2 (${imdbId})...`);

    const manifestUrls = [];
    manifestUrls.push(`https://vidmody.com/vs/${imdbId}/`);

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
                console.log('Manifest found! Length:', text.length);
                console.log(text.slice(0, 500));
                return;
            } else {
                console.log('Manifest content invalid. Length:', text?.length || 0);
                if (text) console.log(String(text).slice(0, 300));
            }
        } catch (e) {
            console.log(`Failed: ${e.message}`);
            if (e.response) {
                console.log(`Status: ${e.response.status}`);
                console.log(`Data:`, String(e.response.data).slice(0, 300));
            }
        }
    }

    console.log('No manifest found under /vs/, checking /mm/ fallbacks...');

    const qualityPatterns = [
        'main2', 'main1080dualcr', 'main1080encr', 'main_1080p', 'main_1080', 'main',
        'main720dualcr', 'main720encr', 'main_720p', 'main720',
        'main480dualcr', 'main480encr', 'main480', 'main_480p'
    ];

    const createVidmodyUrl = (quality, audioVer = 'a1') => {
        return `https://vidmody.com/mm/${imdbId}/${quality}/index-v1-${audioVer}.gif`;
    };

    const validSources = [];
    for (const quality of qualityPatterns) {
        try {
            const testUrl = createVidmodyUrl(quality, 'a1');
            console.log(`Checking fallback: ${testUrl}`);
            const response = await axios.head(testUrl, { 
                headers, 
                timeout: 5000,
                validateStatus: (s) => s < 500
            });
            console.log(`Status for ${quality}:`, response.status);
            if (response.status === 200 || response.status === 206) {
                validSources.push({ quality, url: testUrl });
            }
        } catch (e) {
            console.log(`Fallback check failed for ${quality}: ${e.message}`);
        }
    }

    console.log('Fallback results:', validSources);
}

testVidmody();
