/**
 * Extracts a dominant, vibrant color from an image URL using HTML5 Canvas.
 * Filters out extremely dark, light, or unsaturated pixels to find a rich hue.
 * Falls back to general average if no vibrant pixels are found.
 * 
 * Uses bulletproof Fetch-to-Blob technique to completely bypass browser CORS caching bugs
 * and prevent "Tainted Canvas" security errors in all modern browsers.
 * 
 * Includes an in-memory cache to prevent redundant loading.
 */
import { getApiBaseUrl } from './apiBaseUrl';

const colorCache = new Map();

export const getDominantColor = async (imageUrl) => {
    if (!imageUrl) {
        return [10, 10, 12]; // Default dark theme color
    }

    if (colorCache.has(imageUrl)) {
        return colorCache.get(imageUrl);
    }

    try {
        // Construct the proxy URL to go through our backend image-proxy
        const apiBase = getApiBaseUrl();
        const proxyUrl = `${apiBase}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
        
        // Fetch image through the backend proxy which has perfect CORS headers and caching
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        
        return new Promise((resolve) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(blob);
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve([10, 10, 12]);
                        URL.revokeObjectURL(objectUrl);
                        return;
                    }

                    // 30x30 is extremely fast to draw/parse and automatically averages local colors
                    const width = 30;
                    const height = 30;
                    canvas.width = width;
                    canvas.height = height;

                    ctx.drawImage(img, 0, 0, width, height);

                    // Since it is loaded from a local blob URL, getImageData is 100% safe from CORS issues
                    const imgData = ctx.getImageData(0, 0, width, height);
                    const data = imgData.data;
                    
                    let vibrantR = 0, vibrantG = 0, vibrantB = 0;
                    let vibrantCount = 0;
                    let avgR = 0, avgG = 0, avgB = 0;
                    let avgCount = 0;

                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const a = data[i + 3];

                        // Ignore highly transparent pixels
                        if (a < 200) continue;

                        // Calculate brightness (ITU-R BT.601)
                        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                        
                        // Saturation
                        const max = Math.max(r, g, b);
                        const min = Math.min(r, g, b);
                        const saturation = max === 0 ? 0 : (max - min) / max;

                        // General average calculations (excluding black/white margins)
                        if (brightness > 15 && brightness < 240) {
                            avgR += r;
                            avgG += g;
                            avgB += b;
                            avgCount++;
                        }

                        // Vibrant pixel filter:
                        // 1. Not too dark (brightness > 45) to ensure it brings color atmosphere
                        // 2. Not too bright (brightness < 185) so text remains fully legible on top
                        // 3. Clear hue (saturation > 0.20) to skip dull greys/browns/blacks
                        if (brightness > 45 && brightness < 185 && saturation > 0.20) {
                            vibrantR += r;
                            vibrantG += g;
                            vibrantB += b;
                            vibrantCount++;
                        }
                    }

                    let finalColor = [10, 10, 12]; // Default

                    if (vibrantCount > 5) {
                        // We found enough vibrant pixels!
                        finalColor = [
                            Math.round(vibrantR / vibrantCount),
                            Math.round(vibrantG / vibrantCount),
                            Math.round(vibrantB / vibrantCount)
                        ];
                    } else if (avgCount > 0) {
                        // Fall back to general average
                        finalColor = [
                            Math.round(avgR / avgCount),
                            Math.round(avgG / avgCount),
                            Math.round(avgB / avgCount)
                        ];
                    }

                    // Cache and resolve
                    colorCache.set(imageUrl, finalColor);
                    resolve(finalColor);
                } catch (err) {
                    console.warn('[ColorExtractor] Processing error:', err);
                    resolve([10, 10, 12]);
                } finally {
                    URL.revokeObjectURL(objectUrl);
                }
            };

            img.onerror = () => {
                resolve([10, 10, 12]);
                URL.revokeObjectURL(objectUrl);
            };

            img.src = objectUrl;
        });
    } catch (err) {
        console.warn('[ColorExtractor] Fetch error:', err);
        return [10, 10, 12];
    }
};
