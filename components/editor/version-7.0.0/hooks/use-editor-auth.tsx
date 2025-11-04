"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

interface EditorData {
  code: number;
  projects: any[];
  voices: any[];
  edits: any[];
  videos: any[];
}

interface UseEditorAuthResult {
  isLoading: boolean;
  isAuthorized: boolean;
  editorData: EditorData | null;
  error: string | null;
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

  useEffect(() => {
    const validateAccess = async () => {
      try {
        setIsLoading(true);
        
        // Get token from cookies
        const token = Cookies.get("token");

        console.log(token, "token");
        
        if (!token) {
          // No token found, redirect to main site
          /*window.location.href =
            process.env.NEXT_PUBLIC_REELMOTION_URL || "https://reelmotion.ai";*/
          return;
        }

        // Make request to backend with Bearer token
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
        const response = await fetch(`${backendUrl}/editor/get-info-to-edit`, {
          headers: {
            Authorization: "Bearer " + token,
          },
        });

        // Check if response is ok
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: EditorData = await response.json();

        // Validate response structure
        if (data.code === 200) {
          // Valid response, user is authorized
          setIsAuthorized(true);
          setEditorData(data);
        } else {
          // Invalid response structure, redirect
          /*window.location.href =
            process.env.NEXT_PUBLIC_REELMOTION_URL || "https://reelmotion.ai";*/
            console.log("pedo 1");
        }
      } catch (err) {
        console.error("Editor auth error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        
        // On error, redirect to main site
        /*window.location.href =
          process.env.NEXT_PUBLIC_REELMOTION_URL || "https://reelmotion.ai";*/
          console.log("pedo 2");
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
  };
};
