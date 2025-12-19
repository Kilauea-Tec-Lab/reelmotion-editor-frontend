/**
 * Media Upload Utility
 *
 * This utility provides functions for:
 * - Uploading media files directly to Google Cloud Storage
 * - Generating thumbnails
 * - Getting media duration
 */

import { getUserId } from "./user-id";
import { UserMediaItem, addMediaItem } from "./indexdb";
import Cookies from "js-cookie";
import { SignJWT, importPKCS8 } from "jose";

/**
 * Uploads a file to the server and stores the reference in IndexedDB
 */
export const uploadMediaFile = async (file: File): Promise<UserMediaItem> => {
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

    // Extract metadata based on file type
    let thumbnailUrl = "";
    let duration: number | undefined;
    let width = 0;
    let height = 0;

    if (fileType === "video") {
      // Get video metadata (non-blocking)
      try {
        console.log("Extracting video metadata...");
        const metadata = await getVideoMetadata(file);
        duration = metadata.duration;
        width = metadata.width;
        height = metadata.height;
        console.log("Video metadata extracted:", { duration, width, height });
      } catch (error) {
        console.warn("Failed to extract video metadata, continuing without it:", error);
        // Continue without metadata - upload will still work
      }

      // Extract thumbnail (non-blocking)
      try {
        console.log("Extracting video thumbnail...");
        thumbnailUrl = await extractAndUploadVideoThumbnail(file, token || "");
        console.log("Video thumbnail extracted and uploaded:", thumbnailUrl);
      } catch (error) {
        console.warn("Failed to extract video thumbnail, continuing without it:", error);
        // Continue without thumbnail
      }
    } else if (fileType === "image") {
      // Get image dimensions
      const metadata = await getImageMetadata(file);
      width = metadata.width;
      height = metadata.height;
    } else if (fileType === "audio") {
      // Get audio duration
      try {
        const audioDuration = await getAudioDuration(file);
        duration = audioDuration;
        console.log("Audio duration extracted:", duration, "seconds");
        if (!duration || isNaN(duration)) {
          console.warn("Invalid audio duration:", duration);
          duration = undefined;
        }
      } catch (error) {
        console.warn("Failed to extract audio duration:", error);
        duration = undefined;
      }
    }

    // Upload file directly to Google Cloud Storage
    let uploadData;
    let serverPath: string;
    
    try {
      // Upload directly to GCS
      const gcsUrl = await uploadDirectlyToGCS(file, typeNumber);
      serverPath = gcsUrl;
      
      // Debug: log metadata before sending
      console.log("Sending metadata to backend:", {
        type: typeNumber,
        fileName: file.name,
        fileUrl: gcsUrl,
        width,
        height,
        duration,
        thumbnailUrl,
      });
      
      // Send metadata to backend
      uploadData = await sendMetadataToBackend({
        type: typeNumber,
        fileName: file.name,
        fileUrl: gcsUrl,
        width,
        height,
        duration: duration !== undefined ? duration : null,
        thumbnailUrl: thumbnailUrl || null,
        token: token || "",
        backendUrl,
      });
      
    } catch (error) {
      console.warn("GCS upload failed, using local storage as fallback:", error);
      
      // Fallback: Use local blob URL (development mode)
      const reader = new FileReader();
      serverPath = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve((e.target?.result as string) || "");
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });
      
      // Generate a temporary ID
      uploadData = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file_name: file.name,
        file_url: serverPath,
        type: typeNumber,
        width,
        height,
        duration: duration || null,
        thumbnail_url: thumbnailUrl || null,
      };
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

    // Store in IndexedDB
    await addMediaItem(mediaItem);

    return mediaItem;
  } catch (error) {
    console.error("Error uploading media file:", error);
    throw error;
  }
};

/**
 * Upload file directly to Google Cloud Storage using service account credentials
 */
const uploadDirectlyToGCS = async (file: File, type: number): Promise<string> => {
  try {
    // Get bucket name based on type
    let bucketName: string;
    if (type === 1) {
      bucketName = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_IMAGE || process.env.GCS_BUCKET_NAME_IMAGE || "reelmotion-ai-images";
    } else if (type === 2) {
      bucketName = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_VIDEO || process.env.GCS_BUCKET_NAME_VIDEO || "reelmotion-ai-videos";
    } else if (type === 3) {
      bucketName = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_AUDIO || process.env.GCS_BUCKET_NAME_AUDIO || "reelmotion-ai-audio";
    } else {
      throw new Error("Invalid file type");
    }

    // Generate unique filename
    const userId = getUserId();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop();
    const fileName = `${userId}/${timestamp}-${randomStr}.${extension}`;

    console.log("Uploading to GCS:", { bucketName, fileName });

    // Get access token
    const accessToken = await getGoogleCloudAccessToken();

    // Upload to GCS
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("GCS upload error:", errorText);
      throw new Error(`Failed to upload to GCS: ${uploadResponse.status}`);
    }

    console.log("File uploaded successfully to GCS");

    // NOTE: Do not call the object ACL endpoint here.
    // Many buckets are configured with "uniform bucket-level access" which disables object ACLs,
    // causing noisy 400 errors in the browser even though the upload succeeded.
    // Public access (if desired) should be managed via bucket IAM/policies.

    // Return public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    console.log("Public URL:", publicUrl);
    return publicUrl;
    
  } catch (error) {
    console.error("Error uploading to GCS:", error);
    throw error;
  }
};

/**
 * Get Google Cloud access token using service account credentials
 */
const getGoogleCloudAccessToken = async (): Promise<string> => {
  try {
    const clientEmail = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
    
    // Try Base64 encoded key first (for Netlify), then raw key (for local dev)
    let privateKey: string;
    const privateKeyBase64 = process.env.GOOGLE_CLOUD_PRIVATE_KEY_BASE64 || 
                             process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY_BASE64;
    const privateKeyRaw = process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;

    if (privateKeyBase64) {
      // Decode from Base64 (for Netlify)
      console.log("Using Base64 encoded private key");
      privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
    } else if (privateKeyRaw) {
      // Use raw key with newline replacement (for local dev)
      console.log("Using raw private key with newline replacement");
      privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    } else {
      throw new Error("Missing Google Cloud private key");
    }

    if (!clientEmail) {
      throw new Error("Missing Google Cloud client email");
    }

    // Validate private key format
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.error('Invalid key format. Key starts with:', privateKey.substring(0, 50));
      throw new Error('Invalid private key format after decoding');
    }

    console.log('Private key validated successfully');

    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    
    // Import private key
    const key = await importPKCS8(privateKey, "RS256");
    
    // Create and sign JWT
    const jwt = await new SignJWT({
      scope: "https://www.googleapis.com/auth/devstorage.full_control",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt(now)
      .setIssuer(clientEmail)
      .setAudience("https://oauth2.googleapis.com/token")
      .setExpirationTime(now + 3600)
      .sign(key);

    console.log("JWT created successfully");

    // Exchange JWT for access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token exchange error:", errorText);
      throw new Error("Failed to exchange JWT for access token");
    }

    const data = await response.json();
    console.log("Access token obtained successfully");
    return data.access_token;
    
  } catch (error) {
    console.error("Error getting Google Cloud access token:", error);
    throw error;
  }
};

/**
 * Send metadata to backend (no file, just URLs and metadata)
 */
const sendMetadataToBackend = async (
  options: {
    type: number;
    fileName: string;
    fileUrl: string;
    width: number;
    height: number;
    duration: number | null;
    thumbnailUrl: string | null;
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
      width: options.width,
      height: options.height,
      duration: options.duration,
      thumbnail_url: options.thumbnailUrl,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.message || "Failed to save metadata to backend");
  }

  const responseData = await response.json();
  
  // Debug: log response
  console.log("Backend metadata response:", responseData);
  
  if (!responseData.upload) {
    console.error("Invalid response structure. Expected 'upload' field but got:", responseData);
    throw new Error("Invalid response structure from backend");
  }

  return responseData.upload;
};

/**
 * Get signed URL from backend for direct GCS upload (DEPRECATED - NOT USED)
 */
const getSignedUploadUrl = async (
  file: File,
  options: {
    type: number;
    fileName: string;
    token: string;
    backendUrl: string;
  }
): Promise<{ id: string; signedUrl: string; fileUrl: string }> => {
  const response = await fetch(`${options.backendUrl}/editor/get-upload-url`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${options.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: options.type,
      file_name: options.fileName,
      content_type: file.type,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to get signed URL");
  }

  const data = await response.json();
  return data;
};

/**
 * Upload file to GCS using signed URL
 */
const uploadToGCSWithSignedUrl = async (file: File, signedUrl: string): Promise<void> => {
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload to GCS: ${response.status}`);
  }
};

/**
 * Confirm upload and send metadata to backend
 */
const confirmUploadToBackend = async (
  options: {
    id: string;
    type: number;
    fileName: string;
    fileUrl: string;
    width: number;
    height: number;
    duration: number | null;
    thumbnailUrl: string | null;
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
      id: options.id,
      type: options.type,
      file_name: options.fileName,
      file_url: options.fileUrl,
      width: options.width,
      height: options.height,
      duration: options.duration,
      thumbnail_url: options.thumbnailUrl,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.message || "Failed to confirm upload");
  }

  const responseData = await response.json();
  
  // Debug: log response
  console.log("Backend confirm response:", responseData);
  
  if (!responseData.upload) {
    console.error("Invalid response structure. Expected 'upload' field but got:", responseData);
    throw new Error("Invalid response structure from backend");
  }

  return responseData.upload;
};

/**
 * Upload file to Google Cloud Storage via backend (OLD METHOD - DEPRECATED)
 */
const uploadToGCS = async (
  file: File,
  options: {
    type: number;
    fileName: string;
    width: number;
    height: number;
    duration: number | null;
    thumbnailUrl: string | null;
    token: string;
    backendUrl: string;
  }
): Promise<any> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", options.type.toString());
  formData.append("file_name", options.fileName);
  formData.append("width", options.width.toString());
  formData.append("height", options.height.toString());
  
  if (options.duration !== null) {
    formData.append("duration", options.duration.toString());
  }
  
  if (options.thumbnailUrl) {
    formData.append("thumbnail_url", options.thumbnailUrl);
  }

  const response = await fetch(`${options.backendUrl}/editor/upload-file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.message || "Failed to upload file to GCS");
  }

  const responseData = await response.json();
  
  // Debug: log response
  console.log("Backend response:", responseData);
  
  if (!responseData.upload) {
    console.error("Invalid response structure. Expected 'upload' field but got:", responseData);
    throw new Error("Invalid response structure from backend");
  }

  // Validate that file_url exists
  if (!responseData.upload.file_url) {
    console.error("Backend returned upload data without file_url:", responseData.upload);
    throw new Error("Backend did not return file URL. Upload may have failed on the server.");
  }

  return responseData.upload;
};

/**
 * Extract video thumbnail and upload to GCS
 */
const extractAndUploadVideoThumbnail = async (file: File, token: string): Promise<string> => {
  try {
    console.log("Generating thumbnail from video...");
    
    // Generate thumbnail as blob
    const thumbnailBlob = await generateVideoThumbnailBlob(file);
    
    // Convert blob to File
    const thumbnailFile = new File(
      [thumbnailBlob], 
      `${file.name.split('.')[0]}_thumb.jpg`, 
      { type: 'image/jpeg' }
    );
    
    console.log("Thumbnail generated, uploading to GCS...");
    
    // Upload thumbnail to GCS images bucket (type = 1)
    const thumbnailUrl = await uploadDirectlyToGCS(thumbnailFile, 1);
    
    console.log("Thumbnail uploaded successfully:", thumbnailUrl);
    return thumbnailUrl;
    
  } catch (error) {
    console.error("Error extracting and uploading video thumbnail:", error);
    throw error;
  }
};

/**
 * Generate video thumbnail as Blob
 */
const generateVideoThumbnailBlob = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    const timeoutId = setTimeout(() => {
      console.warn("Video thumbnail generation timed out after 2 minutes");
      URL.revokeObjectURL(video.src);
      reject(new Error("Thumbnail generation timed out"));
    }, 120000);

    video.onloadedmetadata = () => {
      // Set the time to 1 second or the middle of the video
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement("canvas");
        
        // Maintain aspect ratio, max 1280x720
        const maxWidth = 1280;
        const maxHeight = 720;
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Could not get canvas context");
        }
        
        ctx.drawImage(video, 0, 0, width, height);
        
        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(video.src);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create thumbnail blob"));
            }
          },
          "image/jpeg",
          0.85 // Quality
        );
      } catch (error) {
        URL.revokeObjectURL(video.src);
        reject(error);
      }
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      console.error("Error loading video for thumbnail");
      URL.revokeObjectURL(video.src);
      reject(new Error("Error loading video"));
    };

    video.src = URL.createObjectURL(file);
    video.load();
  });
};

/**
 * Extract video thumbnail using Lambda (DEPRECATED - Use extractAndUploadVideoThumbnail instead)
 */
const extractVideoThumbnail = async (file: File, token: string): Promise<string> => {
  try {
    // Get Lambda URL from environment
    const lambdaUrl = process.env.NEXT_PUBLIC_LAMBDA_URL || "https://lambda.reelmotion.ai";
    
    // Create form data with video file
    const formData = new FormData();
    formData.append("video", file);
    formData.append("time", "1"); // Extract at 1 second

    // Call Lambda to extract thumbnail
    const response = await fetch(`${lambdaUrl}/extract-thumbnail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to extract thumbnail from Lambda");
    }

    const data = await response.json();
    
    if (!data.thumbnail_url) {
      throw new Error("No thumbnail URL in Lambda response");
    }

    return data.thumbnail_url;
  } catch (error) {
    console.error("Error extracting video thumbnail:", error);
    throw error;
  }
};

/**
 * Get video metadata (duration, width, height)
 */
const getVideoMetadata = async (
  file: File
): Promise<{ duration: number; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Video metadata loading timed out after 2 minutes"));
    }, 120000);

    video.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
      URL.revokeObjectURL(video.src);
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(video.src);
      reject(new Error("Error loading video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
};

/**
 * Get image metadata (width, height)
 */
const getImageMetadata = async (
  file: File
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Image metadata loading timed out after 1 minute"));
    }, 60000);

    img.onload = () => {
      clearTimeout(timeoutId);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(img.src);
      reject(new Error("Error loading image metadata"));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Get audio duration
 */
const getAudioDuration = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";

    const timeoutId = setTimeout(() => {
      URL.revokeObjectURL(audio.src);
      reject(new Error("Audio duration loading timed out after 1 minute"));
    }, 60000);

    audio.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      resolve(audio.duration);
      URL.revokeObjectURL(audio.src);
    };

    audio.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(audio.src);
      reject(new Error("Error loading audio metadata"));
    };

    audio.src = URL.createObjectURL(file);
  });
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
