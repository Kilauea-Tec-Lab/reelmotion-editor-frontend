import { useEffect, useRef, useCallback } from "react";
import { prefetch } from "remotion";
import { Overlay, ClipOverlay, SoundOverlay, OverlayType } from "../types";
import { resolveVideoUrl, toAbsoluteUrl } from "../utils/url-helper";

/**
 * Custom hook to prefetch all video and audio assets in the timeline
 * This prevents black flashes and audio stuttering when transitioning
 * between media by preloading them before they appear on screen
 */
export const useVideoPrefetch = (overlays: Overlay[], baseUrl?: string) => {
  // Store references to prefetch cleanup functions
  const prefetchRefs = useRef<Map<string, () => void>>(new Map());
  // Track which media have been prefetched
  const prefetchedUrls = useRef<Set<string>>(new Set());

  const prefetchMedia = useCallback((src: string, contentType: string, resolvedUrl: string) => {
    // Skip if already prefetched
    if (prefetchedUrls.current.has(resolvedUrl)) {
      return;
    }

    try {
      const { free, waitUntilDone } = prefetch(resolvedUrl, {
        method: "blob-url",
        contentType,
      });

      // Store the cleanup function
      prefetchRefs.current.set(resolvedUrl, free);
      prefetchedUrls.current.add(resolvedUrl);

      waitUntilDone()
        .then(() => {
        })
        .catch((err) => {
          console.warn(`[Prefetch] Failed to prefetch ${src}:`, err);
          // Remove from prefetched set if failed
          prefetchedUrls.current.delete(resolvedUrl);
        });
    } catch (err) {
      console.warn(`[Prefetch] Error prefetching ${src}:`, err);
    }
  }, []);

  const prefetchVideo = useCallback((src: string) => {
    const resolvedUrl = resolveVideoUrl(src, baseUrl);
    prefetchMedia(src, "video/mp4", resolvedUrl);
  }, [baseUrl, prefetchMedia]);

  const prefetchAudio = useCallback((src: string) => {
    // Resolve audio URL the same way sound-layer-content does
    let audioSrc = src;
    if (src.startsWith("/") && baseUrl) {
      audioSrc = `${baseUrl}${src}`;
    } else if (src.startsWith("/")) {
      audioSrc = toAbsoluteUrl(src);
    }
    const contentType = audioSrc.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
    prefetchMedia(src, contentType, audioSrc);
  }, [baseUrl, prefetchMedia]);

  // Prefetch all video and audio overlays
  useEffect(() => {
    // Prefetch videos
    const videoOverlays = overlays.filter(
      (overlay): overlay is ClipOverlay => overlay.type === OverlayType.VIDEO
    );
    const videoSources = new Set(videoOverlays.map((overlay) => overlay.src));
    videoSources.forEach((src) => {
      prefetchVideo(src);
    });

    // Prefetch audio/sound
    const soundOverlays = overlays.filter(
      (overlay): overlay is SoundOverlay => overlay.type === OverlayType.SOUND || overlay.type === ("sound" as any)
    );
    const audioSources = new Set(soundOverlays.filter((o) => o.src).map((o) => o.src));
    audioSources.forEach((src) => {
      prefetchAudio(src);
    });
  }, [overlays, prefetchVideo, prefetchAudio]);

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
