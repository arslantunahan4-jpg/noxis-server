import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// Gerçekçi User-Agent Havuzu
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
];

const getRandomAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// İnsan gibi bekleme fonksiyonu
const humanSleep = (min, max) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

export const ghostScrape = async (targetUrl) => {
    let browser = null;
    try {
        console.log(`👻 [Ghost] Sızıyor: ${targetUrl}`);

        browser = await puppeteer.launch({
            headless: 'new', // Debug için false yapıp izleyebiliriz
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled', // Bot uyarısını kaldır
                '--window-size=1920,1080'
            ]
        });

        const page = await browser.newPage();
        
        // 1. Kimlik Gizleme
        await page.setUserAgent(getRandomAgent());
        await page.setViewport({ width: 1920, height: 1080 });

        // WebDriver özelliğini sil (En önemli bot tespiti)
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        // 2. Video Ağı Dinleme (Sniffer)
        let foundVideo = null;
        const videoPromise = new Promise((resolve) => {
            page.on('response', async (response) => {
                const url = response.url();
                const type = response.headers()['content-type'] || '';

                if (
                    url.includes('.m3u8') || url.includes('.mp4') ||
                    (url.includes('/hls/') && url.includes('.txt')) || 
                    url.includes('cdnimages') || 
                    (url.includes('.gif') && url.includes('vidmody')) ||
                    type.includes('application/vnd.apple.mpegurl') ||
                    type.includes('video/mp4')
                ) {
                    // Filter ads (basic check)
                    const isAd = url.includes('google') || url.includes('doubleclick') || url.includes('ads');
                    
                    if (!foundVideo && !isAd) {
                        console.log(`🔥 [Ghost] Yakaladı: ${url}`);
                        foundVideo = url;
                        resolve(url);
                    }
                }
            });
        });

        // 3. Sayfaya Git (İnsan gibi)
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // 4. İnsan Davranışları (Human Behavior Simulation)
        
        // Biraz bekle (Site yüklensin)
        await humanSleep(2000, 4000);

        // Mouse'u rastgele hareket ettir (Eğrisel hareket zor ama basitçe)
        await page.mouse.move(Math.random() * 500, Math.random() * 500);
        await humanSleep(500, 1000);
        
        // Biraz aşağı kaydır (Scroll)
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight / 2);
        });
        await humanSleep(1000, 2000);

        // 5. Player'ı Bul ve Tıkla
        // Tüm iframe'leri tarayıp "Play" butonlarına tıkla
        const frames = page.frames();
        for (const frame of frames) {
            try {
                // Yaygın player butonları
                await frame.evaluate(() => {
                    const buttons = document.querySelectorAll('.play, .vjs-big-play-button, button[title="Play"], video');
                    buttons.forEach(b => b.click());
                });
            } catch (e) {}
        }

        // Videonun ağa düşmesini bekle
        const result = await Promise.race([
            videoPromise,
            new Promise(r => setTimeout(r, 15000, null)) // Max 15sn bekle
        ]);

        return result;

    } catch (e) {
        console.error(`❌ [Ghost] Hata: ${e.message}`);
        return null;
    } finally {
        if (browser) await browser.close();
    }
};
