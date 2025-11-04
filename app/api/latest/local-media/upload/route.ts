import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handles media file uploads
 * 
 * This API endpoint:
 * 1. Receives a file and user ID
 * 2. Creates a user directory if it doesn't exist
 * 3. Saves the file to the user's directory
 * 4. Returns the file path and ID
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    
    if (!file || !userId) {
      return NextResponse.json(
        { error: 'File and userId are required' },
        { status: 400 }
      );
    }

    console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Check file size limit (50MB for Netlify functions)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }

    // Check if it's a video file
    const isVideo = file.type.startsWith('video/');
    
    if (isVideo) {
      console.log('Video file detected, applying special handling');
      
      // For videos in production, we should ideally use a different approach
      // like direct upload to cloud storage or streaming upload
      const isProduction = process.env.NODE_ENV === 'production' || process.env.NETLIFY;
      
      if (isProduction) {
        return NextResponse.json(
          { 
            error: 'Video uploads not supported in production environment. Please use direct cloud storage upload.',
            suggestion: 'Consider using Cloudinary, AWS S3, or similar service for video uploads.'
          },
          { status: 501 }
        );
      }
    }

    // Check if we're in production (Netlify)
    const isProduction = process.env.NODE_ENV === 'production' || process.env.NETLIFY;
    
    if (isProduction) {
      // In production, proxy the upload to the backend
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
      
      try {
        // Forward the formData to the backend
        const backendFormData = new FormData();
        backendFormData.append('file', file);
        backendFormData.append('userId', userId);
        
        const backendResponse = await fetch(`${backendUrl}/upload-media`, {
          method: 'POST',
          body: backendFormData,
        });
        
        if (!backendResponse.ok) {
          throw new Error(`Backend upload failed: ${backendResponse.status}`);
        }
        
        const backendResult = await backendResponse.json();
        return NextResponse.json(backendResult);
        
      } catch (backendError) {
        console.error('Backend upload error:', backendError);
        // Fallback to temporary storage if backend fails
      }
    }
    
    // Local development or fallback: use temporary directory
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
    console.log('Converting file to buffer...');
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`Buffer created, size: ${buffer.length}`);
    
    console.log(`Writing file to: ${filePath}`);
    await writeFile(filePath, buffer);
    console.log('File written successfully');
    
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
      warning: isProduction ? 'File stored temporarily and will be deleted after function execution' : undefined
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    
    // More detailed error information
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    };
    
    console.error('Full error details:', errorDetails);
    
    return NextResponse.json(
      { 
        error: 'Failed to upload file', 
        details: errorDetails.message,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown'
      },
      { status: 500 }
    );
  }
}
