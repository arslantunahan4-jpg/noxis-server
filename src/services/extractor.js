import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const BLOCKED_RESOURCES = [
    'image', 'font', 'stylesheet', 
    'googleads', 'doubleclick', 'analytics', 'facebook', 'twitter'
];

export const extractVideoLink = async (targetUrl) => {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });

        const page = await browser.newPage();

        // 1. Optimize: Block Ads & Heavy Resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const url = req.url();
            
            if (BLOCKED_RESOURCES.some(r => resourceType === r || url.includes(r))) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // 2. Set User Agent (Stealth)
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        let foundVideo = null;
        
        const videoPromise = new Promise((resolve) => {
            page.on('response', async (response) => {
                const url = response.url();
                const headers = response.headers();
                const contentType = headers['content-type'] || '';

                if (
                    url.includes('.m3u8') || url.includes('.mp4') || 
                    (url.includes('.gif') && url.includes('vidmody')) || 
                    
                    contentType.includes('video/') ||
                    contentType.includes('application/x-mpegURL') ||
                    contentType.includes('application/vnd.apple.mpegurl')
                ) {
                    if (!foundVideo) {
                        console.log(`[Extractor] Catch: ${url} (${contentType})`);
                        foundVideo = url;
                        resolve(url);
                    }
                }
            });
        });

        // 4. Navigate to Page
        console.log(`[Extractor] Navigating to: ${targetUrl}`);
        
        page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
        
        const interactionPromise = async () => {
            try {
                await new Promise(r => setTimeout(r, 5000));
                
                await page.mouse.move(100, 100);
                await page.mouse.move(200, 200);
                
                const frames = page.frames();
                console.log(`[Extractor] Found ${frames.length} frames`);

                for (const frame of frames) {
                    try {
                        await frame.evaluate(() => {
                            const selectors = [
                                '.play', '.vjs-big-play-button', 'button[aria-label="Play"]', 
                                '.jw-display-icon-container', 'video', 'iframe'
                            ];
                            selectors.forEach(sel => {
                                const el = document.querySelector(sel);
                                if (el) el.click();
                            });
                        });
                    } catch (e) {}
                }
            } catch (e) {
                console.log('[Extractor] Interaction error (minor):', e.message);
            }
        };

        interactionPromise();

        const result = await Promise.race([
            videoPromise,
            new Promise(r => setTimeout(r, 25000, null)) 
        ]);

        if (result) {
            console.log(`[Extractor] Video Found: ${result}`);
            return result;
        }

        return null;

    } catch (e) {
        console.error('[Extractor] Error:', e.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
};
