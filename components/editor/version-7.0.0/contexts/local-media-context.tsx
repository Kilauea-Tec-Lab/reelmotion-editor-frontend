"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { LocalMediaFile } from "../types";
import { getUserId } from "../utils/user-id";
import {
  getUserMediaItems,
  deleteMediaItem as deleteFromIndexDB,
  clearUserMedia,
} from "../utils/indexdb";
import { uploadMediaFile, deleteMediaFile } from "../utils/media-upload";
import { BackendUpload } from "../hooks/use-editor-auth";
import Cookies from "js-cookie";

interface LocalMediaContextType {
  localMediaFiles: LocalMediaFile[];
  addMediaFile: (file: File) => Promise<LocalMediaFile | void>;
  removeMediaFile: (id: string) => Promise<void>;
  clearMediaFiles: () => Promise<void>;
  isLoading: boolean;
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
  const [userId] = useState(() => getUserId());

  // Load saved media files from IndexedDB and merge with backend uploads
  useEffect(() => {
    const loadMediaFiles = async () => {
      try {
        setIsLoading(true);
        let indexDBFiles: LocalMediaFile[] = [];
        
        // Try to load from IndexedDB, but don't fail if it's not available
        try {
          const mediaItems = await getUserMediaItems(userId);
          
          // Convert IndexedDB items to LocalMediaFile format
          indexDBFiles = mediaItems.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            path: item.serverPath,
            size: item.size,
            lastModified: item.lastModified,
            thumbnail: item.thumbnail,
            duration: item.duration,
          }));
        } catch (indexDBError) {
          console.warn("IndexedDB not available, loading only backend uploads:", indexDBError);
          // Continue without IndexedDB files
        }

        // Convert backend uploads to LocalMediaFile format
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

        // Merge files, preferring IndexedDB files if there's a duplicate ID
        const mergedFiles = [...indexDBFiles];
        backendFiles.forEach((backendFile) => {
          const exists = mergedFiles.some((file) => file.id === backendFile.id);
          if (!exists) {
            mergedFiles.push(backendFile);
          }
        });

        setLocalMediaFiles(mergedFiles);
      } catch (error) {
        console.error("Error loading media files:", error);
        // Even if everything fails, at least show backend uploads
        try {
          const backendFiles: LocalMediaFile[] = backendUploads.map((upload) => {
            let typeString: "image" | "video" | "audio" = "image";
            if (upload.type === 2) typeString = "video";
            else if (upload.type === 3) typeString = "audio";

            return {
              id: upload.id,
              name: upload.file_name,
              type: typeString,
              path: upload.file_url,
              size: 0,
              lastModified: new Date(upload.created_at).getTime(),
              thumbnail: upload.thumbnail_url || "",
              duration: upload.duration ? parseFloat(upload.duration) : undefined,
            };
          });
          setLocalMediaFiles(backendFiles);
        } catch {
          // Last resort: empty array
          setLocalMediaFiles([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadMediaFiles();
  }, [userId, backendUploads]);

  /**
   * Add a new media file to the collection
   */
  const addMediaFile = useCallback(
    async (file: File): Promise<LocalMediaFile | void> => {
      setIsLoading(true);
      try {
        // Upload file to server and store in IndexedDB
        const mediaItem = await uploadMediaFile(file);

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

        // Update state with the new media file
        setLocalMediaFiles((prev) => {
          // Check if file with same ID already exists
          const exists = prev.some((item) => item.id === newMediaFile.id);
          if (exists) {
            // Replace existing file
            return prev.map((item) =>
              item.id === newMediaFile.id ? newMediaFile : item
            );
          }
          // Add new file
          return [...prev, newMediaFile];
        });

        return newMediaFile;
      } catch (error) {
        console.error("Error adding media file:", error);
        throw error;
      } finally {
        setIsLoading(false);
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
            await deleteMediaFile(userId, fileToRemove.id);

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
    [localMediaFiles, userId, backendUploads]
  );

  /**
   * Clear all media files
   */
  const clearMediaFiles = useCallback(async (): Promise<void> => {
    try {
      const token = Cookies.get("token");

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";

      // Delete all files
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
          
          // Check if the backend returned success (code: 200)
          if (data.code !== 200) {
            console.error("Failed to delete upload:", data.message);
          }
        } else {
          // Delete from local server
          await deleteMediaFile(userId, file.id);
        }
      }

      // Clear IndexedDB
      await clearUserMedia(userId);

      // Update state
      setLocalMediaFiles([]);
    } catch (error) {
      console.error("Error clearing media files:", error);
    }
  }, [localMediaFiles, userId, backendUploads]);

  const value = {
    localMediaFiles,
    addMediaFile,
    removeMediaFile,
    clearMediaFiles,
    isLoading,
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
