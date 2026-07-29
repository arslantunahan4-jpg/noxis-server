// Recommendation Worker
// Heavy calculations happen here to keep UI smooth

const WEIGHTS = {
    RECENCY_DECAY: 0.95,
    COMPLETION_BONUS: 1.5,
    MIN_PROGRESS: 0.1,
    MAX_ITEMS: 20
};

// Simple fetch wrapper for Worker
const fetchTMDB = async (endpoint, apiUrl) => {
    try {
        const res = await fetch(`${apiUrl}/api/tmdb?endpoint=${encodeURIComponent(endpoint)}`);
        return res.ok ? await res.json() : null;
    } catch (e) {
        return null;
    }
};

self.onmessage = async (e) => {
    const { history, apiUrl } = e.data;

    try {
        if (!history || Object.keys(history).length === 0) {
            self.postMessage({ type: 'SUCCESS', result: { topPicks: [], becauseYouWatched: [], genreBased: [] } });
            return;
        }

        // 1. Veri Analizi
        const historyItems = Object.values(history)
            .filter(item => item.id)
            .sort((a, b) => (b.updatedAt || b.timestamp || 0) - (a.updatedAt || a.timestamp || 0))
            .slice(0, WEIGHTS.MAX_ITEMS);

        const genreScores = {};
        const scoredItems = [];
        const now = Date.now();
        const oneDay = 1000 * 60 * 60 * 24;

        // Fetch details for top items
        const detailedAnalysisQueue = historyItems.slice(0, 5);
        const details = await Promise.all(
            detailedAnalysisQueue.map(item => 
                fetchTMDB(`/${(item.media_type === 'tv' || item.season) ? 'tv' : 'movie'}/${item.id}`, apiUrl)
            )
        );

        details.forEach((detail, index) => {
            if (!detail) return;
            const item = detailedAnalysisQueue[index];
            
            const itemTime = item.updatedAt || item.timestamp || now;
            const daysDiff = (now - itemTime) / oneDay;
            const recencyScore = Math.pow(WEIGHTS.RECENCY_DECAY, daysDiff);
            
            // AI Engagement Precision: Calculate real uninterrupted watch time
            const duration = item.duration || 1;
            const realSec = item.realWatchSeconds || (item.progress ? (item.progress / 100) * duration : 0);
            const realRatio = Math.min(1, realSec / duration);

            // Anti-Fraud Filter: Skip fast-forwarded / accidental clicks (< 3 mins and < 15%)
            if (realSec < 180 && realRatio < 0.15) return;

            // Engagement Multiplier: Content watched for > 15 mins or > 50% continuously gets 2.0x weight!
            let engagementBonus = 1.0;
            if (realSec >= 900 || realRatio >= 0.5) engagementBonus = 2.0;

            const impactScore = realRatio * recencyScore * engagementBonus;
            scoredItems.push({ ...detail, impactScore });

            detail.genres?.forEach(g => {
                if (!genreScores[g.id]) genreScores[g.id] = { id: g.id, name: g.name, score: 0, count: 0 };
                genreScores[g.id].score += impactScore;
                genreScores[g.id].count += 1;
            });
        });

        // Top Genres
        const topGenres = Object.values(genreScores)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        // Top Item
        const topItem = scoredItems.sort((a, b) => b.impactScore - a.impactScore)[0];

        const results = {
            topPicks: [],
            becauseYouWatched: [],
            genreBased: []
        };

        // A) "Because You Watched"
        if (topItem) {
            const type = topItem.number_of_seasons ? 'tv' : 'movie';
            const simRes = await fetchTMDB(`/${type}/${topItem.id}/recommendations`, apiUrl);
            if (simRes?.results) {
                results.becauseYouWatched = {
                    title: `${topItem.title || topItem.name} İzlediğiniz İçin`,
                    data: filterWatched(simRes.results, history)
                };
            }
        }

        // B) "Genre Based"
        if (topGenres.length > 0) {
            const mainGenre = topGenres[0];
            const endpoint = `/discover/movie?with_genres=${mainGenre.id}&sort_by=popularity.desc`;
            const genreRes = await fetchTMDB(endpoint, apiUrl);
            if (genreRes?.results) {
                results.genreBased = {
                    title: `${mainGenre.name} Tutkunları İçin`,
                    data: filterWatched(genreRes.results, history)
                };
            }
        }

        // C) "Top Picks"
        if (topGenres.length >= 2) {
            const g1 = topGenres[0].id;
            const g2 = topGenres[1].id;
            const hybridRes = await fetchTMDB(`/discover/movie?with_genres=${g1},${g2}&sort_by=vote_average.desc&vote_count.gte=300`, apiUrl);
            
            if (hybridRes?.results?.length > 0) {
                results.topPicks = {
                    title: 'Sizin İçin Seçilenler',
                    data: filterWatched(hybridRes.results, history)
                };
            } else {
                const fallbackRes = await fetchTMDB(`/discover/movie?with_genres=${g1}&sort_by=vote_average.desc&vote_count.gte=500`, apiUrl);
                results.topPicks = {
                    title: 'Sizin İçin Seçilenler',
                    data: filterWatched(fallbackRes?.results || [], history)
                };
            }
        } else if (topGenres.length === 1) {
             const fallbackRes = await fetchTMDB(`/discover/movie?with_genres=${topGenres[0].id}&sort_by=vote_average.desc&vote_count.gte=500`, apiUrl);
             results.topPicks = {
                 title: 'Sizin İçin Seçilenler',
                 data: filterWatched(fallbackRes?.results || [], history)
             };
        }

        self.postMessage({ type: 'SUCCESS', result: results });

    } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
    }
};

const filterWatched = (list, history) => {
    return list.filter(item => !history[item.id]);
};
