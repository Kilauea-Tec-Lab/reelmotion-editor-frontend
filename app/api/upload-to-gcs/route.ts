import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';

// Cache token server-side
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getGCSAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && tokenExpiresAt > now + 60000) {
    return cachedAccessToken;
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL;
  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64 || process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY_BASE64;

  if (!clientEmail || !privateKeyBase64) {
    throw new Error('Missing Google Cloud credentials');
  }

  // Decode from Base64
  const sanitizedBase64 = privateKeyBase64.trim().replace(/^['"]|['"]$/g, '');
  let privateKey = Buffer.from(sanitizedBase64, 'base64').toString('utf-8');

  // Normalize PEM
  privateKey = privateKey.replace(/\r\n/g, '\n').replace(/\\n/g, '\n').trim();

  const pemMatch = privateKey.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  if (!pemMatch) {
    throw new Error('Invalid private key PEM');
  }

  const pemBody = pemMatch[1].replace(/[\r\n\s]/g, '');
  const wrappedBody = pemBody.match(/.{1,64}/g)?.join('\n') ?? pemBody;
  privateKey = `-----BEGIN PRIVATE KEY-----\n${wrappedBody}\n-----END PRIVATE KEY-----\n`;

  // Create JWT
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

  // Exchange JWT for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get access token');
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;

  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const userId = formData.get('userId') as string;

    if (!file || !type || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Determine bucket
    let bucketName: string;
    if (type === '1') {
      bucketName = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_IMAGE || 'reelmotion-ai-images';
    } else if (type === '2') {
      bucketName = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_VIDEO || 'reelmotion-ai-videos';
    } else if (type === '3') {
      bucketName = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_AUDIO || 'reelmotion-ai-audio';
    } else {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop();
    const fileName = `${userId}/${timestamp}-${randomStr}.${extension}`;

    console.log('⚡ Server-side upload to GCS:', { bucketName, fileName, size: file.size });

    // Get access token
    const accessToken = await getGCSAccessToken();

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload directly to GCS (server-side, no CORS issues)
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('GCS upload error:', errorText);
      return NextResponse.json({ error: 'Failed to upload to GCS' }, { status: 500 });
    }

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    console.log('⚡ Upload complete:', publicUrl);

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      fileName: fileName,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, { status: 500 });
  }
}

// Increase body size limit for video uploads
export const config = {
  api: {
    bodyParser: false,
  },
};
