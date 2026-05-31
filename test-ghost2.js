import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
];

const testUrl = 'https://www.hdfilmcehennemi.nl/dizi/a-knight-of-the-seven-kingdoms/sezon-1/bolum-1/';

(async () => {
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });

        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENTS[0]);
        await page.setViewport({ width: 1920, height: 1080 });

        let foundUrls = [];
        page.on('response', async (response) => {
            const url = response.url();
            const type = response.headers()['content-type'] || '';
            
            if (url.includes('.m3u8') || url.includes('.mp4') || 
                url.includes('.txt') && url.includes('hls') ||
                type.includes('video') || type.includes('mpegurl')) {
                console.log('🎯 BULUNDU:', url.substring(0, 80));
                foundUrls.push(url);
            }
        });

        // Ana sayfaya git
        await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));
        
        // IFRAME'e tıkla
        const iframeElement = await page.$('iframe');
        if (iframeElement) {
            console.log('🖼️  Iframe bulundu, tıklanıyor...');
            
            // iframe'in src'ini al
            const iframeSrc = await iframeElement.evaluate(el => el.src);
            console.log('🔗 Iframe src:', iframeSrc);
            
            // Yeni sekme aç ve iframe src'sine git
            const newPage = await browser.newPage();
            await newPage.setUserAgent(USER_AGENTS[0]);
            
            newPage.on('response', async (response) => {
                const url = response.url();
                const type = response.headers()['content-type'] || '';
                if (url.includes('.m3u8') || url.includes('.mp4') || 
                    (url.includes('/hls/') && url.includes('.txt')) ||
                    url.includes('cdnimages') ||
                    type.includes('video') || type.includes('mpegurl')) {
                    console.log('🎯 IFRAME İÇİNDEN BULUNDU:', url);
                    foundUrls.push(url);
                }
            });
            
            await newPage.goto(iframeSrc, { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(r => setTimeout(r, 5000));
            
            // Embed sayfasında play butonuna tıkla
            await newPage.evaluate(() => {
                const selectors = ['.play', '.vjs-big-play-button', 'video', '[class*="play"]', '.start', '.player'];
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        console.log('Tıklanıyor:', sel);
                        el.click();
                    });
                });
            });
            
            await new Promise(r => setTimeout(r, 10000));
        }
        
        console.log('\n📊 SONUÇLAR:');
        console.log('Toplam bulunan URL:', foundUrls.length);
        foundUrls.forEach((u, i) => console.log(`  ${i+1}. ${u}`));
        
    } catch (e) {
        console.error('❌ HATA:', e.message);
    } finally {
        if (browser) await browser.close();
    }
})();
