"use client";

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import ReactVideoEditor from '@/components/editor/version-7.0.0/react-video-editor';

export default function TokenEditorPage() {
  const params = useParams();
  const token = params.token as string;

  useEffect(() => {
    // Log the token for debugging
    console.log('Editor accessed with token:', token);
  }, [token]);

  // Decode the token if it's URL encoded
  const decodedToken = decodeURIComponent(token);
  
  // Validate token format (should be like "1005|uuid")
  const isValidTokenFormat = decodedToken && /^\d+\|[a-zA-Z0-9]+$/.test(decodedToken);
  
  if (!isValidTokenFormat) {
    window.location.href =
      process.env.NEXT_PUBLIC_REELMOTION_URL || "https://reelmotion.ai";
    return null;
  }

  return <ReactVideoEditor projectId="default" />;
}