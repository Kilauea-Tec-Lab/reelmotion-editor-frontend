import { useMemo, RefObject } from "react";
import { Overlay } from "../types";
import { SNAPPING_CONFIG } from "../constants";

type GhostElement = {
  left: number; // Position from left as percentage
  width: number; // Width as percentage
  top: number; // Vertical position
} | null;

interface DragInfo {
  action: "move" | "resize-start" | "resize-end";
}

interface UseTimelineSnappingProps {
  isDragging: boolean;
  ghostElement: GhostElement;
  draggedItem: Overlay | null;
  dragInfo: RefObject<DragInfo>;
  overlays: Overlay[];
  durationInFrames: number;
  visibleRows: number;
  snapThreshold?: number;
  /** Extra frames to snap to (playhead, 0). */
  extraSnapFrames?: number[];
}

interface UseTimelineSnappingResult {
  alignmentLines: number[];
  snappedGhostElement: GhostElement;
}

/**
 * Snaps the drag ghost to the edges of other clips (any row), the playhead and
 * frame 0. Pure derivation from the ghost: no effects, no extra render passes.
 */
export const useTimelineSnapping = ({
  isDragging,
  ghostElement,
  draggedItem,
  dragInfo,
  overlays,
  durationInFrames,
  snapThreshold = SNAPPING_CONFIG.thresholdFrames,
  extraSnapFrames,
}: UseTimelineSnappingProps): UseTimelineSnappingResult => {
  // Candidate edges only change when the overlays do, not on every mousemove.
  const candidateFrames = useMemo(() => {
    const frames = new Set<number>([0, ...(extraSnapFrames ?? [])]);
    overlays.forEach((o) => {
      if (o.id === draggedItem?.id) return;
      frames.add(o.from);
      frames.add(o.from + o.durationInFrames);
    });
    return Array.from(frames);
  }, [overlays, draggedItem?.id, extraSnapFrames]);

  return useMemo(() => {
    const none = { alignmentLines: [], snappedGhostElement: ghostElement };
    if (
      !SNAPPING_CONFIG.enableVerticalSnapping ||
      !isDragging ||
      !ghostElement ||
      !dragInfo.current
    ) {
      return none;
    }

    const action = dragInfo.current.action;
    const startFrame = (ghostElement.left / 100) * durationInFrames;
    const endFrame = ((ghostElement.left + ghostElement.width) / 100) * durationInFrames;
    const duration = Math.max(1, Math.round(endFrame - startFrame));

    let best: { frame: number; edge: "start" | "end"; diff: number } | null = null;
    for (const frame of candidateFrames) {
      if (action !== "resize-end") {
        const diff = Math.abs(startFrame - frame);
        if (diff <= snapThreshold && (!best || diff < best.diff)) best = { frame, edge: "start", diff };
      }
      if (action !== "resize-start") {
        const diff = Math.abs(endFrame - frame);
        if (diff <= snapThreshold && (!best || diff < best.diff)) best = { frame, edge: "end", diff };
      }
    }
    if (!best) return none;

    let snappedStart: number;
    let snappedDuration = duration;
    if (action === "move") {
      snappedStart = best.edge === "start" ? best.frame : best.frame - duration;
    } else if (action === "resize-start") {
      snappedStart = best.frame;
      snappedDuration = Math.max(1, Math.round(endFrame) - snappedStart);
    } else {
      snappedStart = Math.round(startFrame);
      snappedDuration = Math.max(1, best.frame - snappedStart);
    }

    return {
      alignmentLines: [best.frame],
      snappedGhostElement: {
        top: ghostElement.top,
        left: Math.max(0, (snappedStart / durationInFrames) * 100),
        width: Math.max(0.0001, (snappedDuration / durationInFrames) * 100),
      },
    };
  }, [isDragging, ghostElement, dragInfo, durationInFrames, snapThreshold, candidateFrames]);
};
