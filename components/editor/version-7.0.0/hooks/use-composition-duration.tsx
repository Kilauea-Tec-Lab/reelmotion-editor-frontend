import { useMemo } from "react";
import { Overlay } from "../types";
import { FPS } from "../constants";

export const useCompositionDuration = (overlays: Overlay[]) => {
  const MIN_DURATION_IN_FRAMES = FPS * 60; // 1 minute minimum timeline

  // Calculate the total duration in frames based on overlays
  const durationInFrames = useMemo(() => {
    if (!overlays.length) return MIN_DURATION_IN_FRAMES;

    const maxEndFrame = overlays.reduce((maxEnd, overlay) => {
      const endFrame = overlay.from + overlay.durationInFrames;
      return Math.max(maxEnd, endFrame);
    }, 0);

    // Use the exact frame count but enforce a minimum of 1 minute
    return Math.max(maxEndFrame, MIN_DURATION_IN_FRAMES);
  }, [overlays]);

  // Utility functions for duration conversions
  const getDurationInSeconds = () => durationInFrames / FPS;
  const getDurationInFrames = () => durationInFrames;

  return {
    durationInFrames,
    durationInSeconds: durationInFrames / FPS,
    getDurationInSeconds,
    getDurationInFrames,
    fps: FPS,
  };
};
