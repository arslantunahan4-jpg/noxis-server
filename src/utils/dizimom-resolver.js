
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/**
 * Resolves Dizimom video sources using a headless browser to handle decryption.
 */
export async function resolveDizimom(embedUrl, episodeUrl) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 'Referer': 'https://www.dizimom.fit/' });

        let resolvedSource = null;

        // Exposed function to capture the decrypted data from bePlayer
        await page.exposeFunction('captureSource', (data) => {
            if (data && data.video_location) {
                resolvedSource = data.video_location;
            }
        });

        // Inject script to intercept bePlayer call
        await page.evaluateOnNewDocument(() => {
            const originalBePlayer = window.bePlayer;
            window.bePlayer = function(key, data, auto) {
                // The actual decryption logic is inside bePlayer or called by it
                // We wait for it to be defined or we wrap it
                console.log('bePlayer called');
                // We'll let the original run, but we want the result
                return originalBePlayer.apply(this, arguments);
            };
            
            // Better yet, intercept the JWPlayer setup which happens AFTER decryption
            window.jwplayer = function(id) {
                return {
                    setup: function(config) {
                        if (config && config.sources && config.sources[0]) {
                            window.captureSource({ video_location: config.sources[0].file });
                        }
                        return { on: () => {} };
                    },
                    key: ""
                };
            };
        });

        await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 15000 });

        // Wait a bit for decryption and setup to occur
        for (let i = 0; i < 10; i++) {
            if (resolvedSource) break;
            await new Promise(r => setTimeout(r, 500));
        }

        return resolvedSource;

    } catch (error) {
        console.error('[DizimomResolver] Error:', error.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}
