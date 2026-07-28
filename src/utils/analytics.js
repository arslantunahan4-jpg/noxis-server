import { getWatchHistory } from './watchHistory';
import { fetchTMDBCached } from '../tv/utils/tmdbCache';

const GENRE_MAP = {
    28: 'Aksiyon',
    12: 'Macera',
    16: 'Animasyon',
    35: 'Komedi',
    80: 'Suç',
    99: 'Belgesel',
    18: 'Dram',
    10751: 'Aile',
    14: 'Fantastik',
    36: 'Tarih',
    27: 'Korku',
    10402: 'Müzik',
    9648: 'Gizem',
    10749: 'Romantik',
    878: 'Bilim Kurgu',
    10770: 'TV Film',
    53: 'Gerilim',
    10752: 'Savaş',
    37: 'Vahşi Batı'
};

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/**
 * Filter out invalid/accidental clicks (opened and closed items < 3 mins or < 15% unless completed)
 */
const isValidWatchItem = (item) => {
    if (!item) return false;
    const duration = Number(item.currentTime || 0);
    const progress = Number(item.progress || 0);
    
    if (item.completed || progress >= 85) return true;
    return duration >= 180 && progress >= 15;
};

/**
 * Check if item is truly completed (%85+ watched or completed flag)
 */
const isCompletedItem = (item) => {
    if (!item) return false;
    return item.completed === true || Number(item.progress || 0) >= 85;
};

/**
 * Mathematically precise and witty hours breakdown (Gen-Z / Modern style)
 */
export const formatHoursBreakdown = (totalHours, totalMinutes) => {
    if (totalHours >= 24) {
        const days = Math.floor(totalHours / 24);
        const remainingHours = Math.round(totalHours % 24);
        return {
            title: `${days} Tam Gün ${remainingHours > 0 ? `${remainingHours} Saat` : ''}`,
            desc: `Tam ${days} gün boyunca kesintisiz maraton modu! Ekran süren şaka mı? 🔥`,
            comparison: `İstanbul'dan Tokyo'ya ${(totalHours / 11.5).toFixed(1)} kez uçup gelmiş gibisin! ✈️`
        };
    } else if (totalHours >= 1) {
        const percentOfDay = Math.round((totalHours / 24) * 100);
        return {
            title: `${totalHours} Saat`,
            desc: `Bir günün tam %${percentOfDay}'ini sinema aura'sına ayırdın.`,
            comparison: `Yaklaşık ${(totalHours / 1.8).toFixed(1)} uzun metrajlı film seansı kadar! 🍿`
        };
    } else {
        const mins = totalMinutes || 1;
        return {
            title: `${mins} Dakika`,
            desc: `Main Character yolculuğunun ilk kıvılcımı atıldı.`,
            comparison: `${Math.max(1, Math.round(mins / 20))} fragman veya TikTok özeti süresi! 🎬`
        };
    }
};

/**
 * Modern Gen-Z / Pop-Culture Personas (Non-boomer)
 */
const getBadgeForStats = (totalHours, episodeCount, topGenreName) => {
    if (topGenreName === 'Bilim Kurgu') {
        return {
            title: 'SİMÜLASYON HACKER\'I',
            desc: 'Gerçeklikten koptun. Matrix\'te veya paralel bir evrende yaşamaya hazırsın.'
        };
    }
    if (topGenreName === 'Aksiyon' || topGenreName === 'Macera') {
        return {
            title: 'ADRENALİN JUNKIE',
            desc: 'Nabzının düşmesine izin vermedin. Ekranda patlama yoksa senin için sıkıcı bir gündür.'
        };
    }
    if (topGenreName === 'Korku' || topGenreName === 'Gerilim') {
        return {
            title: 'KARANLIK MİMARI',
            desc: 'Travma yaşamak yerine travmayı izlemeyi tercih eden o korkusuz psikopat.'
        };
    }
    if (topGenreName === 'Dram' || topGenreName === 'Romantik' || topGenreName === 'Dizi & Drama') {
        return {
            title: 'AURA BÜKÜCÜ',
            desc: 'Karakterlerin derdiyle dertlenen, senaryoyu damarlarında hisseden derin vizyon.'
        };
    }
    if (topGenreName === 'Komedi') {
        return {
            title: 'KAOS YÖNETİCİSİ',
            desc: 'Stresi ve derdi kapıda bıraktın. Sadece kaliteli vizyon ve saf dopamine odaklandın.'
        };
    }
    if (episodeCount > 15) {
        return {
            title: 'LORE MASTER',
            desc: '"Son bir bölüm" yalanına inanmayı çoktan bıraktın. Diziyi değil hayatını erteledin.'
        };
    }
    if (totalHours > 20) {
        return {
            title: 'KÜLTÜR BAKANI',
            desc: 'Algıların açık, kalite standartların yüksek. Boş içeriğe ayıracak 1 saniyen bile yok.'
        };
    }
    return {
        title: 'MAIN CHARACTER',
        desc: 'Kendi filminin başrolü. Ekran karşısında geçen her saat, senin ana karakter enerjini besliyor.'
    };
};

/**
 * 12 Modern Gen-Z Unlockable Achievements
 */
export const getUserLevelAndBadges = (totalHours = 0, episodeCount = 0, movieCount = 0, insights = {}) => {
    const totalXP = Math.round(totalHours * 100) + (episodeCount * 25) + (movieCount * 40);
    const level = Math.floor(totalXP / 250) + 1;
    const currentLevelXP = totalXP % 250;
    const progressPercent = Math.min(100, Math.round((currentLevelXP / 250) * 100));

    const getLevelTitle = (lvl) => {
        if (lvl >= 10) return { name: 'Final Boss', icon: '👑', color: '#f59e0b' };
        if (lvl >= 7) return { name: 'Sinema Gurmesi', icon: '💎', color: '#a855f7' };
        if (lvl >= 5) return { name: 'Maraton Avcısı', icon: '🔥', color: '#ef4444' };
        if (lvl >= 3) return { name: 'Binge Watching', icon: '📺', color: '#3b82f6' };
        return { name: 'Cinema Starter', icon: '🍿', color: '#10b981' };
    };

    const completedTotal = movieCount + episodeCount;

    const allBadges = [
        {
            id: 'first_watch',
            title: 'Origin Story',
            desc: 'İlk içeriğini %85+ oranında bitirdin.',
            icon: '🎬',
            unlocked: completedTotal >= 1
        },
        {
            id: 'night_owl',
            title: '3 AM Demon',
            desc: 'Gece 23:00 - 04:00 saatlerinde ekran başındaydın.',
            icon: '🌙',
            unlocked: Boolean(insights.hasLateNightWatch)
        },
        {
            id: 'binge_master',
            title: 'Binge God',
            desc: 'En az 10 dizi bölümünü tek hamlede bitirdin.',
            icon: '📺',
            unlocked: episodeCount >= 10
        },
        {
            id: 'movie_buff',
            title: 'Movie Addict',
            desc: 'En az 5 film tamamladın.',
            icon: '🍿',
            unlocked: movieCount >= 5
        },
        {
            id: 'marathon_hero',
            title: 'Unstoppable',
            desc: '24 saati aşan ekran süresine ulaştın.',
            icon: '⚡',
            unlocked: totalHours >= 24
        },
        {
            id: 'sci_fi_explorer',
            title: 'Cyberpunk',
            desc: 'Bilim kurgu türünde takıldın.',
            icon: '🚀',
            unlocked: Boolean(insights.genreCounts && insights.genreCounts['Bilim Kurgu'] >= 2)
        },
        {
            id: 'action_junkie',
            title: 'Adrenalin Overdose',
            desc: 'Aksiyon/Macera türünde 5+ içerik izledin.',
            icon: '🔥',
            unlocked: Boolean(insights.genreCounts && ((insights.genreCounts['Aksiyon'] || 0) + (insights.genreCounts['Macera'] || 0)) >= 5)
        },
        {
            id: 'genre_guru',
            title: 'Aura Master',
            desc: '5 farklı türde takıldın.',
            icon: '🎯',
            unlocked: Boolean(insights.uniqueGenresCount >= 5)
        },
        {
            id: 'weekend_warrior',
            title: 'Weekend Chill',
            desc: 'Haftasonu maraton modunu açtın.',
            icon: '📅',
            unlocked: Boolean(insights.hasWeekendWatch)
        },
        {
            id: 'cinephile_master',
            title: 'Letterboxd Boss',
            desc: '50 saatten fazla sinema mesaisi yaptın.',
            icon: '👑',
            unlocked: totalHours >= 50
        },
        {
            id: 'completionist',
            title: 'Skip Yok!',
            desc: 'İçeriklerin %80+ kısmını bitiriyorsun.',
            icon: '🎯',
            unlocked: Boolean(insights.completionRate >= 80 && completedTotal >= 3)
        },
        {
            id: 'cult_collector',
            title: 'Archivist',
            desc: 'Toplamda 20+ içerik tamamladın.',
            icon: '💎',
            unlocked: completedTotal >= 20
        }
    ];

    return {
        level,
        totalXP,
        currentLevelXP,
        nextLevelXP: 250,
        progressPercent,
        levelInfo: getLevelTitle(level),
        badges: allBadges
    };
};

/**
 * 100% ACCURATE Deep Insights & Analytics
 */
export const getDeepWatchInsights = () => {
    const history = getWatchHistory();
    const rawItems = Object.values(history).filter(Boolean);

    const validItems = rawItems.filter(isValidWatchItem);

    if (validItems.length === 0) {
        return {
            hasData: false,
            totalHours: 0,
            totalMinutes: 0,
            movieCount: 0,
            episodeCount: 0,
            completionRate: 0,
            mostActiveHour: '—',
            mostActiveDay: '—',
            genreDiversityScore: 0,
            avgSessionMinutes: 0,
            uniqueGenresCount: 0,
            genreCounts: {},
            hasLateNightWatch: false,
            hasWeekendWatch: false
        };
    }

    let totalSeconds = 0;
    let movieCount = 0;
    let episodeCount = 0;
    let completedCount = 0;

    const hourCounts = Array(24).fill(0);
    const dayCounts = Array(7).fill(0);
    const genreCounts = {};

    let hasLateNightWatch = false;
    let hasWeekendWatch = false;

    validItems.forEach((item) => {
        const duration = Number(item.currentTime || 0);
        totalSeconds += duration;

        const isCompleted = isCompletedItem(item);
        if (isCompleted) completedCount += 1;

        if (item.media_type === 'tv' || item.season || item.episode) {
            if (isCompleted) episodeCount += 1;
        } else {
            if (isCompleted) movieCount += 1;
        }

        const date = new Date(item.updatedAt || Date.now());
        if (!isNaN(date.getTime())) {
            const h = date.getHours();
            const day = date.getDay();

            hourCounts[h] += 1;
            dayCounts[day] += 1;

            if (h >= 23 || h <= 4) hasLateNightWatch = true;
            if (day === 0 || day === 6) hasWeekendWatch = true;
        }

        if (Array.isArray(item.genre_ids)) {
            item.genre_ids.forEach((gId) => {
                const name = GENRE_MAP[gId];
                if (name) genreCounts[name] = (genreCounts[name] || 0) + 1;
            });
        }
    });

    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;
    const totalMinutes = Math.round(totalSeconds / 60);

    let peakHour = 0;
    let peakHourVal = 0;
    hourCounts.forEach((val, h) => {
        if (val > peakHourVal) {
            peakHourVal = val;
            peakHour = h;
        }
    });
    const mostActiveHour = peakHourVal > 0 
        ? `${String(peakHour).padStart(2, '0')}:00 - ${String((peakHour + 2) % 24).padStart(2, '0')}:00`
        : '23:00 - 02:00';

    let peakDay = 0;
    let peakDayVal = 0;
    dayCounts.forEach((val, d) => {
        if (val > peakDayVal) {
            peakDayVal = val;
            peakDay = d;
        }
    });
    const mostActiveDay = peakDayVal > 0 ? DAY_NAMES[peakDay] : 'Pazar';

    const uniqueGenresCount = Object.keys(genreCounts).length;
    const genreDiversityScore = Math.min(100, Math.round((uniqueGenresCount / 8) * 100));
    const completionRate = validItems.length > 0 ? Math.round((completedCount / validItems.length) * 100) : 0;
    const avgSessionMinutes = validItems.length > 0 ? Math.round((totalMinutes / validItems.length)) : 0;

    return {
        hasData: true,
        totalHours,
        totalMinutes,
        movieCount,
        episodeCount,
        completedCount,
        totalItemsCount: validItems.length,
        completionRate,
        mostActiveHour,
        mostActiveDay,
        genreDiversityScore,
        avgSessionMinutes,
        uniqueGenresCount,
        genreCounts,
        hasLateNightWatch,
        hasWeekendWatch
    };
};

/**
 * Monthly Analytics
 */
export const getMonthlyAnalytics = (customHistory = null) => {
    const history = customHistory || getWatchHistory();
    const rawItems = Object.values(history).filter(Boolean);
    const items = rawItems.filter(isValidWatchItem);

    if (items.length === 0) return [];

    const monthlyData = {};

    items.forEach((item) => {
        const timeMs = item.updatedAt || Date.now();
        const date = new Date(timeMs);
        if (isNaN(date.getTime())) return;

        const duration = Number(item.currentTime || 0);

        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[yearMonth]) {
            monthlyData[yearMonth] = {
                yearMonth,
                monthName: date.toLocaleString('tr-TR', { month: 'long', year: 'numeric' }),
                totalSeconds: 0,
                moviesCount: 0,
                episodesCount: 0,
                genreCounts: {},
                items: []
            };
        }

        monthlyData[yearMonth].totalSeconds += duration;

        const isCompleted = isCompletedItem(item);
        if (item.media_type === 'tv' || item.season || item.episode) {
            if (isCompleted) monthlyData[yearMonth].episodesCount += 1;
        } else {
            if (isCompleted) monthlyData[yearMonth].moviesCount += 1;
        }

        if (Array.isArray(item.genre_ids) && item.genre_ids.length > 0) {
            item.genre_ids.forEach((gId) => {
                const name = GENRE_MAP[gId];
                if (name) {
                    monthlyData[yearMonth].genreCounts[name] = (monthlyData[yearMonth].genreCounts[name] || 0) + 1;
                }
            });
        }

        monthlyData[yearMonth].items.push(item);
    });

    return Object.values(monthlyData)
        .map((data) => {
            const totalHours = Math.round((data.totalSeconds / 3600) * 10) / 10;
            let topGenre = '—';
            let maxCount = 0;
            Object.entries(data.genreCounts).forEach(([name, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    topGenre = name;
                }
            });
            if (topGenre === '—') {
                topGenre = data.episodesCount > data.moviesCount ? 'Dizi & Drama' : 'Sinema & Aksiyon';
            }
            const persona = getBadgeForStats(totalHours, data.episodesCount, topGenre);
            const top4Items = data.items.slice(0, 4);

            return {
                ...data,
                totalHours,
                topGenre,
                persona,
                top4Items
            };
        })
        .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
};

/**
 * 30 NOVEMBER ANNUAL WRAPPED CYCLE SYSTEM
 */
export const getAnnualWrappedData = (targetYear = new Date().getFullYear(), customHistory = null) => {
    const history = customHistory || getWatchHistory();
    const rawItems = Object.values(history).filter(Boolean);

    const cycleStart = new Date(targetYear - 1, 11, 1, 0, 0, 0).getTime();
    const cycleEnd = new Date(targetYear, 10, 30, 23, 59, 59).getTime();

    const items = rawItems.filter((item) => {
        if (!isValidWatchItem(item)) return false;
        const itemTime = item.updatedAt || Date.now();
        return itemTime >= cycleStart && itemTime <= cycleEnd;
    });

    const cycleItems = items.length > 0 ? items : rawItems.filter(isValidWatchItem);

    let totalSeconds = 0;
    let movieCount = 0;
    let episodeCount = 0;
    const genreCounts = {};
    const itemMap = new Map();
    const dailyBingeCounts = {};

    cycleItems.forEach((item) => {
        const duration = Number(item.currentTime || 0);
        totalSeconds += duration;

        const isCompleted = isCompletedItem(item);
        const itemDate = new Date(item.updatedAt || Date.now());
        const dateKey = `${itemDate.getFullYear()}-${itemDate.getMonth() + 1}-${itemDate.getDate()}`;

        if (item.media_type === 'tv' || item.season || item.episode) {
            if (isCompleted) {
                episodeCount += 1;
                if (!dailyBingeCounts[dateKey]) dailyBingeCounts[dateKey] = { count: 0, date: itemDate, title: item.title };
                dailyBingeCounts[dateKey].count += 1;
                // keep the title of the latest binged show
                dailyBingeCounts[dateKey].title = item.title;
            }
        } else {
            if (isCompleted) movieCount += 1;
        }

        if (Array.isArray(item.genre_ids) && item.genre_ids.length > 0) {
            item.genre_ids.forEach((gId) => {
                const name = GENRE_MAP[gId];
                if (name) {
                    genreCounts[name] = (genreCounts[name] || 0) + 1;
                }
            });
        }

        const id = item.imdbId || item.id || item.title;
        if (id && item.title) {
            const existing = itemMap.get(id) || { ...item, totalWatchSeconds: 0 };
            existing.totalWatchSeconds += duration;
            itemMap.set(id, existing);
        }
    });

    let maxBinge = { count: 0, date: null, title: '' };
    Object.values(dailyBingeCounts).forEach(day => {
        if (day.count > maxBinge.count) {
            maxBinge = day;
        }
    });

    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;
    const totalMinutes = Math.round(totalSeconds / 60);
    const hasEnoughData = cycleItems.length > 0 && totalSeconds >= 180;

    let sortedGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));

    if (sortedGenres.length === 0) {
        if (episodeCount > 0) sortedGenres.push({ name: 'Dizi & Drama', count: episodeCount });
        if (movieCount > 0) sortedGenres.push({ name: 'Sinema & Aksiyon', count: movieCount });
    }

    const top5Items = Array.from(itemMap.values())
        .sort((a, b) => b.totalWatchSeconds - a.totalWatchSeconds)
        .slice(0, 5);

    const topGenre = sortedGenres[0]?.name || (episodeCount > movieCount ? 'Dizi & Drama' : 'Sinema & Aksiyon');
    const persona = getBadgeForStats(totalHours, episodeCount, topGenre);
    const timeBreakdown = formatHoursBreakdown(totalHours, totalMinutes);
    const insights = getDeepWatchInsights();
    const userLevelData = getUserLevelAndBadges(totalHours, episodeCount, movieCount, insights);

    return {
        year: targetYear,
        cycleDateRange: `1 Aralık ${targetYear - 1} - 30 Kasım ${targetYear}`,
        hasEnoughData,
        totalHours,
        totalMinutes,
        movieCount,
        episodeCount,
        topGenres: sortedGenres.slice(0, 3),
        topGenreName: topGenre,
        top3Items: top5Items.slice(0, 3),
        top5Items,
        persona,
        timeBreakdown,
        userLevelData,
        insights,
        maxBinge
    };
};


export const enrichWrappedWithCredits = async (wrappedData) => {
    if (!wrappedData || !wrappedData.top5Items || wrappedData.top5Items.length === 0) return wrappedData;

    // Sadece en çok izlenen 15 yapımı tarayalım ki TMDB limitlerine takılmayalım
    const topItems = wrappedData.top5Items.slice(0, 15);
    const actorScores = {};
    const directorScores = {};

    const fetchPromises = topItems.map(async (item) => {
        if (!item.id && !item.imdbId) return;
        
        try {
            const type = item.media_type === 'tv' || item.season ? 'tv' : 'movie';
            const tmdbId = item.id || item.imdbId;
            const endpoint = `/${type}/${tmdbId}?append_to_response=credits`;
            
            const data = await fetchTMDBCached(endpoint, { ttl: 24 * 60 * 60 * 1000 });
            if (!data || !data.credits) return;

            const watchSeconds = item.totalWatchSeconds || 0;
            const watchHours = watchSeconds / 3600;

            // Oyuncular (Sadece ana kadro, ilk 5 kişi yeterli)
            const cast = data.credits.cast?.slice(0, 5) || [];
            cast.forEach(actor => {
                if (!actorScores[actor.id]) {
                    actorScores[actor.id] = { id: actor.id, name: actor.name, profile_path: actor.profile_path, score: 0, count: 0 };
                }
                actorScores[actor.id].score += watchHours;
                actorScores[actor.id].count += 1;
            });

            // Yönetmenler / Yaratıcılar
            const crew = data.credits.crew || [];
            const directors = type === 'tv' 
                ? (data.created_by || []) 
                : crew.filter(c => c.job === 'Director');
                
            directors.forEach(dir => {
                if (!directorScores[dir.id]) {
                    directorScores[dir.id] = { id: dir.id, name: dir.name, profile_path: dir.profile_path, score: 0, count: 0 };
                }
                directorScores[dir.id].score += watchHours;
                directorScores[dir.id].count += 1;
            });

        } catch (e) {
            console.warn('Wrapped TMDB Cekimi Hatali:', item.title);
        }
    });

    await Promise.all(fetchPromises);

    let topActor = null;
    let maxActorScore = 0;
    Object.values(actorScores).forEach(actor => {
        // En az 3 farklı yapımda izlenmiş veya en az 5 saat maruz kalınmışsa
        if (actor.score > maxActorScore && (actor.count >= 3 || actor.score >= 5)) {
            maxActorScore = actor.score;
            topActor = actor;
        }
    });

    let topDirector = null;
    let maxDirScore = 0;
    Object.values(directorScores).forEach(dir => {
        // Yönetmen eşiği (en az 3 yapım veya 5 saat)
        if (dir.score > maxDirScore && (dir.count >= 3 || dir.score >= 5)) {
            maxDirScore = dir.score;
            topDirector = dir;
        }
    });

    return {
        ...wrappedData,
        topActor: topActor ? { ...topActor, score: Math.round(topActor.score * 10) / 10 } : null,
        topDirector: topDirector ? { ...topDirector, score: Math.round(topDirector.score * 10) / 10 } : null
    };
};
