import { NextRequest, NextResponse } from 'next/server';

const FILE_TYPE = {
  IMAGE: 1,
  VIDEO: 2,
  AUDIO: 3
} as const;

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/quicktime', 'video/x-msvideo'];
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/webm'];

function getFileType(mimeType: string): number {
  if (IMAGE_MIME_TYPES.includes(mimeType)) return FILE_TYPE.IMAGE;
  if (VIDEO_MIME_TYPES.includes(mimeType)) return FILE_TYPE.VIDEO;
  if (AUDIO_MIME_TYPES.includes(mimeType)) return FILE_TYPE.AUDIO;
  if (mimeType.startsWith('image/')) return FILE_TYPE.IMAGE;
  if (mimeType.startsWith('video/')) return FILE_TYPE.VIDEO;
  if (mimeType.startsWith('audio/')) return FILE_TYPE.AUDIO;
  throw new Error(`Unsupported file type: ${mimeType}`);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    let fileType: number;
    try {
      fileType = getFileType(file.type);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid file type', message: error instanceof Error ? error.message : 'Unsupported format' }, { status: 400 });
    }

    const maxSize = 512000 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large', message: 'File must be less than 500MB' }, { status: 413 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend.reelmotion.ai';
    const cookieHeader = request.headers.get('cookie');
    let token = '';
    
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      token = cookies['token'] || '';
    }

    const backendFormData = new FormData();
    backendFormData.append('file', file);
    backendFormData.append('type', fileType.toString());

    const backendResponse = await fetch(`${backendUrl}/editor/upload-file`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: backendFormData,
    });

    if (!backendResponse.ok) {
      let errorMessage = 'Backend upload failed';
      try {
        const errorData = await backendResponse.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        errorMessage = await backendResponse.text() || errorMessage;
      }
      return NextResponse.json({ error: 'Upload failed', message: errorMessage }, { status: backendResponse.status });
    }

    const result = await backendResponse.json();
    return NextResponse.json({ success: true, ...result });
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process upload', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
