import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';
import fs from 'fs';
import path from 'path';

// Helper to get Access Token (Reused logic)
async function getGCSAccessToken(): Promise<string> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL;
  // Handle both escaped newlines and literal newlines in the key
  let privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64 || process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY_BASE64;
  
  if (!clientEmail || !privateKeyBase64) {
    throw new Error('Missing Google Cloud credentials');
  }

  // Remove quotes if present
  const sanitizedBase64 = privateKeyBase64.trim().replace(/^['"]|['"]$/g, '');
  let privateKey = Buffer.from(sanitizedBase64, 'base64').toString('utf-8');

  // Normalize PEM format
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
     throw new Error('Invalid Private Key Format after decoding');
  }
  
  // Fix newlines if they are escaped literal "\n" strings
  privateKey = privateKey.replace(/\\n/g, '\n');

  const nowSec = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKey, 'RS256');

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/devstorage.full_control',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(nowSec)
    .setIssuer(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setExpirationTime(nowSec + 3600)
    .sign(key);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token Error:', error);
    throw new Error('Failed to get access token');
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrl, userId = "anonymous" } = body;

    if (!videoUrl) {
      return NextResponse.json({ error: 'Missing videoUrl' }, { status: 400 });
    }

    // Extract filename from URL
    // Expected URL format: https://editor.reelmotion.ai/rendered-videos/filename.mp4
    // or just path /rendered-videos/filename.mp4
    const urlParts = videoUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Security check: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.mp4')) {
         return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const VIDEOS_DIR = path.join(process.cwd(), 'public', 'rendered-videos');
    const filePath = path.join(VIDEOS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
    }

    // Prepare for upload
    const bucketName = process.env.NEXT_PUBLIC_GCS_RENDERED_VIDEOS_BUCKET || "remotioncloudrun-buaw10zfzk";
    // Organize by userId or date
    const gcsPath = `exported-videos/${userId}/${filename}`;
    
    // Read file
    const fileContent = fs.readFileSync(filePath);
    const fileSize = fs.statSync(filePath).size;

    // Get Token
    const accessToken = await getGCSAccessToken();

    // Upload to GCS
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(gcsPath)}`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'video/mp4',
        'Content-Length': fileSize.toString(),
      },
      body: fileContent,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('GCS Upload Error:', errorText);
      throw new Error(`Failed to upload to GCS: ${uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`;

    // Delete local file
    try {
      fs.unlinkSync(filePath);
      console.log(`Deleted local file: ${filePath}`);
    } catch (err) {
      console.error('Failed to delete local file:', err);
      // Continue even if delete fails, as upload succeeded
    }

    return NextResponse.json({ 
      success: true, 
      gcsUrl: publicUrl,
      originalName: filename
    });

  } catch (error: any) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
