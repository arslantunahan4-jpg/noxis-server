const axios = require('axios');

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const targetUrl = event.queryStringParameters?.url;

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid URL' })
    };
  }

  try {
    const proxyHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://www.hdfilmizle.life/',
      'Origin': 'https://www.hdfilmizle.life',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site'
    };

    if (event.headers.range) {
      proxyHeaders['Range'] = event.headers.range;
    }

    console.log(`[StreamProxy] Fetching: ${targetUrl}`);

    const response = await axios.get(targetUrl, {
      headers: proxyHeaders,
      timeout: 60000,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      validateStatus: () => true
    });

    const responseHeaders = { ...corsHeaders };
    
    if (response.headers['content-type']) {
      responseHeaders['Content-Type'] = response.headers['content-type'];
    }
    if (response.headers['content-length']) {
      responseHeaders['Content-Length'] = response.headers['content-length'];
    }
    if (response.headers['content-range']) {
      responseHeaders['Content-Range'] = response.headers['content-range'];
    }
    if (response.headers['accept-ranges']) {
      responseHeaders['Accept-Ranges'] = response.headers['accept-ranges'];
    }

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: response.data.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('[StreamProxy] Error:', error.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
