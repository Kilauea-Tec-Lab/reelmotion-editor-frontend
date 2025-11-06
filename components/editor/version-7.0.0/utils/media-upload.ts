/**
 * Media Upload Utility
 *
 * This utility provides functions for:
 * - Uploading media files to the server
 * - Generating thumbnails
 * - Getting media duration
 */

import { getUserId } from "./user-id";
import { UserMediaItem, addMediaItem } from "./indexdb";
import Cookies from "js-cookie";

/**
 * Uploads a file to the server and stores the reference in IndexedDB
 */
export const uploadMediaFile = async (file: File): Promise<UserMediaItem> => {
  try {
    // Generate thumbnail and get duration
    const thumbnail = await generateThumbnail(file);
    const duration = await getMediaDuration(file);

    // Determine file type
    let fileType: "video" | "image" | "audio";
    if (file.type.startsWith("video/")) {
      fileType = "video";
    } else if (file.type.startsWith("image/")) {
      fileType = "image";
    } else if (file.type.startsWith("audio/")) {
      fileType = "audio";
    } else {
      throw new Error("Unsupported file type");
    }

    // Get user ID and auth token
    const userId = getUserId();
    const token = Cookies.get("token");
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";

    // Create form data for upload
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", fileType === "video" ? "2" : fileType === "image" ? "1" : "3"); // 1=image, 2=video, 3=audio

    // Upload file directly to backend
    const response = await fetch(`${backendUrl}/editor/upload-file`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || "Failed to upload file");
    }

    const responseData = await response.json();
    
    // Check if response has the expected structure
    if (!responseData.upload) {
      throw new Error("Invalid response structure from backend");
    }

    const uploadData = responseData.upload;
    
    // Use backend thumbnail if available, otherwise use generated one
    const finalThumbnail = uploadData.thumbnail_url || thumbnail || "";
    
    // Use backend duration if available, otherwise use generated one
    const finalDuration = uploadData.duration !== null && uploadData.duration !== undefined 
      ? uploadData.duration 
      : duration;

    // Create media item for IndexedDB
    const mediaItem: UserMediaItem = {
      id: uploadData.id,
      userId,
      name: uploadData.file_name || file.name,
      type: fileType,
      serverPath: uploadData.file_url,
      size: file.size, // Backend doesn't return size, use original file size
      lastModified: file.lastModified,
      thumbnail: finalThumbnail,
      duration: finalDuration,
      createdAt: Date.now(),
    };

    // Store in IndexedDB
    await addMediaItem(mediaItem);

    return mediaItem;
  } catch (error) {
    console.error("Error uploading media file:", error);
    throw error;
  }
};

/**
 * Generates a thumbnail for image or video files
 */
export const generateThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve((e.target?.result as string) || "");
      };
      reader.onerror = () => {
        console.error("Error reading image file");
        resolve("");
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";

      // Set timeout to handle cases where video loading hangs
      const timeoutId = setTimeout(() => {
        console.warn("Video thumbnail generation timed out");
        resolve("");
      }, 5000); // 5 second timeout

      video.onloadedmetadata = () => {
        // Set the time to 1 second or the middle of the video
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onloadeddata = () => {
        clearTimeout(timeoutId);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL("image/jpeg");
          resolve(thumbnail);
        } catch (error) {
          console.error("Error generating video thumbnail:", error);
          resolve("");
        } finally {
          URL.revokeObjectURL(video.src);
        }
      };

      video.onerror = () => {
        clearTimeout(timeoutId);
        console.error("Error loading video for thumbnail");
        URL.revokeObjectURL(video.src);
        resolve("");
      };

      video.src = URL.createObjectURL(file);
    } else {
      // For audio files, use a default audio icon
      resolve("");
    }
  });
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
  userId: string,
  filePath: string
): Promise<boolean> => {
  try {
    // Get token from cookies
    const token = Cookies.get("authToken");
    if (!token) {
      throw new Error("Authentication token not found");
    }

    // Delete file directly from backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
    const response = await fetch(`${backendUrl}/api/editor/delete-upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ path: filePath }),
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
