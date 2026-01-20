/**
 * Media Upload Utility - OPTIMIZED FOR SPEED
 *
 * This utility provides functions for:
 * - Uploading media files directly to Google Cloud Storage (FAST)
 * - Cached access tokens (no regeneration on each upload)
 * - XMLHttpRequest for better performance
 */

import { getUserId } from "./user-id";
import { UserMediaItem, addMediaItem } from "./indexdb";
import Cookies from "js-cookie";
import { SignJWT, importPKCS8 } from "jose";

// ============================================
// TOKEN CACHE - Avoid regenerating JWT every time
// ============================================
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

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

    // FAST UPLOAD: Skip metadata extraction for speed
    // Backend only needs: user_id (from token), type, file_name, file_url
    const thumbnailUrl = "";
    const duration: number | undefined = undefined;
    const width = 0;
    const height = 0;

    console.log("⚡ FAST UPLOAD: Starting...", { fileName: file.name, size: file.size });

    // Upload file directly to Google Cloud Storage
    let uploadData;
    let serverPath: string;
    
    try {
      // Upload directly to GCS with progress tracking
      const gcsUrl = await uploadDirectlyToGCS(file, typeNumber, onProgress);
      serverPath = gcsUrl;
      
      console.log("⚡ GCS upload complete, registering with backend...");
      
      // Send minimal data to backend (fast upload - no metadata)
      uploadData = await sendMetadataToBackend({
        type: typeNumber,
        fileName: file.name,
        fileUrl: gcsUrl,
        token: token || "",
        backendUrl,
      });
      
      console.log("⚡ FAST UPLOAD: Complete!");
      
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
    
    console.log("⚡ Starting upload via API proxy:", { type, size: file.size });

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
          console.log(`Upload progress: ${percentage}%`);
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
              console.log("⚡ Upload Complete!", response.url);
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
      xhr.send(formData);
    });

    return result.url;
    
  } catch (error) {
    console.error("Error uploading:", error);
    throw error;
  }
};

/**
 * Get Google Cloud access token using service account credentials
 * OPTIMIZED: Uses cache to avoid regenerating JWT on each upload
 */
const getGoogleCloudAccessToken = async (): Promise<string> => {
  // Check cache first - return immediately if valid
  const now = Date.now();
  if (cachedAccessToken && tokenExpiresAt > now + 60000) { // 1 min buffer
    console.log("⚡ Using cached access token");
    return cachedAccessToken;
  }

  console.log("⚡ Generating new access token...");
  
  try {
    const clientEmail = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL;
    const privateKeyBase64 = process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY_BASE64;

    if (!clientEmail) {
      console.error('❌ Missing Google Cloud client email');
      throw new Error("Missing Google Cloud client email");
    }

    if (!privateKeyBase64) {
      console.error('❌ Missing Google Cloud private key (Base64)');
      throw new Error("Missing Google Cloud private key");
    }

    // Decode from Base64
    let privateKey: string;
    const sanitizedBase64 = privateKeyBase64.trim().replace(/^['"]|['"]$/g, "");
    privateKey = Buffer.from(sanitizedBase64, 'base64').toString('utf-8');

    // Normalize + reconstruct PEM
    privateKey = privateKey
      .replace(/\r\n/g, "\n")
      .replace(/\\n/g, "\n")
      .trim();

    if (privateKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      throw new Error('Invalid private key format: expected PKCS#8');
    }

    const pemMatch = privateKey.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
    if (!pemMatch) {
      console.error('❌ PEM markers not found after decoding');
      console.error('PEM marker check:', {
        hasBegin: privateKey.includes('-----BEGIN PRIVATE KEY-----'),
        hasEnd: privateKey.includes('-----END PRIVATE KEY-----'),
      });
      throw new Error('Invalid private key PEM after decoding');
    }

    const pemBody = pemMatch[1].replace(/[\r\n\s]/g, "");
    const wrappedBody = pemBody.match(/.{1,64}/g)?.join("\n") ?? pemBody;
    privateKey = `-----BEGIN PRIVATE KEY-----\n${wrappedBody}\n-----END PRIVATE KEY-----\n`;

    // Validate private key format
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.error('❌ Invalid key format. Key starts with:', privateKey.substring(0, 50));
      throw new Error('Invalid private key format after decoding');
    }

    console.log('✅ Private key validated successfully');

    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    
    // Import private key
    let key;
    try {
      key = await importPKCS8(privateKey, "RS256");
    } catch (importError) {
      console.error('❌ Error importing private key:', importError);
      throw new Error('Failed to import private key');
    }
    
    // Create and sign JWT
    let jwt;
    try {
      jwt = await new SignJWT({
        scope: "https://www.googleapis.com/auth/devstorage.full_control",
      })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuedAt(now)
        .setIssuer(clientEmail)
        .setAudience("https://oauth2.googleapis.com/token")
        .setExpirationTime(now + 3600)
        .sign(key);

      console.log("✅ JWT created successfully");
    } catch (jwtError) {
      console.error('❌ Error creating JWT:', jwtError);
      throw new Error('Failed to create JWT token');
    }

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
      console.error("❌ Token exchange error:", errorText);
      throw new Error("Failed to exchange JWT for access token");
    }

    const data = await response.json();
    
    // CACHE the token for future uploads (expires in ~1 hour)
    cachedAccessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
    
    console.log("⚡ Access token obtained and cached");
    return data.access_token;
    
  } catch (error) {
    console.error("Error getting Google Cloud access token:", error);
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
