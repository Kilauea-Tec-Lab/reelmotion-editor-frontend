import { useMemo } from "react";
import { Overlay } from "../types";
import { FPS } from "../constants";

export const useCompositionDuration = (overlays: Overlay[]) => {
  const MIN_DURATION_IN_FRAMES = FPS * 60; // 1 minute minimum timeline for editing UI

  // Calculate the actual content duration (last frame of any overlay)
  const contentDurationInFrames = useMemo(() => {
    if (!overlays.length) return FPS; // Default to 1 second if no overlays

    const maxEndFrame = overlays.reduce((maxEnd, overlay) => {
      const endFrame = overlay.from + overlay.durationInFrames;
      return Math.max(maxEnd, endFrame);
    }, 0);

    return Math.max(maxEndFrame, FPS);
  }, [overlays]);

  // Timeline duration (for editing UI) - uses minimum of 1 minute
  const durationInFrames = useMemo(() => {
    return Math.max(contentDurationInFrames, MIN_DURATION_IN_FRAMES);
  }, [contentDurationInFrames]);

  // Utility functions for duration conversions
  const getDurationInSeconds = () => durationInFrames / FPS;
  const getDurationInFrames = () => durationInFrames;

  return {
    durationInFrames, // For timeline UI (has 1 min minimum)
    contentDurationInFrames, // For rendering (actual content duration)
    durationInSeconds: durationInFrames / FPS,
    contentDurationInSeconds: contentDurationInFrames / FPS,
    getDurationInSeconds,
    getDurationInFrames,
    fps: FPS,
  };
};
