import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
];

const getRandomAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const humanSleep = (min, max) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

const testUrl = 'https://www.hdfilmcehennemi.nl/dizi/a-knight-of-the-seven-kingdoms/sezon-1/bolum-1/';

(async () => {
    console.log('🔍 Test URL:', testUrl);
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(getRandomAgent());
        await page.setViewport({ width: 1920, height: 1080 });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        // Ağ trafiğini dinle
        let foundUrls = [];
        page.on('response', async (response) => {
            const url = response.url();
            const type = response.headers()['content-type'] || '';
            
            if (url.includes('.m3u8') || url.includes('.mp4') || 
                (url.includes('/hls/') && url.includes('.txt')) || 
                url.includes('cdnimages') ||
                type.includes('application/vnd.apple.mpegurl') ||
                type.includes('video/mp4')) {
                
                const isAd = url.includes('google') || url.includes('doubleclick') || url.includes('ads');
                if (!isAd) {
                    console.log('🎯 VIDEO URL BULUNDU:', url);
                    foundUrls.push({url, type});
                }
            }
        });

        console.log('📄 Sayfa yükleniyor...');
        await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        await humanSleep(2000, 4000);
        
        // Sayfa yapısını incele
        const pageInfo = await page.evaluate(() => {
            const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
                src: f.src || f.dataset.src,
                class: f.className
            }));
            
            const players = Array.from(document.querySelectorAll('video, .player, [class*="player"], [id*="player"]')).map(p => ({
                tag: p.tagName,
                class: p.className,
                id: p.id
            }));
            
            return { iframes, players, title: document.title };
        });
        
        console.log('📋 Sayfa Bilgisi:', JSON.stringify(pageInfo, null, 2));
        
        // Player'a tıkla
        await page.mouse.move(Math.random() * 500, Math.random() * 500);
        
        const frames = page.frames();
        console.log(`🖼️  ${frames.length} iframe bulundu`);
        
        for (const frame of frames) {
            try {
                await frame.evaluate(() => {
                    const buttons = document.querySelectorAll('.play, .vjs-big-play-button, button[title="Play"], video, [class*="play"]');
                    console.log('Frame içinde bulunan butonlar:', buttons.length);
                    buttons.forEach(b => b.click());
                });
            } catch (e) {}
        }
        
        // Ana sayfada da dene
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('.play, .vjs-big-play-button, button[title="Play"], video, [class*="play"], [class*="btn"]');
            buttons.forEach(b => b.click());
        });

        console.log('⏳ 15 saniye bekleniyor (video yüklenmesi için)...');
        await new Promise(r => setTimeout(r, 15000));
        
        console.log('\n📊 SONUÇLAR:');
        console.log('Bulunan video URL sayısı:', foundUrls.length);
        foundUrls.forEach((u, i) => console.log(`  ${i+1}. ${u.url.substring(0, 100)}...`));
        
    } catch (e) {
        console.error('❌ HATA:', e.message);
    } finally {
        if (browser) await browser.close();
    }
})();
