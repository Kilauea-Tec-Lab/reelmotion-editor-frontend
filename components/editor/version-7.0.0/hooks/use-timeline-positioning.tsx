import { Overlay } from "../types";

export const useTimelinePositioning = () => {
  /**
   * Finds the next available position for a new overlay in a multi-row timeline.
   * Places at the current playhead position and finds the first row without conflicts.
   * @param existingOverlays - Array of current overlays in the timeline
   * @param visibleRows - Number of rows currently visible in the timeline
   * @param totalDuration - Total duration of the timeline in frames
   * @param currentFrame - Current playhead position (frame number)
   * @returns Object containing the starting position (from) and row number
   */
  const findNextAvailablePosition = (
    existingOverlays: Overlay[],
    visibleRows: number,
    totalDuration: number,
    currentFrame: number = 0
  ): { from: number; row: number } => {
    // Always start at the playhead position
    const from = currentFrame;

    // Find the first row where no existing overlay occupies the current frame
    for (let row = 0; row < visibleRows; row++) {
      const hasConflict = existingOverlays.some(
        (overlay) =>
          overlay.row === row &&
          overlay.from < from + 1 &&
          overlay.from + overlay.durationInFrames > from
      );
      if (!hasConflict) {
        return { from, row };
      }
    }

    // All visible rows occupied at this frame — use the last visible row
    return { from, row: visibleRows - 1 };
  };

  return { findNextAvailablePosition };
};
