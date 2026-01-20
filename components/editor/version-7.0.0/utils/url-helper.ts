/**
 * URL Helper Utility
 *
 * Provides functions to handle URL transformations for consistent
 * access between browser and SSR renderer.
 */

/**
 * CDN Configuration for Google Cloud Storage
 * The CDN provides faster delivery via Google's edge network
 * Note: CDN routes are configured by actual file paths (chat_attachments, sounds, etc.)
 * NOT by bucket type prefixes (images, videos, audio)
 */
const CDN_CONFIG = {
  enabled: process.env.NEXT_PUBLIC_CDN_ENABLED === "true",
  baseUrl: process.env.NEXT_PUBLIC_CDN_URL || "https://cdn.reelmotion.ai",
  // Map GCS bucket URLs - paths are served directly without type prefix
  bucketPatterns: [
    "storage.googleapis.com/reelmotion-ai-videos",
    "storage.googleapis.com/reelmotion-ai-audio",
    "storage.googleapis.com/reelmotion-ai-images",
  ],
};

/**
 * Get the base URL from environment variables or default to localhost:3000
 */
export const getBaseUrl = (): string => {
  // Use environment variable if available, otherwise default to localhost:3000
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
};

/**
 * Transform a GCS URL to use the CDN for faster delivery
 * Falls back to original URL if CDN is not enabled or URL doesn't match
 *
 * @param url The original GCS URL
 * @returns CDN URL if available, otherwise original URL
 */
export const toCdnUrl = (url: string): string => {
  // If CDN is not enabled, return original URL
  if (!CDN_CONFIG.enabled) {
    return url;
  }

  // Check if URL matches any bucket pattern
  for (const bucketPattern of CDN_CONFIG.bucketPatterns) {
    if (url.includes(bucketPattern)) {
      // Extract the file path from the GCS URL (without the bucket name)
      const escapedPattern = bucketPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = url.match(new RegExp(`${escapedPattern}/(.+)`));
      if (match && match[1]) {
        // Return CDN URL with just the file path (no type prefix)
        return `${CDN_CONFIG.baseUrl}/${match[1]}`;
      }
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
 * Uses CDN if available, otherwise returns original URL with CORS-friendly headers
 *
 * @param url The original media URL
 * @returns Optimized URL for faster loading
 */
export const getOptimizedMediaUrl = (url: string): string => {
  // Try CDN first
  const cdnUrl = toCdnUrl(url);
  if (cdnUrl !== url) {
    return cdnUrl;
  }

  // For GCS URLs, we can use the URL directly if CORS is configured
  if (isGcsUrl(url)) {
    return url;
  }

  return url;
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
  // console.log("[resolveVideoUrl] Resolving:", url);

  const resolved = resolveMediaUrl(url, baseUrl);

  // Only proxy absolute http(s) URLs.
  if (!resolved.startsWith("http://") && !resolved.startsWith("https://")) {
    return resolved;
  }

  // Avoid double-proxying.
  if (resolved.includes("/api/proxy-video") || resolved.includes("/api/proxy-video?")) {
    return resolved;
  }

  // NOTE: GCS URLs now have proper CORS configured (via cors.json), so we can use them directly!
  // This improves performance significantly by avoiding the proxy.
  if (resolved.includes("storage.googleapis.com")) {
    return resolved;
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
  if (resolved.startsWith(origin)) return resolved;

  // Only proxy truly external URLs that need CORS handling
  return `${origin}/api/proxy-video?url=${encodeURIComponent(resolved)}`;
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
      // Return the decoded URL (which should be absolute)
      return decodedUrl;
    }
  }

  // If it's already a CDN or GCS URL, use it directly
  if (isGcsUrl(url)) {
    return url;
  }

  // If it's a relative URL, make it absolute using the base URL
  if (url.startsWith('/')) {
    return `${getBaseUrl()}${url}`;
  }

  // Otherwise return as-is (already absolute)
  return url;
};
