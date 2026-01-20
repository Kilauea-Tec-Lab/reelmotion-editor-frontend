import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
  }

  try {
    // Forward the Range header. This is CRITICAL for video seeking and metadata loading.
    const range = request.headers.get('range');
    
    const headers: HeadersInit = {
      'Accept': '*/*',
    };
    
    if (range) {
      headers['Range'] = range;
    }

    // Fetch from source (Google Cloud Storage)
    const response = await fetch(videoUrl, { 
      headers,
      // Disable internal Next.js caching for large binary files/ranges
      cache: 'no-store', 
    });

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `Failed to fetch video: ${response.status}` },
        { status: response.status }
      );
    }

    const responseHeaders = new Headers();
    
    // Copy essential headers for MP4 playback and streaming
    const headersToPass = [
        'Content-Type',
        'Content-Length',
        'Content-Range',
        'Accept-Ranges',
        'Last-Modified',
        'ETag'
    ];

    headersToPass.forEach((header) => {
        const value = response.headers.get(header);
        if (value) {
            responseHeaders.set(header, value);
        }
    });

    // Fallback if content-type is missing
    if (!responseHeaders.has('Content-Type')) {
        responseHeaders.set('Content-Type', 'video/mp4');
    }

    // CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    
    // STREAM proper: Pass the response body directly instead of buffering it
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy video error:', error);
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 500 });
  }
}

export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
    },
  });
}
