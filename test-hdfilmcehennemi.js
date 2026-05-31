import { ghostScrape } from './src/services/ghostScraper.js';

async function test() {
    console.log("Test başlıyor...");
    const targetUrl = "https://www.hdfilmcehennemi.nl/dizi/a-knight-of-the-seven-kingdoms/sezon-1/bolum-1/";
    
    console.log(`Hedef URL: ${targetUrl}`);
    
    const result = await ghostScrape(targetUrl);
    
    if (result) {
        console.log("✅ BAŞARILI! Video URL'si bulundu:");
        console.log(result);
    } else {
        console.log("❌ BAŞARISIZ! Video URL'si bulunamadı.");
    }
}

test();
