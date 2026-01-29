/**
 * Asset Preloader for Server-Side Rendering
 * 
 * Downloads all media assets (videos, images, audio) BEFORE rendering starts.
 * This dramatically improves render speed by avoiding network latency during
 * frame-by-frame rendering.
 * 
 * ⚡ PERFORMANCE IMPACT:
 * - Without preloading: Each frame waits for network I/O (~50-200ms per frame)
 * - With preloading: Frames read from local disk (~1-5ms per frame)
 * - Expected speedup: 10-50x faster for videos with remote assets
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { v4 as uuidv4 } from "uuid";

// Directory to store pre-downloaded assets
const ASSETS_CACHE_DIR = path.join(process.cwd(), ".cache", "render-assets");

// Ensure cache directory exists
if (!fs.existsSync(ASSETS_CACHE_DIR)) {
  fs.mkdirSync(ASSETS_CACHE_DIR, { recursive: true });
}

/**
 * Overlay types that contain media URLs
 */
type MediaOverlay = {
  type: string;
  src?: string;
  content?: string;
  [key: string]: unknown;
};

/**
 * Map of original URLs to local file paths
 */
export type AssetMap = Map<string, string>;

/**
 * Downloads a file from a URL to a local path
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        resolve();
      });
    });

    request.on("error", (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });

    file.on("error", (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });

    // Set timeout for slow connections
    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error(`Download timeout for ${url}`));
    });
  });
}

/**
 * Gets a file extension from URL or content-type
 */
function getExtension(url: string): string {
  // Try to get extension from URL
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath);
  if (ext) return ext;

  // Default extensions based on common patterns
  if (url.includes("video") || url.includes(".mp4") || url.includes("mp4")) return ".mp4";
  if (url.includes("webm")) return ".webm";
  if (url.includes("mov")) return ".mov";
  if (url.includes("audio") || url.includes(".mp3")) return ".mp3";
  if (url.includes(".wav")) return ".wav";
  if (url.includes(".png")) return ".png";
  if (url.includes(".jpg") || url.includes(".jpeg")) return ".jpg";
  if (url.includes(".webp")) return ".webp";
  if (url.includes(".gif")) return ".gif";

  // Default to mp4 for videos
  return ".mp4";
}

/**
 * Checks if a URL is a remote URL that needs downloading
 */
function isRemoteUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Extracts all media URLs from overlays
 */
function extractMediaUrls(overlays: MediaOverlay[]): string[] {
  const urls: string[] = [];

  for (const overlay of overlays) {
    // Video overlays have 'src' field
    if (overlay.type === "video" && overlay.src && isRemoteUrl(overlay.src)) {
      urls.push(overlay.src);
    }

    // Sound overlays have 'src' field
    if (overlay.type === "sound" && overlay.src && isRemoteUrl(overlay.src)) {
      urls.push(overlay.src);
    }

    // Image overlays might use 'content' or 'src'
    if (overlay.type === "image") {
      if (overlay.src && isRemoteUrl(overlay.src)) {
        urls.push(overlay.src);
      } else if (overlay.content && isRemoteUrl(overlay.content)) {
        urls.push(overlay.content);
      }
    }
  }

  // Remove duplicates using Array.from instead of spread operator
  return Array.from(new Set(urls));
}

/**
 * Pre-downloads all assets and returns a mapping of original URLs to local paths
 * 
 * @param overlays - Array of overlay objects from inputProps
 * @param renderId - Unique identifier for this render session
 * @returns Map of original URL -> local file path
 */
export async function preloadAssets(
  overlays: MediaOverlay[],
  renderId: string
): Promise<AssetMap> {
  const assetMap: AssetMap = new Map();
  const urls = extractMediaUrls(overlays);

  if (urls.length === 0) {
    console.log("[AssetPreloader] No remote assets to download");
    return assetMap;
  }

  console.log(`[AssetPreloader] Pre-downloading ${urls.length} assets...`);

  // Create a subdirectory for this render session
  const sessionDir = path.join(ASSETS_CACHE_DIR, renderId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Download all assets in parallel
  const downloadPromises = urls.map(async (url, index) => {
    try {
      const ext = getExtension(url);
      const localFileName = `asset_${index}_${uuidv4().slice(0, 8)}${ext}`;
      const localPath = path.join(sessionDir, localFileName);

      console.log(`[AssetPreloader] Downloading: ${url.slice(0, 80)}...`);
      const startTime = Date.now();

      await downloadFile(url, localPath);

      const stats = fs.statSync(localPath);
      const duration = Date.now() - startTime;
      console.log(
        `[AssetPreloader] ✓ Downloaded ${(stats.size / 1024 / 1024).toFixed(2)}MB in ${duration}ms: ${localFileName}`
      );

      assetMap.set(url, localPath);
    } catch (error) {
      console.error(`[AssetPreloader] ✗ Failed to download ${url}:`, error);
      // Don't add to map - the original URL will be used as fallback
    }
  });

  await Promise.all(downloadPromises);

  console.log(
    `[AssetPreloader] Pre-download complete: ${assetMap.size}/${urls.length} assets cached`
  );

  return assetMap;
}

import { getBaseUrl } from "../utils/url-helper";

/**
 * Replaces remote URLs in overlays with local file paths
 * 
 * @param overlays - Original overlays array
 * @param assetMap - Map of original URL -> local path
 * @returns New overlays array with local paths
 */
export function replaceUrlsWithLocalPaths(
  overlays: MediaOverlay[],
  assetMap: AssetMap
): MediaOverlay[] {
  // Public URL path where Nginx servers the cache directory
  // Corresponds to ASSETS_CACHE_DIR on the filesystem
  const ASSETS_PUBLIC_PATH = "/_render_assets";
  const baseUrl = "https://editor.reelmotion.ai"; // Production URL

  const toPublicUrl = (localPath: string): string => {
    // Get path relative to cache dir (e.g. "session-id/asset.mp4")
    const relativePath = path.relative(ASSETS_CACHE_DIR, localPath);
    // Ensure forward slashes for URL
    const normalizedPath = relativePath.split(path.sep).join('/');
    // Construct full URL
    return `${baseUrl}${ASSETS_PUBLIC_PATH}/${normalizedPath}`;
  };

  return overlays.map((overlay) => {
    const newOverlay = { ...overlay };

    // Replace video src
    if (overlay.type === "video" && overlay.src && assetMap.has(overlay.src)) {
      const localPath = assetMap.get(overlay.src)!;
      newOverlay.src = toPublicUrl(localPath);
      console.log(`[AssetPreloader] Replaced video URL with public URL: ${newOverlay.src}`);
    }

    // Replace sound src
    if (overlay.type === "sound" && overlay.src && assetMap.has(overlay.src)) {
      const localPath = assetMap.get(overlay.src)!;
      newOverlay.src = toPublicUrl(localPath);
      console.log(`[AssetPreloader] Replaced audio URL with public URL: ${newOverlay.src}`);
    }

    // Replace image src/content
    if (overlay.type === "image") {
      if (overlay.src && assetMap.has(overlay.src)) {
        const localPath = assetMap.get(overlay.src)!;
        newOverlay.src = toPublicUrl(localPath);
      } else if (overlay.content && assetMap.has(overlay.content)) {
        const localPath = assetMap.get(overlay.content)!;
        newOverlay.content = toPublicUrl(localPath);
      }
    }

    return newOverlay;
  });
}

/**
 * Cleans up downloaded assets after rendering is complete
 * 
 * @param renderId - The render session ID
 */
export function cleanupAssets(renderId: string): void {
  const sessionDir = path.join(ASSETS_CACHE_DIR, renderId);

  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`[AssetPreloader] Cleaned up assets for render: ${renderId}`);
    } catch (error) {
      console.error(`[AssetPreloader] Failed to cleanup assets:`, error);
    }
  }
}

/**
 * Cleans up old cached assets (older than 1 hour)
 * Call this periodically to prevent disk space issues
 */
export function cleanupOldAssets(): void {
  if (!fs.existsSync(ASSETS_CACHE_DIR)) return;

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const sessions = fs.readdirSync(ASSETS_CACHE_DIR);

  for (const session of sessions) {
    const sessionPath = path.join(ASSETS_CACHE_DIR, session);
    const stats = fs.statSync(sessionPath);

    if (stats.mtimeMs < oneHourAgo) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`[AssetPreloader] Cleaned up old session: ${session}`);
      } catch (error) {
        console.error(`[AssetPreloader] Failed to cleanup old session:`, error);
      }
    }
  }
}
