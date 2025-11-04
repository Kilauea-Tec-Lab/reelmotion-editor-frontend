import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
  }

  try {
    // Obtener los headers de range si existen (importante para video streaming)
    const range = request.headers.get('range');
    
    const headers: HeadersInit = {};
    if (range) {
      headers['Range'] = range;
    }

    const response = await fetch(videoUrl, { headers });

    // Copiar los headers importantes de la respuesta
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', response.headers.get('Content-Type') || 'video/mp4');
    
    if (response.headers.get('Content-Length')) {
      responseHeaders.set('Content-Length', response.headers.get('Content-Length')!);
    }
    
    if (response.headers.get('Content-Range')) {
      responseHeaders.set('Content-Range', response.headers.get('Content-Range')!);
    }
    
    if (response.headers.get('Accept-Ranges')) {
      responseHeaders.set('Accept-Ranges', response.headers.get('Accept-Ranges')!);
    }

    // CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

    const blob = await response.blob();
    
    return new NextResponse(blob, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy video error:', error);
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
    },
  });
}
