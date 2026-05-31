const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('Navigating to app...');
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Wait for content to load
  await new Promise(r => setTimeout(r, 4000));
  
  // Take screenshot of homepage
  await page.screenshot({ path: '/tmp/noxis-home.png', fullPage: false });
  console.log('Homepage screenshot saved: /tmp/noxis-home.png');
  
  // Add tv-mode class to body for TV mode testing
  await page.evaluate(() => {
    document.body.classList.add('tv-mode');
  });
  
  // Find first focusable card and focus it
  const focused = await page.evaluate(() => {
    const card = document.querySelector('.poster-card.focusable');
    if (card) {
      card.focus();
      card.scrollIntoView({ behavior: 'instant', block: 'center' });
      return true;
    }
    return false;
  });
  
  console.log('Card focused:', focused);
  await new Promise(r => setTimeout(r, 1000));
  
  // Take screenshot with focused card in TV mode
  await page.screenshot({ path: '/tmp/noxis-tv-focus.png', fullPage: false });
  console.log('TV mode focus screenshot saved: /tmp/noxis-tv-focus.png');
  
  await browser.close();
  console.log('Done!');
})();
