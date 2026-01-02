const axios = require('axios');

// TMDB API Key from environment variable
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

// In-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    if (!TMDB_API_KEY) {
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'TMDB API key yapılandırılmamış' })
        };
    }

    try {
        // Get the TMDB endpoint from query params
        const endpoint = event.queryStringParameters?.endpoint;

        if (!endpoint) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: 'Endpoint gerekli' })
            };
        }

        // Build cache key
        const cacheKey = endpoint;
        const now = Date.now();

        // Check cache
        if (cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (now - cached.timestamp < CACHE_TTL) {
                console.log(`[TMDB Proxy] Cache hit: ${endpoint}`);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(cached.data)
                };
            } else {
                cache.delete(cacheKey);
            }
        }

        // Make request to TMDB
        const separator = endpoint.includes('?') ? '&' : '?';
        const tmdbUrl = `https://api.themoviedb.org/3${endpoint}${separator}api_key=${TMDB_API_KEY}&language=tr-TR`;

        console.log(`[TMDB Proxy] Fetching: ${endpoint}`);

        const response = await axios.get(tmdbUrl, {
            timeout: 10000,
            headers: {
                'Accept': 'application/json'
            }
        });

        // Store in cache
        cache.set(cacheKey, {
            data: response.data,
            timestamp: now
        });

        // Clean old cache entries (keep max 100)
        if (cache.size > 100) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(response.data)
        };

    } catch (error) {
        console.error('[TMDB Proxy] Error:', error.message);

        // If TMDB returns an error, forward it
        if (error.response) {
            return {
                statusCode: error.response.status,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: error.response.data?.status_message || 'TMDB API hatası'
                })
            };
        }

        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Sunucu hatası' })
        };
    }
};
