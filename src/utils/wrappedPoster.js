import * as htmlToImage from 'html-to-image';

export const shareNativeWrappedPoster = async (stats, avatarUrl, username = 'Kullanıcı') => {
    try {
        const node = document.getElementById('noxis-wrapped-export-node');
        if (!node) throw new Error('Export node not found');

        // Capture as Blob using html-to-image
        const blob = await htmlToImage.toBlob(node, {
            quality: 1,
            cacheBust: true,
            pixelRatio: 2 // High resolution for stories
        });

        if (!blob) throw new Error('Blob creation failed');

        const fileName = `Noxis_Wrapped_${stats.year || 2026}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        const shareText = `${stats.year || 2026} Noxis Sinema Özetim!\n⏱️ ${stats.totalHours} Saat İzleme\n👑 Unvan: ${stats.persona?.title}`;

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: `${stats.year || 2026} Noxis Wrapped`,
                    text: shareText
                });
                return { success: true, method: 'native-file' };
            } catch (e) {
                console.error('File share failed:', e);
            }
        } else if (navigator.share) {
            try {
                await navigator.share({
                    title: `${stats.year || 2026} Noxis Wrapped`,
                    text: shareText
                });
                // Sadece metin paylaşabildiyse görseli de yanına indir
                const dataUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
                setTimeout(() => URL.revokeObjectURL(dataUrl), 2000);
                return { success: true, method: 'native-text-and-download' };
            } catch (e) {
                console.error('Text share failed:', e);
            }
        }

        console.warn('Native share API is not available or failed. Falling back to direct download.');
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

export const downloadWrappedPoster = async (stats, avatarUrl, username) => {
    try {
        const node = document.getElementById('noxis-wrapped-export-node');
        if (!node) throw new Error('Export node not found');

        const dataUrl = await htmlToImage.toPng(node, {
            quality: 1,
            pixelRatio: 2
        });

        const link = document.createElement('a');
        link.download = `Noxis_Wrapped_${stats.year || 2026}_${username}.png`;
        link.href = dataUrl;
        link.click();
    } catch (e) {
        console.error('Download poster failed', e);
    }
};

export const shareWrappedToWhatsApp = (stats) => {
    const text = `${stats.year || 2026} Noxis Wrapped Özetim!\n⏱️ ${stats.totalHours} Saat İzleme\n🎭 Favori Tür: ${stats.topGenreName}\n👑 Unvan: ${stats.persona?.title}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
};
