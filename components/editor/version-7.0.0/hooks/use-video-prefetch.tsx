import { useEffect, useRef, useCallback } from "react";
import { prefetch } from "remotion";
import { Overlay, ClipOverlay, OverlayType } from "../types";
import { resolveVideoUrl } from "../utils/url-helper";

/**
 * Custom hook to prefetch all video assets in the timeline
 * This prevents black flashes when transitioning between videos
 * by preloading them before they appear on screen
 */
export const useVideoPrefetch = (overlays: Overlay[], baseUrl?: string) => {
  // Store references to prefetch cleanup functions
  const prefetchRefs = useRef<Map<string, () => void>>(new Map());
  // Track which videos have been prefetched
  const prefetchedUrls = useRef<Set<string>>(new Set());

  const prefetchVideo = useCallback((src: string) => {
    const resolvedUrl = resolveVideoUrl(src, baseUrl);
    
    // Skip if already prefetched
    if (prefetchedUrls.current.has(resolvedUrl)) {
      return;
    }

    try {
      const { free, waitUntilDone } = prefetch(resolvedUrl, {
        method: "blob-url",
        contentType: "video/mp4",
      });

      // Store the cleanup function
      prefetchRefs.current.set(resolvedUrl, free);
      prefetchedUrls.current.add(resolvedUrl);

      waitUntilDone()
        .then(() => {
          console.log(`[Prefetch] Video ready: ${src}`);
        })
        .catch((err) => {
          console.warn(`[Prefetch] Failed to prefetch video ${src}:`, err);
          // Remove from prefetched set if failed
          prefetchedUrls.current.delete(resolvedUrl);
        });
    } catch (err) {
      console.warn(`[Prefetch] Error prefetching ${src}:`, err);
    }
  }, [baseUrl]);

  // Prefetch all video overlays
  useEffect(() => {
    const videoOverlays = overlays.filter(
      (overlay): overlay is ClipOverlay => overlay.type === OverlayType.VIDEO
    );

    // Get all unique video sources
    const videoSources = new Set(videoOverlays.map((overlay) => overlay.src));

    // Prefetch each video
    videoSources.forEach((src) => {
      prefetchVideo(src);
    });

    // Cleanup removed videos
    return () => {
      // Note: We don't clean up prefetched videos here because
      // they might be used again and the cache is beneficial
    };
  }, [overlays, prefetchVideo]);

  // Cleanup all prefetched videos on unmount
  useEffect(() => {
    return () => {
      prefetchRefs.current.forEach((free) => {
        try {
          free();
        } catch (e) {
          // Ignore cleanup errors
        }
      });
      prefetchRefs.current.clear();
      prefetchedUrls.current.clear();
    };
  }, []);

  return {
    prefetchVideo,
    isPrefetched: (src: string) => {
      const resolvedUrl = resolveVideoUrl(src, baseUrl);
      return prefetchedUrls.current.has(resolvedUrl);
    },
  };
};
