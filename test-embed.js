import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// Slug'dan embed URL oluştur
const embedUrl = 'https://hdfilmcehennemi.mobi/video/embed/H4DhsqqDmAp/?rapidrame_id=6gp8soc4cee8';

(async () => {
    console.log('🔗 Embed URL Test:', embedUrl);
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        let foundUrls = [];
        page.on('response', async (response) => {
            const url = response.url();
            const type = response.headers()['content-type'] || '';
            
            // Tüm potansiyel video URL'lerini kaydet
            if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('.txt') ||
                url.includes('cdn') || url.includes('video') ||
                type.includes('video') || type.includes('mpegurl') || type.includes('stream')) {
                console.log('🎯 BULUNDU:', url);
                console.log('   Type:', type);
                foundUrls.push({url, type});
            }
        });

        await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('📄 Sayfa yüklendi');
        
        // Sayfa HTML'ini al
        const html = await page.content();
        console.log('📝 HTML uzunluğu:', html.length);
        
        // Video elementlerini kontrol et
        const videoInfo = await page.evaluate(() => {
            const videos = document.querySelectorAll('video, source');
            const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent);
            return {
                videoCount: videos.length,
                videoSrcs: Array.from(videos).map(v => v.src || v.dataset.src),
                scriptCount: scripts.length
            };
        });
        console.log('📹 Video bilgisi:', videoInfo);
        
        // Script'lerde video URL'si ara
        const scriptContent = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const text = script.textContent;
                if (text && (text.includes('.m3u8') || text.includes('.mp4') || text.includes('src'))) {
                    return text.substring(0, 500);
                }
            }
            return null;
        });
        
        if (scriptContent) {
            console.log('📝 İlgili script bulundu:', scriptContent);
        }
        
        // Play butonuna tıkla
        await page.evaluate(() => {
            const selectors = ['video', '.play', '.vjs-big-play-button', '[class*="play"]', '.start', '.player', '.plyr'];
            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    console.log('Tıklanıyor:', sel);
                    el.click();
                });
            });
        });
        
        await new Promise(r => setTimeout(r, 10000));
        
        console.log('\n📊 SONUÇLAR:');
        console.log('Toplam bulunan URL:', foundUrls.length);
        foundUrls.forEach((u, i) => console.log(`  ${i+1}. ${u.url}`));
        
    } catch (e) {
        console.error('❌ HATA:', e.message);
    } finally {
        if (browser) await browser.close();
    }
})();
