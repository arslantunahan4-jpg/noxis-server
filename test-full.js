import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const testUrl = 'https://hdfilmcehennemi.mobi/video/embed/H4DhsqqDmAp/?rapidrame_id=6gp8soc4cee8';

(async () => {
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        let foundUrls = [];
        page.on('response', async (response) => {
            const url = response.url();
            const type = response.headers()['content-type'] || '';
            
            if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('playlist') ||
                url.includes('master') || url.includes('manifest') || url.includes('.ts') ||
                type.includes('video') || type.includes('mpegurl') || type.includes('octet-stream')) {
                console.log('🎯 VIDEO:', url);
                foundUrls.push({url, type});
            }
        });

        await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Tüm HTML'i al
        const html = await page.content();
        
        // Script tag'lerini ve değişkenleri bul
        const analysis = await page.evaluate(() => {
            const result = {
                innerHTML: document.body.innerHTML.substring(0, 3000),
                scripts: [],
                iframes: Array.from(document.querySelectorAll('iframe')).map(f => f.src),
                objects: Array.from(document.querySelectorAll('object')).map(o => o.data)
            };
            
            // Tüm script içeriklerini al
            document.querySelectorAll('script').forEach((s, i) => {
                if (s.textContent) {
                    result.scripts.push({
                        index: i,
                        content: s.textContent.substring(0, 2000)
                    });
                }
            });
            
            return result;
        });
        
        console.log('📝 Body HTML (ilk 3000 karakter):');
        console.log(analysis.innerHTML);
        
        console.log('\n📜 Script içerikleri:');
        analysis.scripts.forEach(s => {
            console.log(`\n--- Script ${s.index} ---`);
            console.log(s.content);
        });
        
        console.log('\n🖼️  Iframe src:', analysis.iframes);
        console.log('📦 Object data:', analysis.objects);
        
        // 20 saniye daha bekle
        await new Promise(r => setTimeout(r, 20000));
        
        console.log('\n📊 SONUÇLAR:');
        console.log('Toplam bulunan video URL:', foundUrls.length);
        
    } catch (e) {
        console.error('❌ HATA:', e.message);
    } finally {
        if (browser) await browser.close();
    }
})();
