import { Overlay } from "../types";

export const useTimelinePositioning = () => {
  /**
   * Finds the next available position for a new overlay in a multi-row timeline
   * @param existingOverlays - Array of current overlays in the timeline
   * @param visibleRows - Number of rows currently visible in the timeline
   * @param totalDuration - Total duration of the timeline in frames
   * @returns Object containing the starting position (from) and row number
   */
  const findNextAvailablePosition = (
    existingOverlays: Overlay[],
    visibleRows: number,
    totalDuration: number
  ): { from: number; row: number } => {
    // If no overlays exist, start at the beginning
    if (existingOverlays.length === 0) {
      return { from: 0, row: 0 };
    }

    // UX rule: always assign new overlays to the first channel (row 0).
    // To prevent overlaps (we don't know the new overlay duration here), always append
    // to the end of row 0.
    const endOfFirstRow = existingOverlays.reduce((maxEnd, overlay) => {
      if (overlay.row !== 0) return maxEnd;
      return Math.max(maxEnd, overlay.from + overlay.durationInFrames);
    }, 0);

    return { from: endOfFirstRow, row: 0 };
  };

  return { findNextAvailablePosition };
};
