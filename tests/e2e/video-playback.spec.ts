import { test, expect } from '@playwright/test';

test('app loads successfully', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Noxis/i);
});

test('home page displays content', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const body = await page.locator('body');
  await expect(body).toBeVisible();
});

test('network requests use correct proxy configuration', async ({ page }) => {
  const workerRequests: string[] = [];
  const directRequests: string[] = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('arslab.workers.dev')) {
      workerRequests.push(url);
    }
    if (url.includes('diziyou.one') || url.includes('dystream.com')) {
      directRequests.push(url);
    }
  });
  
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  expect(Array.isArray(workerRequests)).toBe(true);
  expect(Array.isArray(directRequests)).toBe(true);
});

test('can play a video', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Try to click "Play" on Hero Carousel first (it loads faster)
  // If not found, fall back to first poster card
  const heroPlayBtn = page.locator('.hero-button').first();
  const posterCard = page.locator('.poster-card').first();

  // Wait for either to be visible
  await Promise.race([
    heroPlayBtn.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {}),
    posterCard.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
  ]);

  if (await heroPlayBtn.isVisible()) {
    console.log('Clicking Hero Play Button');
    await heroPlayBtn.click();
  } else if (await posterCard.isVisible()) {
    console.log('Clicking Poster Card');
    await posterCard.click();
    
    // If clicked poster, we need to click play in modal
    const modalPlayBtn = page.locator('.detail-play-btn');
    await modalPlayBtn.waitFor({ state: 'visible', timeout: 10000 });
    await modalPlayBtn.click();
  } else {
    throw new Error('No playable content found on Home Page');
  }

  // Wait for the video player container
  // GlassPlayer usually renders a video element
  const video = page.locator('video');
  await video.waitFor({ state: 'visible', timeout: 30000 });

  // Wait for video to start playing (readyState >= 3 means HAVE_FUTURE_DATA)
  // or check if currentTime advances
  await page.waitForTimeout(5000); // Give it some time to buffer and start

  const isPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);
  const currentTime = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  const readyState = await video.evaluate((v: HTMLVideoElement) => v.readyState);

  console.log(`Video State: Paused=${isPaused}, CurrentTime=${currentTime}, ReadyState=${readyState}`);

  // Assertions
  expect(currentTime).toBeGreaterThan(0);
  expect(isPaused).toBe(false);
});
