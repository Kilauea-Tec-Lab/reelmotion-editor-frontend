"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

export interface BackendUpload {
  id: string;
  user_id: string;
  type: number; // 1=image, 2=video, 3=audio
  file_name: string;
  file_url: string;
  width: string | null;
  height: string | null;
  duration: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectVoice {
  id: string;
  name: string;
  description: string;
  audio_url: string;
}

interface EditorData {
  code: number;
  projects: any[];
  voices: any[];
  edits: any[];
  videos: any[];
  uploads?: BackendUpload[];
  project_voices?: ProjectVoice[];
}

interface UseEditorAuthResult {
  isLoading: boolean;
  isAuthorized: boolean;
  editorData: EditorData | null;
  error: string | null;
  updateAudioName: (id: string, newName: string) => void;
}

/**
 * Custom hook to validate editor access and fetch initial data
 * Checks authentication via backend API and redirects if unauthorized
 */
export const useEditorAuth = (): UseEditorAuthResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [editorData, setEditorData] = useState<EditorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const updateAudioName = (id: string, newName: string) => {
    if (!editorData?.project_voices) return;

    setEditorData(prev => {
      if (!prev || !prev.project_voices) return prev;
      
      return {
        ...prev,
        project_voices: prev.project_voices.map(voice => 
          voice.id === id ? { ...voice, name: newName } : voice
        )
      };
    });
  };

  useEffect(() => {
    const validateAccess = async () => {
      try {
        setIsLoading(true);
        
        let tokenToUse = null;
        
        // First, check if there's a UUID in the URI
        const currentPath = window.location.pathname;
        // Match pattern like /1005|uuid or /1005%7Cuuid (URL encoded)
        const uuidMatch = currentPath.match(/^\/(.+)$/);
        
        if (uuidMatch) {
          // Found token in URI, decode and validate it
          const rawToken = uuidMatch[1];
          const decodedToken = decodeURIComponent(rawToken);
          
          // Check if it matches the expected format: numbers|alphanumeric
          if (/^\d+\|[a-zA-Z0-9]+$/.test(decodedToken)) {
            console.log("Valid UUID found in URI:", decodedToken);
            tokenToUse = decodedToken;
          } else {
            console.log("Invalid token format in URI:", decodedToken);
          }
        }
        
        if (!tokenToUse) {
          // No valid UUID in URI, try to get token from cookies
          const cookieToken = Cookies.get("token");
          console.log("Token from cookies:", cookieToken);
          tokenToUse = cookieToken;
        }
        
        if (!tokenToUse) {
          // No token found anywhere
        window.location.href =
          process.env.NEXT_PUBLIC_REELMOTION_URL || "https://reelmotion.ai";
          return;
        }

        // Make request to backend with Bearer token
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
        const response = await fetch(`${backendUrl}/editor/get-info-to-edit`, {
          headers: {
            Authorization: "Bearer " + tokenToUse,
          },
        });

        // Check if response is ok
        if (!response.ok) {
        window.location.href =
          process.env.NEXT_PUBLIC_REELMOTION_URL || "https://reelmotion.ai";
        }

        const data: EditorData = await response.json();

        // Validate response structure
        if (data.code === 200) {
          // Valid response, user is authorized
          setIsAuthorized(true);
          setEditorData(data);
          
          // If we used UUID from URI and it worked, save it as token in cookies
          if (uuidMatch && /^\d+\|[a-zA-Z0-9]+$/.test(tokenToUse)) {
            Cookies.set("token", tokenToUse);
            console.log("UUID validated and saved as token:", tokenToUse);
          }
        } else {
          // Invalid response structure
          console.log("Invalid response structure, code:", data.code);

                  window.location.href =
          process.env.NEXT_PUBLIC_REELMOTION_URL || "https://reelmotion.ai";
        }
      } catch (err) {
        console.error("Editor auth error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        
        // On error, redirect to main site
        window.location.href =
          process.env.NEXT_PUBLIC_REELMOTION_URL || "https://reelmotion.ai";
      } finally {
        setIsLoading(false);
      }
    };

    validateAccess();
  }, [router]);

  return {
    isLoading,
    isAuthorized,
    editorData,
    error,
    updateAudioName
  };
};
