/**
 * URL Helper Utility
 *
 * Provides functions to handle URL transformations for consistent
 * access between browser and SSR renderer.
 */

/**
 * CDN Configuration for Google Cloud Storage
 * 
 * IMPORTANT: cdn.reelmotion.ai is a CNAME pointing to the GCS bucket
 * `reelmotion-ai-videos` ONLY. Files in other buckets (reelmotion-ai-images,
 * reelmotion-ai-audio) are NOT available via cdn.reelmotion.ai.
 * 
 * For files in other buckets, we use direct GCS URLs instead.
 */
const CDN_CONFIG = {
  enabled: process.env.NEXT_PUBLIC_CDN_ENABLED === "true",
  baseUrl: process.env.NEXT_PUBLIC_CDN_URL || "https://cdn.reelmotion.ai",
  // ONLY the videos bucket is served via CDN domain
  cdnBucketPattern: "storage.googleapis.com/reelmotion-ai-videos",
  // All bucket patterns for GCS URL detection
  allBucketPatterns: [
    "storage.googleapis.com/reelmotion-ai-videos",
    "storage.googleapis.com/reelmotion-ai-audio",
    "storage.googleapis.com/reelmotion-ai-images",
  ],
};

/**
 * Paths that live in the reelmotion-ai-images bucket (NOT in reelmotion-ai-videos).
 * The CDN domain (cdn.reelmotion.ai) only serves reelmotion-ai-videos,
 * so any CDN URL with these path prefixes will 404.
 */
const IMAGES_BUCKET_PATHS = [
  "attachments/",
  "chat_attachments/",
  "video-thumbnails/",
  "editor-images/",
  "editor-uploads/",
  "generated-images/",
  "image-references/",
  "characters/",
  "conversation-media/",
  "scenes/",
  "spots/",
  "user-profiles/",
  "video-prompts/",
  "project-frames/",
];

/**
 * Paths that live in the reelmotion-ai-audio bucket.
 */
const AUDIO_BUCKET_PATHS = [
  "editor-music/",
  "editor-voices/",
  "generated-voices/",
];

/**
 * Fix a CDN URL that incorrectly points to cdn.reelmotion.ai when the file
 * actually lives in a different GCS bucket. Redirects to the correct direct
 * GCS URL for the right bucket.
 *
 * The backend sometimes generates CDN URLs for ALL files, but cdn.reelmotion.ai
 * only serves files from the reelmotion-ai-videos bucket.
 *
 * @param url The potentially incorrect CDN URL
 * @returns Corrected GCS URL or the original URL if it's valid
 */
export const fixCdnUrl = (url: string): string => {
  if (!url.includes("cdn.reelmotion.ai")) {
    return url;
  }

  // Extract the path after the CDN domain
  const cdnBase = CDN_CONFIG.baseUrl;
  if (!url.startsWith(cdnBase)) {
    return url;
  }

  const path = url.substring(cdnBase.length + 1); // +1 for the trailing slash

  // Check if this path belongs to the images bucket
  for (const prefix of IMAGES_BUCKET_PATHS) {
    if (path.startsWith(prefix)) {
      return `https://storage.googleapis.com/reelmotion-ai-images/${path}`;
    }
  }

  // Check if this path belongs to the audio bucket
  for (const prefix of AUDIO_BUCKET_PATHS) {
    if (path.startsWith(prefix)) {
      return `https://storage.googleapis.com/reelmotion-ai-audio/${path}`;
    }
  }

  // Path likely belongs to reelmotion-ai-videos (CDN is correct)
  return url;
};

/**
 * Get the base URL from environment variables or default to localhost:3000
 */
export const getBaseUrl = (): string => {
  // Use environment variable if available, otherwise default to localhost:3000
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
};

/**
 * Transform a GCS URL to use the CDN for faster delivery.
 * ONLY transforms URLs from reelmotion-ai-videos bucket, since cdn.reelmotion.ai
 * is a CNAME that only points to that specific bucket.
 * 
 * URLs from reelmotion-ai-images and reelmotion-ai-audio are returned as-is
 * (they work directly via GCS with CORS configured).
 *
 * @param url The original GCS URL
 * @returns CDN URL if applicable, otherwise original URL
 */
export const toCdnUrl = (url: string): string => {
  // If CDN is not enabled, return original URL
  if (!CDN_CONFIG.enabled) {
    return url;
  }

  // Only transform URLs from the videos bucket (the one CDN actually serves)
  const bucketPattern = CDN_CONFIG.cdnBucketPattern;
  if (url.includes(bucketPattern)) {
    const escapedPattern = bucketPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = url.match(new RegExp(`${escapedPattern}/(.+)`));
    if (match && match[1]) {
      return `${CDN_CONFIG.baseUrl}/${match[1]}`;
    }
  }

  return url;
};

/**
 * Check if a URL is a GCS URL that can be served directly (with CORS configured)
 * Also includes CDN URLs which are served from GCS with CORS
 */
export const isGcsUrl = (url: string): boolean => {
  // All reelmotion buckets have CORS configured
  if (url.includes("storage.googleapis.com/reelmotion-ai-")) {
    return true;
  }
  // CDN URLs are also served from GCS with CORS
  if (url.includes("cdn.reelmotion.ai")) {
    return true;
  }
  return false;
};

/**
 * Check if a URL is from the backend that doesn't have CORS configured
 * These URLs need to go through the proxy
 */
export const isBackendUrl = (url: string): boolean => {
  return url.includes("backend.reelmotion.ai/storage");
};

/**
 * Get optimized URL for media content
 * Uses CDN if available, fixes broken CDN URLs, and returns direct GCS URLs
 * for buckets not served by CDN.
 *
 * @param url The original media URL
 * @returns Optimized URL for faster loading
 */
export const getOptimizedMediaUrl = (url: string): string => {
  // First, fix any CDN URLs that point to the wrong bucket
  const fixedUrl = fixCdnUrl(url);

  // Try CDN transform (only for videos bucket)
  const cdnUrl = toCdnUrl(fixedUrl);
  if (cdnUrl !== fixedUrl) {
    return cdnUrl;
  }

  // For GCS URLs, we can use the URL directly if CORS is configured
  if (isGcsUrl(fixedUrl)) {
    return fixedUrl;
  }

  return fixedUrl;
};

/**
 * Convert a relative URL to an absolute URL
 *
 * @param url The URL to convert
 * @returns Absolute URL with the correct base
 */
export const toAbsoluteUrl = (url: string): string => {
  // If the URL is already absolute, return it as is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // If it's a relative URL starting with /, add the base URL
  if (url.startsWith("/")) {
    return `${getBaseUrl()}${url}`;
  }

  // Otherwise, add the base URL with a / separator
  return `${getBaseUrl()}/${url}`;
};

/**
 * Resolves a media URL to ensure it works in both browser and SSR contexts
 *
 * @param url The URL to resolve
 * @param baseUrl Optional base URL to use
 * @returns Properly formatted URL for the current context
 */
export const resolveMediaUrl = (url: string, baseUrl?: string): string => {
  // If the URL is already absolute, return it as is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // If baseUrl is provided, use it
  if (baseUrl) {
    // Ensure there's no double slash
    if (url.startsWith("/") && baseUrl.endsWith("/")) {
      return `${baseUrl}${url.substring(1)}`;
    }

    // Ensure there's at least one slash
    if (!url.startsWith("/") && !baseUrl.endsWith("/")) {
      return `${baseUrl}/${url}`;
    }

    return `${baseUrl}${url}`;
  }

  // If we're in the browser, use window.location.origin
  if (typeof window !== "undefined") {
    return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  // In SSR context, use the base URL
  return toAbsoluteUrl(url);
};

/**
 * Resolve a video URL and, when it is cross-origin, route it through the local proxy
 * to improve playback reliability (CORS/range headers) for Remotion's Player/OffthreadVideo.
 * 
 * OPTIMIZATION: GCS URLs with proper CORS config bypass the proxy for faster loading.
 */
export const resolveVideoUrl = (url: string, baseUrl?: string): string => {
  // DEBUG log

  const resolved = resolveMediaUrl(url, baseUrl);

  // Fix CDN URLs that point to the wrong bucket before any other checks
  const fixed = fixCdnUrl(resolved);

  // Only proxy absolute http(s) URLs.
  if (!fixed.startsWith("http://") && !fixed.startsWith("https://")) {
    return fixed;
  }

  // Avoid double-proxying.
  if (fixed.includes("/api/proxy-video") || fixed.includes("/api/proxy-video?")) {
    return fixed;
  }

  // NOTE: GCS URLs now have proper CORS configured (via cors.json), so we can use them directly!
  // This improves performance significantly by avoiding the proxy.
  if (fixed.includes("storage.googleapis.com")) {
    return fixed;
  }

  // CDN URLs (cdn.reelmotion.ai) are served from GCS with CORS configured.
  // After fixCdnUrl, only VALID CDN URLs remain (ones that point to reelmotion-ai-videos).
  if (fixed.includes("cdn.reelmotion.ai")) {
    return fixed;
  }

  // Determine current origin for building same-origin proxy URL.
  const origin = (() => {
    try {
      if (baseUrl) return new URL(baseUrl).origin;
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") return window.location.origin;
    return getBaseUrl();
  })();

  // If already same-origin, no need to proxy.
  if (fixed.startsWith(origin)) return fixed;

  // Only proxy truly external URLs that need CORS handling
  return `${origin}/api/proxy-video?url=${encodeURIComponent(fixed)}`;
};

/**
 * Prepare a media URL for server-side rendering (Cloud Run, Lambda, SSR)
 * This function ensures URLs are absolute and DON'T use the local proxy
 * because the proxy only exists on the Next.js server, not on Remotion servers.
 * 
 * @param url The URL to prepare
 * @returns An absolute URL suitable for server-side rendering
 */
export const prepareUrlForRender = (url: string): string => {
  // If it's a proxy URL, extract the original URL
  if (url.includes('/api/proxy-video?url=')) {
    const match = url.match(/[?&]url=([^&]+)/);
    if (match && match[1]) {
      const decodedUrl = decodeURIComponent(match[1]);
      // Fix CDN URL if needed, then return
      return fixCdnUrl(decodedUrl);
    }
  }

  // Fix CDN URLs that point to the wrong bucket
  const fixed = fixCdnUrl(url);

  // If it's already a CDN or GCS URL, use it directly
  if (isGcsUrl(fixed)) {
    return fixed;
  }

  // If it's a relative URL, make it absolute using the base URL
  if (fixed.startsWith('/')) {
    return `${getBaseUrl()}${fixed}`;
  }

  // Otherwise return as-is (already absolute)
  return fixed;
};
