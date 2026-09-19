/**
 * Media Upload Utility - OPTIMIZED FOR SPEED
 *
 * This utility provides functions for:
 * - Uploading media files to Google Cloud Storage through /api/upload-to-gcs
 * - XMLHttpRequest for upload progress
 */

import { getUserId } from "./user-id";
import { UserMediaItem, addMediaItem } from "./indexdb";
import Cookies from "js-cookie";

// ============================================
// PROGRESS CALLBACK TYPE
// ============================================
export type UploadProgressCallback = (progress: {
  loaded: number;
  total: number;
  percentage: number;
}) => void;

/**
 * FAST UPLOAD - Uploads a file to GCS with progress tracking
 */
export const uploadMediaFile = async (
  file: File,
  onProgress?: UploadProgressCallback
): Promise<UserMediaItem> => {
  try {
    // Determine file type
    let fileType: "video" | "image" | "audio";
    let typeNumber: number;
    
    if (file.type.startsWith("video/")) {
      fileType = "video";
      typeNumber = 2;
    } else if (file.type.startsWith("image/")) {
      fileType = "image";
      typeNumber = 1;
    } else if (file.type.startsWith("audio/")) {
      fileType = "audio";
      typeNumber = 3;
    } else {
      throw new Error("Unsupported file type");
    }

    // Get user ID and auth token
    const userId = getUserId();
    const token = Cookies.get("token");
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";

    // Extract media duration client-side (fast, uses blob URL)
    const thumbnailUrl = "";
    let duration: number | undefined = undefined;

    if (fileType === "video" || fileType === "audio") {
      try {
        duration = await getMediaDuration(file);
      } catch (err) {
        console.warn("Could not extract media duration:", err);
      }
    }


    // Upload file directly to Google Cloud Storage
    let uploadData;

    // Phase 1: upload to GCS. If this fails, we cannot recover — the file
    // never reached storage, so propagate the error to the UI.
    let gcsUrl: string;
    try {
      gcsUrl = await uploadDirectlyToGCS(file, typeNumber, onProgress);
    } catch (gcsError) {
      console.error("GCS upload failed:", gcsError);
      throw gcsError instanceof Error
        ? gcsError
        : new Error("Failed to upload file to storage");
    }

    const serverPath = gcsUrl;

    // Phase 2: register metadata with the backend. Even if the file is
    // already in GCS, without a backend record it won't appear after a
    // reload — surface the failure so the user can retry.
    try {
      uploadData = await sendMetadataToBackend({
        type: typeNumber,
        fileName: file.name,
        fileUrl: gcsUrl,
        token: token || "",
        backendUrl,
      });
    } catch (metadataError) {
      console.error("Backend metadata save failed:", metadataError);
      throw metadataError instanceof Error
        ? metadataError
        : new Error("Failed to register upload with the server");
    }

    // Create media item for IndexedDB
    const mediaItem: UserMediaItem = {
      id: uploadData.id,
      userId,
      name: uploadData.file_name || file.name,
      type: fileType,
      serverPath: serverPath,
      size: file.size,
      lastModified: file.lastModified,
      thumbnail: uploadData.thumbnail_url || thumbnailUrl || "",
      duration: uploadData.duration !== null && uploadData.duration !== undefined 
        ? parseFloat(uploadData.duration.toString()) 
        : duration,
      createdAt: Date.now(),
    };

    // Store in IndexedDB (non-blocking — backend is source of truth)
    try {
      await addMediaItem(mediaItem);
    } catch (indexDbError) {
      console.warn("IndexedDB storage failed (non-critical):", indexDbError);
    }

    return mediaItem;
  } catch (error) {
    console.error("Error uploading media file:", error);
    throw error;
  }
};

/**
 * FAST Upload via Next.js API Proxy (NO CORS ISSUES!)
 * - Uploads through /api/upload-to-gcs which handles GCS server-side
 * - No CORS problems because it's same-origin
 * - Progress tracking via XMLHttpRequest
 */
const uploadDirectlyToGCS = async (
  file: File, 
  type: number,
  onProgress?: UploadProgressCallback
): Promise<string> => {
  try {
    const userId = getUserId();
    

    // Create FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type.toString());
    formData.append('userId', userId);

    // Upload via Next.js API route (same origin = no CORS)
    const result = await new Promise<{ url: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: percentage,
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success && response.url) {
              resolve({ url: response.url });
            } else {
              reject(new Error(response.error || 'Upload failed'));
            }
          } catch {
            reject(new Error('Invalid response from server'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      // POST to our API route (same origin!)
      xhr.open('POST', '/api/upload-to-gcs');
      xhr.setRequestHeader('Authorization', `Bearer ${Cookies.get('token') ?? ''}`);
      xhr.send(formData);
    });

    return result.url;
    
  } catch (error) {
    console.error("Error uploading:", error);
    throw error;
  }
};

/**
 * Send minimal data to backend (fast upload - only required fields)
 * Backend only receives: type, file_name, file_url
 * user_id is extracted from the auth token on the backend
 */
const sendMetadataToBackend = async (
  options: {
    type: number;
    fileName: string;
    fileUrl: string;
    token: string;
    backendUrl: string;
  }
): Promise<any> => {
  const response = await fetch(`${options.backendUrl}/editor/upload-file`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${options.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: options.type,
      file_name: options.fileName,
      file_url: options.fileUrl,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.message || "Failed to save metadata to backend");
  }

  const responseData = await response.json();

  
  if (!responseData.upload) {
    console.error("Invalid response structure. Expected 'upload' field but got:", responseData);
    throw new Error("Invalid response structure from backend");
  }

  return responseData.upload;
};

/**
 * Gets the duration of a media file
 */
export const getMediaDuration = async (
  file: File
): Promise<number | undefined> => {
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
    return new Promise((resolve) => {
      const media = file.type.startsWith("audio/")
        ? document.createElement("audio")
        : document.createElement("video");

      // Set timeout to handle cases where media loading hangs
      const timeoutId = setTimeout(() => {
        console.warn("Media duration detection timed out");
        URL.revokeObjectURL(media.src);
        resolve(undefined);
      }, 5000); // 5 second timeout

      media.preload = "metadata";
      media.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        resolve(media.duration);
        URL.revokeObjectURL(media.src);
      };
      media.onerror = () => {
        clearTimeout(timeoutId);
        console.error("Error getting media duration");
        URL.revokeObjectURL(media.src);
        resolve(undefined);
      };
      media.src = URL.createObjectURL(file);
    });
  }
  return undefined;
};

/**
 * Deletes a media file from the server
 */
export const deleteMediaFile = async (
  _userId: string,
  uploadId: string
): Promise<boolean> => {
  try {
    // Get token from cookies (same as upload)
    const token = Cookies.get("token");
    if (!token) {
      console.warn("No authentication token found, attempting delete without auth");
    }

    // Delete file directly from backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
    const response = await fetch(`${backendUrl}/editor/delete-upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: uploadId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete file");
    }

    return true;
  } catch (error) {
    console.error("Error deleting media file:", error);
    return false;
  }
};
