const https = require('https');

const API_KEY = 'db8ab9e44da4236102fadf5d58a08a4b';
const BASE_URL = 'https://api.themoviedb.org/3';

const queries = [
    { name: "1. Crime Mystery (Alt for Crime Thriller)", path: '/discover/tv?with_genres=80,9648' },
    { name: "15. Short Comedy (Strict)", path: '/discover/tv?with_genres=35&with_runtime.lte=30' },
    { name: "16. Short TV (Strict)", path: '/discover/tv?with_runtime.lte=30' }
];

const check = (q) => {
    return new Promise((resolve) => {
        https.get(`${BASE_URL}${q.path}${q.path.includes('?') ? '&' : '?'}api_key=${API_KEY}&language=tr-TR`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ name: q.name, count: json.total_results, sample: json.results ? json.results[0]?.name : 'None', first_runtime: '?' });
                } catch (e) {
                    resolve({ name: q.name, count: 'Error' });
                }
            });
        });
    });
};

(async () => {
    for (const q of queries) {
        const res = await check(q);
        console.log(`${res.name}: ${res.count} results (Sample: ${res.sample})`);
    }
})();
