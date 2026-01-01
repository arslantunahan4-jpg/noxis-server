const axios = require('axios');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const { url: targetUrl, referer, origin } = event.queryStringParameters;

  if (!targetUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'URL required' })
    };
  }

  const targetReferer = referer || 'https://www.hdfilmizle.life/';

  try {
    const proxyHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': targetReferer,
      'Origin': new URL(targetReferer).origin
    };

    // Handle Ranges
    if (event.headers.range) {
      proxyHeaders['Range'] = event.headers.range;
    }

    const response = await axios.get(targetUrl, {
      headers: proxyHeaders,
      responseType: 'arraybuffer',
      timeout: 30000,
      validateStatus: () => true
    });

    const responseHeaders = {
      ...headers,
      'Content-Type': response.headers['content-type'] || 'video/mp4',
      'Content-Length': response.headers['content-length'],
      'Accept-Ranges': 'bytes'
    };

    if (response.headers['content-range']) {
      responseHeaders['Content-Range'] = response.headers['content-range'];
    }

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: response.data.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('[VideoProxy] Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
