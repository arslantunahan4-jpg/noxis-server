/**
 * Spotify & Apple Music Style 9:16 Ultra-Premium Story Poster Generator
 */
export const generateWrappedPosterCanvas = async (stats, avatarUrl, username = 'Kullanıcı') => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920; // 9:16 Standard Instagram / TikTok Story aspect ratio
    const ctx = canvas.getContext('2d');

    // 1. Dark Fluid Background Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 1080, 1920);
    bgGradient.addColorStop(0, '#06060c');
    bgGradient.addColorStop(0.25, '#16081e');
    bgGradient.addColorStop(0.65, '#0b1329');
    bgGradient.addColorStop(1, '#030306');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // Glowing Radial Mesh Orbs
    const orb1 = ctx.createRadialGradient(250, 350, 0, 250, 350, 600);
    orb1.addColorStop(0, 'rgba(229, 9, 20, 0.45)');
    orb1.addColorStop(1, 'transparent');
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, 1080, 1920);

    const orb2 = ctx.createRadialGradient(850, 1400, 0, 850, 1400, 700);
    orb2.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
    orb2.addColorStop(1, 'transparent');
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, 1080, 1920);

    const orb3 = ctx.createRadialGradient(540, 960, 0, 540, 960, 450);
    orb3.addColorStop(0, 'rgba(0, 242, 254, 0.25)');
    orb3.addColorStop(1, 'transparent');
    ctx.fillStyle = orb3;
    ctx.fillRect(0, 0, 1080, 1920);

    // Subtle Outer Frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, 1008, 1848);

    // Top Header Badge
    ctx.fillStyle = 'rgba(229, 9, 20, 0.2)';
    ctx.strokeStyle = 'rgba(255, 59, 71, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(340, 90, 400, 60, 30);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff3b47';
    ctx.font = '900 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`✨ NOXIS REWIND ${stats.year || 2026}`, 540, 128);

    // User Avatar in Glowing Ring
    const avatarY = 270;
    if (avatarUrl) {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                img.src = avatarUrl;
            });
            if (img.complete && img.naturalWidth !== 0) {
                const ringGlow = ctx.createRadialGradient(540, avatarY, 90, 540, avatarY, 130);
                ringGlow.addColorStop(0, 'rgba(229, 9, 20, 0.8)');
                ringGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = ringGlow;
                ctx.beginPath();
                ctx.arc(540, avatarY, 130, 0, Math.PI * 2);
                ctx.fill();

                ctx.save();
                ctx.beginPath();
                ctx.arc(540, avatarY, 95, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(img, 445, avatarY - 95, 190, 190);
                ctx.restore();

                ctx.strokeStyle = '#e50914';
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.arc(540, avatarY, 97, 0, Math.PI * 2);
                ctx.stroke();
            }
        } catch (e) {
            // Fallback
        }
    }

    // Username & Subtitle
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(username, 540, 425);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '700 24px sans-serif';
    ctx.fillText(`2026 Yıllık Sinema Karnesi`, 540, 465);

    // Persona Crown Card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(229, 9, 20, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(100, 515, 880, 230, 32);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff3b47';
    ctx.font = '900 26px sans-serif';
    ctx.fillText(`👑 2026 SİNEMA UNVANIN`, 540, 565);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px sans-serif';
    ctx.fillText(stats.persona?.title || 'Sinema Kaşifi', 540, 640);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '400 24px sans-serif';
    const descText = stats.persona?.desc || '';
    ctx.fillText(descText.length > 55 ? descText.substring(0, 52) + '...' : descText, 540, 695);

    // Core Stats Container (Hours, Movies, Episodes)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(100, 775, 880, 195, 28);
    ctx.fill();
    ctx.stroke();

    const statCols = [
        { num: `${stats.totalHours}`, label: 'SAAT İZLEME' },
        { num: `${stats.movieCount}`, label: 'FİLM' },
        { num: `${stats.episodeCount}`, label: 'DİZİ BÖLÜMÜ' }
    ];

    statCols.forEach((col, idx) => {
        const x = 246 + idx * 294;
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 58px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(col.num, x, 855);

        ctx.fillStyle = '#ff3b47';
        ctx.font = '900 20px sans-serif';
        ctx.fillText(col.label, x, 900);
    });

    // Deep Insights 2x2 Grid (Peak Hour, Active Day, Completion Rate, Top Genre)
    const insights = stats.insights || {};
    const insightGrid = [
        { label: 'ZİRVE İZLEME SAATİ', val: insights.mostActiveHour || '23:00 - 01:00', icon: '🕒' },
        { label: 'EN AKTİF GÜN', val: insights.mostActiveDay || 'Pazar', icon: '📅' },
        { label: 'TAMAMLAMA ORANI', val: `%${insights.completionRate || 90}`, icon: '🎯' },
        { label: 'FAVORİ TÜR', val: stats.topGenreName || 'Aksiyon', icon: '🎭' }
    ];

    insightGrid.forEach((item, idx) => {
        const row = Math.floor(idx / 2);
        const col = idx % 2;
        const x = 100 + col * 450;
        const y = 1000 + row * 155;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, 430, 135, 22);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '800 18px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${item.icon} ${item.label}`, x + 24, y + 42);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 30px sans-serif';
        ctx.fillText(item.val.length > 18 ? item.val.substring(0, 16) + '...' : item.val, x + 24, y + 94);
    });

    // Top 3 Titles Container
    if (stats.top3Items && stats.top3Items.length > 0) {
        const top3Y = 1340;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(100, top3Y, 880, 360, 28);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff3b47';
        ctx.font = '900 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏆 ZİRVEDEKİ 3 FAVORİ İÇERİĞİN', 540, top3Y + 50);

        stats.top3Items.slice(0, 3).forEach((item, idx) => {
            const title = item.title || item.name || 'İçerik';
            const itemY = top3Y + 115 + idx * 80;

            ctx.fillStyle = idx === 0 ? '#e50914' : idx === 1 ? '#7b1fa2' : '#00f2fe';
            ctx.beginPath();
            ctx.roundRect(150, itemY - 32, 54, 44, 12);
            ctx.fill();

            ctx.fillStyle = idx === 2 ? '#000000' : '#ffffff';
            ctx.font = '900 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`#${idx + 1}`, 177, itemY - 2);

            ctx.fillStyle = '#ffffff';
            ctx.font = '800 28px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(title.length > 34 ? title.substring(0, 32) + '...' : title, 225, itemY - 2);
        });
    }

    // Bottom Footer Branding
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '900 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`NOXIS CINEMA • REWIND ${stats.year || 2026}`, 540, 1780);

    return canvas;
};

/**
 * Converts Canvas to Blob
 */
const getCanvasBlob = (canvas) => {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
    });
};

/**
 * Native Device App Picker Share (Instagram Stories, WhatsApp, Messages, etc.)
 */
export const shareNativeWrappedPoster = async (stats, avatarUrl, username = 'Kullanıcı') => {
    try {
        const canvas = await generateWrappedPosterCanvas(stats, avatarUrl, username);
        const blob = await getCanvasBlob(canvas);

        if (!blob) throw new Error('Blob creation failed');

        const fileName = `Noxis_Wrapped_${stats.year || 2026}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        const shareText = `✨ ${stats.year || 2026} Noxis Sinema Özetim!\n⏱️ ${stats.totalHours} Saat İzleme (${stats.movieCount} Film, ${stats.episodeCount} Dizi Bölümü)\n👑 Unvan: ${stats.persona?.title}\n🍿 Noxis Cinema Rewind`;

        // 1. Try file share via Web Share API (Mobile App Picker with Image File)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: `${stats.year || 2026} Noxis Wrapped`,
                    text: shareText
                });
                return { success: true, method: 'native-file' };
            } catch (e) {
                // User cancelled or browser dismissed
            }
        }

        // 2. Fallback: Trigger native share modal (Instagram / WhatsApp / Messages text) AND download PNG image to gallery
        if (navigator.share) {
            try {
                const dataUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
                setTimeout(() => URL.revokeObjectURL(dataUrl), 2000);

                await navigator.share({
                    title: `${stats.year || 2026} Noxis Wrapped`,
                    text: shareText
                });
                return { success: true, method: 'native-text' };
            } catch (e) {
                // User cancelled
            }
        }

        // 3. Desktop Fallback: Trigger PNG download
        const dataUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
        setTimeout(() => URL.revokeObjectURL(dataUrl), 2000);
        return { success: true, method: 'download' };
    } catch (e) {
        console.error('Share native poster failed', e);
        return { success: false, error: e };
    }
};

/**
 * Trigger PNG Download directly
 */
export const downloadWrappedPoster = async (stats, avatarUrl, username) => {
    const canvas = await generateWrappedPosterCanvas(stats, avatarUrl, username);
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Noxis_Wrapped_${stats.year || 2026}_${username}.png`;
    link.href = dataUrl;
    link.click();
};

/**
 * Share via WhatsApp
 */
export const shareWrappedToWhatsApp = (stats) => {
    const text = `✨ ${stats.year || 2026} Noxis Wrapped Özetim!\n⏱️ ${stats.totalHours} Saat İzleme (${stats.movieCount} Film, ${stats.episodeCount} Dizi Bölümü)\n🎭 Favori Tür: ${stats.topGenreName}\n👑 Unvan: ${stats.persona?.title}\n🍿 Sen de sinema özetini keşfet!`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
};
