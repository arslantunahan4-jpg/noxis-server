const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// --- UptimeRobot İçin Ping Noktası ---
app.get('/', (req, res) => {
    res.send('Sunucu aktif. UptimeRobot buraya ping atabilir.');
});

// --- 1. SCRAPER (Link Bulucu - Puppeteer) ---
app.get('/scrape', async (req, res) => {
    const { slug, s, e } = req.query;
    
    if (!slug) return res.status(400).json({ error: 'Slug gerekli' });

    console.log(`[Scrape] Başlatılıyor: ${slug} S:${s} E:${e}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
    });

    try {
        const page = await browser.newPage();
        
        // Cloudflare'i geçmek için gerçek kullanıcı taklidi
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // URL Oluşturma
        let targetUrl = `https://www.hdfilmizle.life/${slug}-izle/`;
        if (s && e) {
            targetUrl = `https://www.hdfilmizle.life/dizi/${slug}/sezon-${s}/bolum-${e}/`;
        }

        // Hızlandırma: Resim, Font ve CSS yükleme
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log(`[Scrape] Gidiliyor: ${targetUrl}`);
        
        // Siteye git ve Cloudflare kontrolü bitene kadar bekle (Timeout 60sn)
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Sayfa başlığını kontrol et (Cloudflare'de takıldı mı?)
        const title = await page.title();
        console.log(`[Scrape] Sayfa Başlığı: ${title}`);

        // Iframe'i ara
        const iframeSrc = await page.evaluate(() => {
            // 1. Iframe elementlerini tara
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                const src = iframe.src || iframe.getAttribute('data-src');
                if (src && (src.includes('vidrame') || src.includes('vidframe') || src.includes('player'))) {
                    return src;
                }
            }
            // 2. Script içindeki değişkenleri tara (Yedek)
            try {
                if (window.parts && window.parts.length > 0) {
                     const match = window.parts[0].match(/vidrame\.pro[^\s"'<>\]\\]*/i);
                     if (match) return 'https://' + match[0].replace(/\\+/g, '');
                }
            } catch(e) {}
            return null;
        });

        if (iframeSrc) {
            let cleanUrl = iframeSrc.startsWith('//') ? 'https:' + iframeSrc : iframeSrc;
            console.log(`[Scrape] Bulundu: ${cleanUrl}`);
            res.json({ success: true, url: cleanUrl });
        } else {
            console.log(`[Scrape] Bulunamadı.`);
            // Hata ayıklama için HTML'in bir kısmını loglayabilirsin
            // const content = await page.content();
            // console.log(content.substring(0, 500));
            res.status(404).json({ success: false, error: 'Iframe bulunamadı (Cloudflare engeli olabilir)' });
        }

    } catch (error) {
        console.error('[Scrape Error]', error.message);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await browser.close();
    }
});

// --- 2. PROXY (Video ve Kaynakları Oynatıcı) ---
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL gerekli');

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    // Kendi sunucumuzun adresi (Recursive linkleme için)
    const myProxyUrl = `${protocol}://${host}/proxy?url=`;

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'Referer': 'https://www.hdfilmizle.life/',
                'Origin': 'https://www.hdfilmizle.life',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            responseType: 'arraybuffer',
            validateStatus: () => true
        });

        const contentType = response.headers['content-type'] || '';

        // HTML, JS veya M3U8 ise içindeki linkleri bizim proxy'ye yönlendir
        if (contentType.includes('text') || contentType.includes('javascript') || contentType.includes('mpegurl') || contentType.includes('json')) {
            let content = response.data.toString('utf-8');
            const targetOrigin = new URL(targetUrl).origin;

            const wrapUrl = (url) => {
                if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
                let fullUrl = url;
                if (url.startsWith('//')) fullUrl = 'https:' + url;
                else if (url.startsWith('/')) fullUrl = targetOrigin + url;
                else if (!url.startsWith('http')) fullUrl = targetOrigin + '/' + url;
                
                return myProxyUrl + encodeURIComponent(fullUrl);
            };

            // Regex ile linkleri değiştir
            content = content.replace(/(src=["'])(.*?)(["'])/g, (m, q1, u, q2) => q1 + wrapUrl(u) + q2);
            content = content.replace(/(href=["'])(.*?)(["'])/g, (m, q1, u, q2) => q1 + wrapUrl(u) + q2);
            content = content.replace(/url\((.*?)\)/g, (m, u) => `url(${wrapUrl(u.replace(/['"]/g, ''))})`);
            
            // M3U8 TS dosyaları için
            if (contentType.includes('mpegurl')) {
                content = content.replace(/^(?!#)(.*\.ts)$/gm, (m) => wrapUrl(m.trim()));
            }

            res.set('Content-Type', contentType);
            res.send(content);
        } else {
            // Resim, video parçası vb. ise direkt gönder
            res.set('Content-Type', contentType);
            res.send(response.data);
        }

    } catch (error) {
        // Hata olsa bile boş dönmeyelim, player çökmesin
        res.status(500).send(error.message);
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
