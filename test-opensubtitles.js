import OpenSubtitles from 'opensubtitles-api';

const OS = new OpenSubtitles({
    useragent: 'NoxisStreamingApp',
    ssl: true
});

async function testOpenSubtitles() {
    console.log("Testing OpenSubtitles API...");
    try {
        const searchParams = {
            imdbid: '1375666', // Inception
            limit: 'all'
        };
        
        console.log(`Searching for IMDB ID: ${searchParams.imdbid}`);
        const subtitles = await OS.search(searchParams);
        
        const results = [];

        if (subtitles.tr) {
            console.log(`Found ${subtitles.tr.length} Turkish subtitles.`);
            subtitles.tr.slice(0, 3).forEach(sub => {
                results.push({
                    lang: 'tr',
                    url: sub.url,
                    label: `Türkçe (${sub.score} - OS)`
                });
            });
        } else {
            console.log("No Turkish subtitles found.");
        }

        if (subtitles.en) {
            console.log(`Found ${subtitles.en.length} English subtitles.`);
            subtitles.en.slice(0, 3).forEach(sub => {
                results.push({
                    lang: 'en',
                    url: sub.url,
                    label: `English (${sub.score} - OS)`
                });
            });
        } else {
            console.log("No English subtitles found.");
        }

        console.log("\nSample Results:");
        console.log(JSON.stringify(results, null, 2));

    } catch (e) {
        console.error("OpenSubtitles API Error:", e.message);
    }
}

testOpenSubtitles();
