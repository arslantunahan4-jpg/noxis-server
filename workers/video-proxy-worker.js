
export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
    };

    // Handle OPTIONS request for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    const customReferer = url.searchParams.get('referer');
    const customOrigin = url.searchParams.get('origin');

    if (!targetUrl) {
      return new Response('Missing "url" parameter', { status: 400, headers: corsHeaders });
    }

    try {
      // Prepare headers to spoof the request
      const newHeaders = new Headers();
      
      // Default User-Agent if not provided
      newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Smart Referer Handling
      if (customReferer) {
        newHeaders.set('Referer', customReferer);
      } else if (targetUrl.includes('diziyou')) {
        newHeaders.set('Referer', 'https://storage.diziyou.one/');
      } else if (targetUrl.includes('vidmody')) {
        newHeaders.set('Referer', 'https://vidmody.com/');
      } else if (targetUrl.includes('hdplayersystem.com')) {
        newHeaders.set('Referer', 'https://hdplayersystem.com/');
        newHeaders.set('Origin', 'https://hdplayersystem.com');
      }

      // Smart Origin Handling
      if (customOrigin) {
        newHeaders.set('Origin', customOrigin);
      } else if (targetUrl.includes('diziyou')) {
        newHeaders.set('Origin', 'https://storage.diziyou.one');
      } else if (targetUrl.includes('hdplayersystem.com')) {
        newHeaders.set('Origin', 'https://hdplayersystem.com');
      }

      // Preserve Range header for video seeking support
      const range = request.headers.get('Range');
      if (range) {
        newHeaders.set('Range', range);
      }

      // Fetch from the target server
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: newHeaders,
        redirect: 'follow'
      });

      // Prepare response headers
      const responseHeaders = new Headers(response.headers);
      
      // Ensure CORS headers are present in the response
      Object.keys(corsHeaders).forEach(key => {
        responseHeaders.set(key, corsHeaders[key]);
      });

      // Return the response as a stream
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

    } catch (error) {
      return new Response(`Proxy Error: ${error.message}`, { status: 500, headers: corsHeaders });
    }
  },
};
