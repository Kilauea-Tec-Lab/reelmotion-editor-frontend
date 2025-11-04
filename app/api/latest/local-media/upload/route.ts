import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handles media file uploads with local URL generation for videos
 * 
 * This API endpoint:
 * 1. For videos: Returns local blob URL info (no file upload)
 * 2. For images/audio: Uploads to server as before
 */

// File size limits
const MAX_FILE_SIZE_NETLIFY = 5 * 1024 * 1024; // 5MB

// Video file types that should use local URLs
const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/avi',
  'video/mov',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/3gpp'
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const useLocalUrl = formData.get('useLocalUrl') as string; // Optional flag
    
    if (!file || !userId) {
      return NextResponse.json(
        { error: 'File and userId are required' },
        { status: 400 }
      );
    }

    const isVideo = VIDEO_MIME_TYPES.includes(file.type);
    const isProduction = process.env.NODE_ENV === 'production' || process.env.NETLIFY;
    
    // For videos or when explicitly requested, return local URL info
    if (isVideo || useLocalUrl === 'true') {
      const fileId = uuidv4();
      
      return NextResponse.json({
        success: true,
        id: fileId,
        fileName: file.name,
        size: file.size,
        type: file.type,
        isLocalFile: true,
        localFileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        },
        message: 'File will be accessed locally from user\'s computer',
      });
    }

    // For non-video files (images, audio), handle upload normally
    if (isProduction && file.size > MAX_FILE_SIZE_NETLIFY) {
      // Try backend upload for large non-video files
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
      
      try {
        console.log(`Uploading large file to backend:`, file.name, `${(file.size / 1024 / 1024).toFixed(2)}MB`);
        
        const backendFormData = new FormData();
        backendFormData.append('file', file);
        backendFormData.append('userId', userId);
        
        const backendResponse = await fetch(`${backendUrl}/upload-media`, {
          method: 'POST',
          body: backendFormData,
          signal: AbortSignal.timeout(30000) // 30 seconds
        });
        
        if (!backendResponse.ok) {
          const errorText = await backendResponse.text();
          throw new Error(`Backend upload failed: ${backendResponse.status} - ${errorText}`);
        }
        
        const backendResult = await backendResponse.json();
        return NextResponse.json({
          ...backendResult,
          uploadMethod: 'backend'
        });
        
      } catch (backendError) {
        console.error('Backend upload error:', backendError);
        
        return NextResponse.json({
          error: 'File too large for direct upload',
          message: 'Large files must be uploaded through the backend service.',
          maxSize: `${MAX_FILE_SIZE_NETLIFY / 1024 / 1024}MB`,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
        }, { status: 413 });
      }
    }
    
    // Handle small files locally (images, small audio files)
    console.log(`Processing small file locally:`, file.name, `${(file.size / 1024 / 1024).toFixed(2)}MB`);
    
    const baseDir = isProduction ? '/tmp' : path.join(process.cwd(), 'public');
    const userDir = path.join(baseDir, 'users', userId);
    
    if (!existsSync(userDir)) {
      await mkdir(userDir, { recursive: true });
    }
    
    // Generate a unique filename
    const fileId = uuidv4();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${fileId}.${fileExtension}`;
    const filePath = path.join(userDir, fileName);
    
    // Convert file to buffer and save it
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);
    
    // Return the file information
    const publicPath = isProduction 
      ? `/tmp/users/${userId}/${fileName}` 
      : `/users/${userId}/${fileName}`;
    
    return NextResponse.json({
      success: true,
      id: fileId,
      fileName: file.name,
      serverPath: publicPath,
      size: file.size,
      type: file.type,
      uploadMethod: 'local_server',
      isLocalFile: false,
      warning: isProduction ? 'File stored temporarily and will be deleted after function execution' : undefined
    });
    
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process file', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
