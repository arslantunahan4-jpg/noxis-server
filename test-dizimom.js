
import axios from 'axios';

const DIZIMOM_BASE = 'https://www.dizimom.fit';

const extractPlayerFromContent = (html) => {
    // Try hdplayersystem
    const hdMatch = html.match(/iframe[^>]+src=["'](https:\/\/hdplayersystem\.com\/player\/index\.php\?data=([a-f0-9]+)[^"']*)['"]/i);
    if (hdMatch) return { type: 'hdplayersystem', url: hdMatch[1], videoId: hdMatch[2] };
    // Try hdmomplayer
    const momMatch = html.match(/iframe[^>]+src=["'](https:\/\/hdmomplayer\.com\/embed\/([a-zA-Z0-9]+))['"]/i);
    if (momMatch) return { type: 'hdmomplayer', url: momMatch[1], videoId: momMatch[2] };
    return null;
};

async function testDizimom(title, season, episode) {
    console.log(`\n=== Testing Dizimom WP API for: ${title} S${season}E${episode} ===\n`);
    
    try {
        // Step 1: Search via WordPress REST API
        // Format: "Breaking Bad 1.Sezon 1.Bölüm" matches dizimom's title format
        const searchQuery = `${title} ${season}.Sezon ${episode}.Bölüm`;
        console.log(`[1] Searching WP API: "${searchQuery}"`);
        
        const response = await axios.get(`${DIZIMOM_BASE}/wp-json/wp/v2/posts`, {
            params: { search: searchQuery, per_page: 10 },
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 8000
        });

        const posts = response.data;
        console.log(`[2] Found ${posts.length} posts`);

        if (!posts.length) {
            console.error('No results found');
            return;
        }

        // Step 2: Filter for matching episode
        const s = parseInt(season);
        const e = parseInt(episode);
        const subPattern = new RegExp(`${s}\\.?\\s*Sezon\\s+${e}\\.?\\s*B[öo]l[üu]m(?!.*[Dd]ublaj)`, 'i');
        const dubPattern = new RegExp(`${s}\\.?\\s*Sezon\\s+${e}\\.?\\s*B[öo]l[üu]m.*[Dd]ublaj`, 'i');

        let subPost = null;
        let dubPost = null;

        for (const post of posts) {
            const postTitle = post.title?.rendered || '';
            const titleLower = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const postTitleLower = postTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (!postTitleLower.includes(titleLower)) continue;

            console.log(`  - "${postTitle}" => ${post.link}`);

            if (dubPattern.test(postTitle)) {
                dubPost = post;
            } else if (subPattern.test(postTitle)) {
                subPost = post;
            }
        }

        // Step 3: Extract player from content
        for (const [label, post] of [['Altyazili', subPost], ['Dublaj', dubPost]]) {
            if (!post) {
                console.log(`\n[${label}] No matching post found`);
                continue;
            }

            console.log(`\n[${label}] Matched: "${post.title.rendered}"`);
            const content = post.content?.rendered || '';
            const player = extractPlayerFromContent(content);

            if (!player) {
                console.log(`[${label}] No player iframe found in WP API content, trying page fetch...`);
                try {
                    const pageRes = await axios.get(post.link, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        timeout: 5000
                    });
                    const pagePlayer = extractPlayerFromContent(pageRes.data);
                    if (pagePlayer) {
                        console.log(`[${label}] Found player from page: ${pagePlayer.type} (${pagePlayer.videoId})`);
                    } else {
                        console.log(`[${label}] No player found on page either`);
                    }
                } catch (err) {
                    console.error(`[${label}] Page fetch error:`, err.message);
                }
                continue;
            }

            console.log(`[${label}] Player: ${player.type}, VideoID: ${player.videoId}`);

            // Step 4: Resolve the video URL
            if (player.type === 'hdplayersystem') {
                console.log(`[${label}] Resolving via hdplayersystem...`);
                const videoRes = await axios.post(
                    'https://hdplayersystem.com/player/index.php?data=' + player.videoId + '&do=getVideo',
                    `hash=${player.videoId}&r=${encodeURIComponent(post.link)}`,
                    {
                        headers: {
                            'Referer': 'https://www.dizimom.fit/',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    }
                );
                if (videoRes.data?.securedLink) {
                    console.log(`[${label}] SUCCESS! Video URL: ${videoRes.data.securedLink}`);
                } else {
                    console.log(`[${label}] No securedLink. Response:`, JSON.stringify(videoRes.data).substring(0, 200));
                }
            } else if (player.type === 'hdmomplayer') {
                console.log(`[${label}] hdmomplayer detected: ${player.url}`);
                console.log(`[${label}] This requires Puppeteer resolver (resolveDizimom) - skipping in test`);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
        }
    }
}

// Test cases
testDizimom('Breaking Bad', 1, 1);
