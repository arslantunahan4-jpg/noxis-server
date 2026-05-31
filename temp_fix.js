                try {
                    const subParams = new URLSearchParams({
                        imdb: imdbId,
                        season: isSeries ? s : '',
                        episode: isSeries ? e : ''
                    });
                    const subRes = await fetch(`${SERVER_URL}/subtitles?${subParams}`);
                    const subData = await subRes.json();
                    
                    if (Array.isArray(subData) && subData.length > 0) {
                        const sorted = subData.sort((a, b) => {
                            if (a.lang === 'tur' || a.lang === 'tr') return -1;
                            if (b.lang === 'tur' || b.lang === 'tr') return 1;
                            return 0;
                        });
                        setSubtitles(sorted);
                    } else {
                        setSubtitles([]);
                    }
                } catch (err) {
                    console.error("M3U Subtitle Error:", err);
                    setSubtitles([]);
                }
