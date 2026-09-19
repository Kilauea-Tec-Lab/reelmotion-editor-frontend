"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { LocalMediaFile, Overlay } from "../types";
import { uploadMediaFile, deleteMediaFile, getMediaDuration } from "../utils/media-upload";
import {
  collectLocalSrcs,
  getLocalFile,
  isLocalSrc,
  registerLocalFile,
  releaseLocalFile,
  restoreLocalFiles,
} from "../utils/local-file-store";
import { BackendUpload } from "../hooks/use-editor-auth";
import Cookies from "js-cookie";

export interface MaterializeProgress {
  index: number;
  total: number;
  name: string;
  percentage: number;
}

interface LocalMediaContextType {
  localMediaFiles: LocalMediaFile[];
  addMediaFile: (file: File) => Promise<LocalMediaFile>;
  removeMediaFile: (id: string) => Promise<void>;
  updateMediaFileName: (id: string, newName: string) => void;
  clearMediaFiles: () => Promise<void>;
  /** Upload every `local://` file referenced by the overlays; returns overlays with GCS URLs. */
  materializeOverlays: (
    overlays: Overlay[],
    onProgress?: (progress: MaterializeProgress) => void
  ) => Promise<Overlay[]>;
  isLoading: boolean;
}

const LocalMediaContext = createContext<LocalMediaContextType | undefined>(
  undefined
);

const mediaTypeOf = (file: File): LocalMediaFile["type"] | null => {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
};

/**
 * LocalMediaProvider Component
 *
 * Media the user picks is registered locally (object URL + IndexedDB) and
 * previewed without uploading. Uploads happen in `materializeOverlays`, which
 * export and backend-save call first. Backend uploads are listed alongside.
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
  // Layers resolve `local://` synchronously, so nothing renders until the
  // persisted files are back in memory.
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    restoreLocalFiles().then((restored) => {
      setLocalMediaFiles((prev) => [...restored, ...prev]);
      setIsReady(true);
    });
  }, []);

  const updateMediaFileName = useCallback((id: string, newName: string) => {
    setLocalMediaFiles(prev =>
      prev.map(file =>
        file.id === id ? { ...file, name: newName } : file
      )
    );
  }, []);

  // Backend uploads are the source of truth for everything already uploaded;
  // local (not yet uploaded) entries are kept in front of them.
  useEffect(() => {
    const backendFiles: LocalMediaFile[] = backendUploads.map((upload) => {
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

    setLocalMediaFiles((prev) => [
      ...prev.filter((f) => isLocalSrc(f.path)),
      ...backendFiles,
    ]);
  }, [backendUploads]);

  /**
   * Register a picked file locally. No network: the file is uploaded later by
   * `materializeOverlays`.
   */
  const addMediaFile = useCallback(async (file: File): Promise<LocalMediaFile> => {
    const type = mediaTypeOf(file);
    if (!type) throw new Error("Unsupported file type");
    setIsLoading(true);
    try {
      const duration = await getMediaDuration(file);
      // ponytail: no thumbnail; the gallery renders the object URL directly.
      const media = registerLocalFile(file, {
        name: file.name,
        type,
        size: file.size,
        lastModified: file.lastModified,
        thumbnail: "",
        duration,
      });
      setLocalMediaFiles((prev) => [media, ...prev]);
      return media;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const materializeOverlays = useCallback(
    async (
      overlays: Overlay[],
      onProgress?: (progress: MaterializeProgress) => void
    ): Promise<Overlay[]> => {
      const localSrcs = collectLocalSrcs(overlays);
      if (localSrcs.length === 0) return overlays;

      const urlMap = new Map<string, string>();
      // ponytail: sequential uploads; add a pool of 2 if users stack many clips.
      for (let i = 0; i < localSrcs.length; i++) {
        const src = localSrcs[i];
        const file = getLocalFile(src);
        if (!file) throw new Error(`Local file no longer available: ${src}`);
        const uploaded = await uploadMediaFile(file, (p) =>
          onProgress?.({
            index: i + 1,
            total: localSrcs.length,
            name: file.name,
            percentage: p.percentage,
          })
        );
        urlMap.set(src, uploaded.serverPath);
        setLocalMediaFiles((prev) =>
          prev.map((f) =>
            f.path === src
              ? {
                  ...f,
                  id: uploaded.id,
                  path: uploaded.serverPath,
                  thumbnail: uploaded.thumbnail || f.thumbnail,
                }
              : f
          )
        );
      }
      localSrcs.forEach((src) => releaseLocalFile(src));

      return overlays.map((overlay) => {
        const { src, content } = overlay as { src?: string; content?: string };
        const url = src && urlMap.get(src);
        if (!url) return overlay;
        return { ...overlay, src: url, content: content === src ? url : content } as Overlay;
      });
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

          if (isLocalSrc(fileToRemove.path)) {
            releaseLocalFile(fileToRemove.path);
          } else if (isBackendUpload) {
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
        if (isLocalSrc(file.path)) {
          releaseLocalFile(file.path);
          continue;
        }
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
    materializeOverlays,
    isLoading,
    updateMediaFileName
  };

  return (
    <LocalMediaContext.Provider value={value}>
      {isReady ? children : null}
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
