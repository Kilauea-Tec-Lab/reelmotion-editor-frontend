import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
  RenderMediaOnProgress,
} from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { getBaseUrl } from "../utils/url-helper";
import {
  saveRenderState,
  updateRenderProgress,
  completeRender,
  failRender,
} from "./render-state";
import {
  preloadAssets,
  replaceUrlsWithLocalPaths,
  cleanupAssets,
  cleanupOldAssets,
} from "./asset-preloader";

// ============================================================================
// ⚡ CRITICAL PERFORMANCE OPTIMIZATION: BUNDLE CACHING
// ============================================================================
// The bundle() function takes 2-5 MINUTES to run. We cache it globally
// so it only runs ONCE per server restart, not on every render.
// ============================================================================

let cachedBundleLocation: string | null = null;
let bundlePromise: Promise<string> | null = null;

const REMOTION_ENTRY = path.join(
  process.cwd(),
  "components",
  "editor",
  "version-7.0.0",
  "remotion",
  "index.ts"
);

/**
 * Get or create the cached bundle location.
 * This is the KEY optimization - bundle is created ONCE and reused.
 */
async function getCachedBundle(): Promise<string> {
  // Return cached bundle if available
  if (cachedBundleLocation && fs.existsSync(cachedBundleLocation)) {
    console.log("[Bundle] Using cached bundle:", cachedBundleLocation);
    return cachedBundleLocation;
  }

  // If bundling is already in progress, wait for it
  if (bundlePromise) {
    console.log("[Bundle] Bundle in progress, waiting...");
    return bundlePromise;
  }

  // Start bundling
  console.log("[Bundle] Creating new bundle (this only happens ONCE)...");
  const startTime = Date.now();

  bundlePromise = bundle(REMOTION_ENTRY, undefined, {
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
          "@remotion/compositor": false,
          "@remotion/compositor-darwin-arm64": false,
          "@remotion/compositor-darwin-x64": false,
          "@remotion/compositor-linux-x64": false,
          "@remotion/compositor-linux-arm64": false,
          "@remotion/compositor-win32-x64-msvc": false,
          "@remotion/compositor-windows-x64": false,
        },
      },
    }),
  });

  try {
    cachedBundleLocation = await bundlePromise;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Bundle] ✓ Bundle created in ${duration}s: ${cachedBundleLocation}`);
    return cachedBundleLocation;
  } catch (error) {
    bundlePromise = null;
    cachedBundleLocation = null;
    throw error;
  }
}

// Ensure the videos directory exists
const VIDEOS_DIR = path.join(process.cwd(), "public", "rendered-videos");
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// Track rendering progress
export const renderProgress = new Map<string, number>();
export const renderStatus = new Map<string, "rendering" | "done" | "error">();
export const renderErrors = new Map<string, string>();
export const renderUrls = new Map<string, string>();
export const renderSizes = new Map<string, number>();

// ============================================================================
// RENDER CONFIGURATION - OPTIMIZED FOR SPEED
// ============================================================================
const RENDER_CONFIG = {
  // Encoding settings
  CODEC: "h264" as const,
  CRF: 28, // Higher = faster & smaller (range 18-28, 28 is fastest acceptable)
  X264_PRESET: "ultrafast" as const, // Fastest possible encoding
  IMAGE_FORMAT: "jpeg" as const,
  JPEG_QUALITY: 80, // Good enough for most uses
  
  // Concurrency - use ALL CPU cores
  get CONCURRENCY() {
    return Math.max(2, os.cpus().length);
  },
  
  // Timeouts
  TIMEOUT_MS: 120000, // 2 minutes max per render
  DELAY_RENDER_TIMEOUT_MS: 15000, // 15 seconds for delayRender
};

/**
 * Check if overlays contain any remote URLs that need pre-downloading
 */
function hasRemoteAssets(overlays: any[]): boolean {
  if (!overlays || overlays.length === 0) return false;
  
  for (const overlay of overlays) {
    const src = overlay.src || overlay.content;
    if (src && (src.startsWith("http://") || src.startsWith("https://"))) {
      // Ignore GCS URLs if we're rendering on Cloud Run (they're fast)
      if (!src.includes("storage.googleapis.com")) {
        return true;
      }
    }
  }
  return false;
}

/**
 * ⚡ OPTIMIZED RENDERER
 * 
 * Key optimizations:
 * 1. Bundle is cached and reused (saves 2-5 minutes per render!)
 * 2. ultrafast x264 preset
 * 3. Maximum CPU concurrency
 * 4. JPEG frames (faster than PNG)
 * 5. Optional asset pre-download only when needed
 */
export async function startRendering(
  compositionId: string,
  inputProps: Record<string, unknown>
) {
  const renderId = uuidv4();
  const startTime = Date.now();

  // Initialize render state
  saveRenderState(renderId, {
    status: "rendering",
    progress: 0,
    timestamp: startTime,
  });

  // Start rendering asynchronously
  (async () => {
    try {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`[Render ${renderId}] Starting render...`);
      console.log(`${"=".repeat(60)}`);
      
      // Cleanup old cached assets periodically (non-blocking)
      cleanupOldAssets();

      const baseUrl = getBaseUrl();
      let optimizedInputProps = { ...inputProps };
      const overlays = (inputProps.overlays as any[]) || [];

      // ⚡ STEP 1: Pre-download assets ONLY if there are remote URLs
      if (hasRemoteAssets(overlays)) {
        console.log(`[Render ${renderId}] Pre-downloading remote assets...`);
        updateRenderProgress(renderId, 0.05);
        
        const assetMap = await preloadAssets(overlays, renderId);
        const optimizedOverlays = replaceUrlsWithLocalPaths(overlays, assetMap);
        optimizedInputProps = { ...inputProps, overlays: optimizedOverlays };
        
        console.log(`[Render ${renderId}] ✓ Assets ready`);
      } else {
        console.log(`[Render ${renderId}] No remote assets to download`);
      }

      // ⚡ STEP 2: Get cached bundle (this is INSTANT after first render)
      console.log(`[Render ${renderId}] Getting bundle...`);
      updateRenderProgress(renderId, 0.1);
      const bundleLocation = await getCachedBundle();
      console.log(`[Render ${renderId}] ✓ Bundle ready`);

      // ⚡ STEP 3: Select composition
      console.log(`[Render ${renderId}] Selecting composition...`);
      updateRenderProgress(renderId, 0.15);
      
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: compositionId,
        inputProps: { ...optimizedInputProps, baseUrl },
        timeoutInMilliseconds: RENDER_CONFIG.DELAY_RENDER_TIMEOUT_MS,
      });

      const actualDurationInFrames =
        (inputProps.durationInFrames as number) || composition.durationInFrames;
      const durationSecs = (actualDurationInFrames / composition.fps).toFixed(1);
      
      console.log(`[Render ${renderId}] Composition: ${actualDurationInFrames} frames (${durationSecs}s @ ${composition.fps}fps)`);

      // ⚡ STEP 4: Render with maximum speed settings
      console.log(`[Render ${renderId}] Rendering with ${RENDER_CONFIG.CONCURRENCY} CPU cores...`);
      updateRenderProgress(renderId, 0.2);

      const outputPath = path.join(VIDEOS_DIR, `${renderId}.mp4`);

      await renderMedia({
        codec: RENDER_CONFIG.CODEC,
        composition: {
          ...composition,
          durationInFrames: actualDurationInFrames,
        },
        serveUrl: bundleLocation,
        outputLocation: outputPath,
        inputProps: { ...optimizedInputProps, baseUrl },
        
        // ⚡ SPEED SETTINGS
        crf: RENDER_CONFIG.CRF,
        x264Preset: RENDER_CONFIG.X264_PRESET,
        imageFormat: RENDER_CONFIG.IMAGE_FORMAT,
        jpegQuality: RENDER_CONFIG.JPEG_QUALITY,
        concurrency: RENDER_CONFIG.CONCURRENCY,
        
        // Chromium settings
        chromiumOptions: {
          headless: true,
          disableWebSecurity: true, // Faster, allows cross-origin
          ignoreCertificateErrors: true,
        },
        
        // Timeouts
        timeoutInMilliseconds: RENDER_CONFIG.TIMEOUT_MS,
        
        // Progress callback
        onProgress: ((progress) => {
          // Map render progress to 20%-95% range
          const mappedProgress = 0.2 + (progress.progress * 0.75);
          updateRenderProgress(renderId, mappedProgress);
          
          // Log every 25%
          const percent = Math.floor(progress.progress * 100);
          if (percent % 25 === 0 && percent > 0) {
            console.log(`[Render ${renderId}] ${percent}% complete`);
          }
        }) as RenderMediaOnProgress,
      });

      // ⚡ STEP 5: Complete
      const stats = fs.statSync(outputPath);
      const publicPath = `/rendered-videos/${renderId}.mp4`;
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      completeRender(renderId, publicPath, stats.size);
      
      console.log(`[Render ${renderId}] ✓ COMPLETE in ${totalTime}s`);
      console.log(`[Render ${renderId}] Output: ${fileSizeMB}MB`);
      console.log(`${"=".repeat(60)}\n`);

      // Cleanup downloaded assets
      cleanupAssets(renderId);
      
    } catch (error: any) {
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[Render ${renderId}] ✗ FAILED after ${totalTime}s:`, error.message);
      failRender(renderId, error.message);
      cleanupAssets(renderId);
    }
  })();

  return renderId;
}

/**
 * Pre-warm the bundle cache
 * Call this on server startup to avoid cold start delays
 */
export async function warmupBundle(): Promise<void> {
  console.log("[Warmup] Pre-warming bundle cache...");
  try {
    await getCachedBundle();
    console.log("[Warmup] ✓ Bundle cache ready");
  } catch (error) {
    console.error("[Warmup] Failed to warm bundle:", error);
  }
}

/**
 * Get the current progress of a render
 */
export function getRenderProgress(renderId: string) {
  console.log("Checking progress for render:", renderId);

  const progress = renderProgress.get(renderId) || 0;
  const status = renderStatus.get(renderId) || "rendering";
  const error = renderErrors.get(renderId);
  const url = renderUrls.get(renderId);
  const size = renderSizes.get(renderId);

  if (!renderStatus.has(renderId)) {
    throw new Error(`No render found with ID: ${renderId}`);
  }

  return {
    renderId,
    progress,
    status,
    error,
    url,
    size,
  };
}
