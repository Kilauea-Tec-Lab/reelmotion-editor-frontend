"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { LocalMediaFile } from "../types";
import { uploadMediaFile, deleteMediaFile, UploadProgressCallback } from "../utils/media-upload";
import { BackendUpload } from "../hooks/use-editor-auth";
import Cookies from "js-cookie";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface LocalMediaContextType {
  localMediaFiles: LocalMediaFile[];
  addMediaFile: (file: File, onProgress?: UploadProgressCallback) => Promise<LocalMediaFile | void>;
  removeMediaFile: (id: string) => Promise<void>;
  updateMediaFileName: (id: string, newName: string) => void;
  clearMediaFiles: () => Promise<void>;
  isLoading: boolean;
  uploadProgress: UploadProgress | null;
}

const LocalMediaContext = createContext<LocalMediaContextType | undefined>(
  undefined
);

/**
 * LocalMediaProvider Component
 *
 * Provides context for managing local media files uploaded by the user.
 * Handles:
 * - Storing and retrieving local media files from IndexedDB and server
 * - Adding new media files
 * - Removing media files
 * - Update media files names
 * - Persisting media files between sessions
 * - Loading backend uploads from the API
 */
export const LocalMediaProvider: React.FC<{ 
  children: React.ReactNode;
  backendUploads?: BackendUpload[];
}> = ({
  children,
  backendUploads = [],
}) => {
  const [localMediaFiles, setLocalMediaFiles] = useState<LocalMediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  
  const updateMediaFileName = useCallback((id: string, newName: string) => {
    setLocalMediaFiles(prev => 
      prev.map(file => 
        file.id === id ? { ...file, name: newName } : file
      )
    );
  }, []);

  // Load media files ONLY from backend - no IndexedDB cache
  useEffect(() => {
    const loadMediaFiles = async () => {
      try {
        setIsLoading(true);

        // Convert backend uploads to LocalMediaFile format (SINGLE SOURCE OF TRUTH)
        const backendFiles: LocalMediaFile[] = backendUploads.map((upload) => {
          // Determine type string from type number
          let typeString: "image" | "video" | "audio" = "image";
          if (upload.type === 2) typeString = "video";
          else if (upload.type === 3) typeString = "audio";

          return {
            id: upload.id,
            name: upload.file_name,
            type: typeString,
            path: upload.file_url,
            size: 0, // Backend doesn't provide size, but it's not critical
            lastModified: new Date(upload.created_at).getTime(),
            thumbnail: upload.thumbnail_url || "",
            duration: upload.duration ? parseFloat(upload.duration) : undefined,
          };
        });

        // Sort by lastModified: newest first
        backendFiles.sort((a, b) => b.lastModified - a.lastModified);

        setLocalMediaFiles(backendFiles);
      } catch (error) {
        console.error("Error loading media files:", error);
        setLocalMediaFiles([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMediaFiles();
  }, [backendUploads]);

  /**
   * Add a new media file to the collection
   * OPTIMIZED: Now with progress tracking
   */
  const addMediaFile = useCallback(
    async (file: File, onProgress?: UploadProgressCallback): Promise<LocalMediaFile | void> => {
      setIsLoading(true);
      setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });
      
      try {
        // Upload file to server with progress tracking
        const mediaItem = await uploadMediaFile(file, (progress) => {
          setUploadProgress(progress);
          if (onProgress) onProgress(progress);
        });

        // Convert to LocalMediaFile format
        const newMediaFile: LocalMediaFile = {
          id: mediaItem.id,
          name: mediaItem.name,
          type: mediaItem.type,
          path: mediaItem.serverPath,
          size: mediaItem.size,
          lastModified: mediaItem.lastModified,
          thumbnail: mediaItem.thumbnail || "",
          duration: mediaItem.duration,
        };

        // Update state with the new media file (add at the beginning - newest first)
        setLocalMediaFiles((prev) => {
          // Check if file with same ID already exists
          const exists = prev.some((item) => item.id === newMediaFile.id);
          if (exists) {
            // Replace existing file
            return prev.map((item) =>
              item.id === newMediaFile.id ? newMediaFile : item
            );
          }
          // Add new file at the beginning (newest first)
          return [newMediaFile, ...prev];
        });

        return newMediaFile;
      } catch (error) {
        console.error("Error adding media file:", error);
        throw error;
      } finally {
        setIsLoading(false);
        setUploadProgress(null);
      }
    },
    []
  );

  /**
   * Remove a media file by ID
   */
  const removeMediaFile = useCallback(
    async (id: string): Promise<void> => {
      try {
        const fileToRemove = localMediaFiles.find((file) => file.id === id);

        if (fileToRemove) {
          // Check if this is a backend upload (from backendUploads list)
          const isBackendUpload = backendUploads.some((upload) => upload.id === id);

          if (isBackendUpload) {
            // Delete from backend using the delete-upload endpoint
            const token = Cookies.get("token");

            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
            
            const response = await fetch(`${backendUrl}/editor/delete-upload`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ id }),
            });

            const data = await response.json();
            
            // Check if the backend returned success (code: 200)
            if (data.code !== 200) {
              throw new Error(data.message || "Failed to delete backend upload");
            }
          } else {
            // Delete from local server (old uploads)
            await deleteMediaFile("", fileToRemove.id);

            // Delete from IndexedDB
            await deleteFromIndexDB(id);
          }

          // Update state
          setLocalMediaFiles((prev) => prev.filter((file) => file.id !== id));
        }
      } catch (error) {
        console.error("Error removing media file:", error);
        throw error;
      }
    },
    [localMediaFiles, backendUploads]
  );

  /**
   * Clear all media files
   */
  const clearMediaFiles = useCallback(async (): Promise<void> => {
    try {
      const token = Cookies.get("token");
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";

      // Delete all backend files
      for (const file of localMediaFiles) {
        const isBackendUpload = backendUploads.some((upload) => upload.id === file.id);

        if (isBackendUpload) {
          // Delete from backend
          const response = await fetch(`${backendUrl}/editor/delete-upload`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id: file.id }),
          });

          const data = await response.json();
          
          if (data.code !== 200) {
            console.error("Failed to delete upload:", data.message);
          }
        }
      }

      // Update state
      setLocalMediaFiles([]);
    } catch (error) {
      console.error("Error clearing media files:", error);
    }
  }, [localMediaFiles, backendUploads]);

  const value = {
    localMediaFiles,
    addMediaFile,
    removeMediaFile,
    clearMediaFiles,
    isLoading,
    uploadProgress,
    updateMediaFileName
  };

  return (
    <LocalMediaContext.Provider value={value}>
      {children}
    </LocalMediaContext.Provider>
  );
};

/**
 * Hook to use the local media context
 */
export const useLocalMedia = () => {
  const context = useContext(LocalMediaContext);
  if (context === undefined) {
    throw new Error("useLocalMedia must be used within a LocalMediaProvider");
  }
  return context;
};
