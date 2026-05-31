export let cachedM3U = {
    movie: null,
    tv: null
};

export const fetchAndParseM3U = async (type = 'tv') => {
    if (cachedM3U[type]) return cachedM3U[type];

    // Local file paths in /public directory
    const fileName = type === 'movie' ? '/power-sinema.m3u' : '/power-yabanci-dizi.m3u';
    
    try {
        const response = await fetch(fileName);
        if (!response.ok) throw new Error('Network response was not ok');
        const text = await response.text();
        
        const lines = text.split('\n');
        const entries = [];
        let currentInfo = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXTINF:')) {
                const titleMatch = line.match(/,(.+?)$/);
                const titlePart = titleMatch ? titleMatch[1] : '';
                
                let seriesName = '';
                let season = null;
                let episode = null;
                
                if (type === 'tv') {
                    const sxeMatch = titlePart.match(/(.+?)\s+s(\d+)e(\d+)/i);
                    const sezonMatch = titlePart.match(/(.+?)[-\s]+(\d+)\.\s*Sezon\s*(\d+)\.\s*Bölüm/i);
                    
                    if (sxeMatch) {
                        seriesName = sxeMatch[1].trim();
                        season = parseInt(sxeMatch[2]);
                        episode = parseInt(sxeMatch[3]);
                    } else if (sezonMatch) {
                        seriesName = sezonMatch[1].trim();
                        season = parseInt(sezonMatch[2]);
                        episode = parseInt(sezonMatch[3]);
                    } else {
                        seriesName = titlePart;
                    }
                } else {
                    seriesName = titlePart.replace(/\(\d{4}\).*$/, '').trim(); 
                    if (!seriesName) seriesName = titlePart;
                }
                
                seriesName = seriesName.replace(/-$/, '').trim();

                currentInfo = { seriesName, season, episode, fullTitle: titlePart };
            } else if (line.startsWith('http')) {
                if (currentInfo) {
                    entries.push({
                        ...currentInfo,
                        url: line
                    });
                    currentInfo = null;
                }
            }
        }
        
        cachedM3U[type] = entries;
        return entries;
    } catch (e) {
        return [];
    }
};

export const findInM3U = async (title, season, episode, type = 'tv') => {
    if (!title) return null;
    const entries = await fetchAndParseM3U(type);
    
    const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const searchTitle = normalize(title);
    
    // Find all exact matches first
    let matches = entries.filter(e => {
        const entryTitle = normalize(e.seriesName);
        if (type === 'tv') {
            return entryTitle === searchTitle && 
                   e.season === parseInt(season) && 
                   e.episode === parseInt(episode);
        } else {
            // For movies, we check if title matches or is contained
            return entryTitle.includes(searchTitle) || searchTitle.includes(entryTitle);
        }
    });

    // Fallback to fuzzy search for TV if no exact match
    if (matches.length === 0 && type === 'tv') {
        matches = entries.filter(e => {
            const entryTitle = normalize(e.seriesName);
            return (entryTitle.includes(searchTitle) || searchTitle.includes(entryTitle)) && 
                   e.season === parseInt(season) && 
                   e.episode === parseInt(episode);
        });
    }

    if (matches.length > 0) {
        // Prioritize URLs with '_tr' (Turkish dubbing) to enable dual audio toggle in player
        const trMatch = matches.find(m => m.url.includes('_tr'));
        return trMatch ? trMatch.url : matches[0].url;
    }

    return null;
};
