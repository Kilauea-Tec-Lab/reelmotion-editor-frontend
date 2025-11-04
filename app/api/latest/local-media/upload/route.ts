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
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    
    if (!file || !userId) {
      return NextResponse.json(
        { error: 'File and userId are required' },
        { status: 400 }
      );
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
      warning: isProduction ? 'File stored temporarily and will be deleted after function execution' : undefined
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
