import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { LayerContent } from "./layer-content";
import { Overlay, OverlayType } from "../../types";
import { FPS } from "../../constants";
import { getTransitionFrameStyle, LayerTransition } from "../../utils/transitions";

/** Dip-to-color / flash: a full cover drawn over the incoming clip. */
const TransitionColorOverlay: React.FC<{ transition: LayerTransition }> = ({ transition }) => {
  const frame = useCurrentFrame();
  const { overlayColor } = getTransitionFrameStyle(transition, frame);
  if (!overlayColor) return null;
  return <AbsoluteFill style={{ backgroundColor: overlayColor, pointerEvents: "none" }} />;
};

/**
 * Get the base z-index for an overlay type
 * Elements like text, stickers, captions always appear above videos/images
 */
const getTypeZIndex = (type: OverlayType | string): number => {
  switch (type) {
    case OverlayType.TEXT:
    case "text":
      return 500; // Text always on top
    case OverlayType.CAPTION:
    case "caption":
      return 480; // Captions very high
    case OverlayType.STICKER:
    case "sticker":
      return 460; // Stickers high
    case OverlayType.SHAPE:
    case "shape":
      return 440; // Shapes above media
    case OverlayType.IMAGE:
    case "image":
      return 200; // Images in middle
    case OverlayType.VIDEO:
    case "video":
      return 100; // Videos at base
    default:
      return 100;
  }
};

/**
 * Props for the Layer component
 * @interface LayerProps
 * @property {Overlay} overlay - The overlay object containing position, dimensions, and content information
 * @property {number | null} selectedOverlayId - ID of the currently selected overlay, used for interaction states
 * @property {string | undefined} baseUrl - The base URL for the video
 */
export const Layer: React.FC<{
  overlay: Overlay;
  selectedOverlayId: number | null;
  baseUrl?: string;
  /** From resolveTransitions: extended timing + per-frame style when this clip transitions. */
  transition?: LayerTransition;
}> = React.memo(function Layer({ overlay, selectedOverlayId, baseUrl, transition }) {
  /**
   * Memoized style calculations for the layer
   * Handles positioning, dimensions, rotation, and z-index based on:
   * - Overlay type (text/stickers always above videos/images)
   * - Row position for secondary ordering within same type
   * - Selection state for pointer events
   *
   * @returns {React.CSSProperties} Computed styles for the layer
   */
  const style: React.CSSProperties = useMemo(() => {
    // Base z-index from overlay type (text/stickers always above videos)
    const typeZIndex = getTypeZIndex(overlay.type);
    // Secondary ordering: higher rows are visually below within same type
    const rowOffset = (overlay.row || 0) * 2;
    // Clips overlapping during a transition: the later one composes on top.
    const zIndex = (typeZIndex - rowOffset) * 1000 + (transition?.zRank ?? 0);
    const isSelected = overlay.id === selectedOverlayId;

    return {
      position: "absolute",
      left: overlay.left,
      top: overlay.top,
      width: overlay.width,
      height: overlay.height,
      transform: `rotate(${overlay.rotation || 0}deg)`,
      transformOrigin: "center center",
      zIndex,
      pointerEvents: isSelected ? "all" : "none",
    };
  }, [
    overlay.height,
    overlay.left,
    overlay.top,
    overlay.width,
    overlay.rotation,
    overlay.row,
    overlay.id,
    overlay.type,
    selectedOverlayId,
    transition?.zRank,
  ]);

  /**
   * Special handling for sound overlays
   * Sound overlays don't need positioning or visual representation,
   * they just need to be sequenced correctly
   */
  if (overlay.type === "sound") {
    return (
      <Sequence
        key={overlay.id}
        from={overlay.from}
        durationInFrames={overlay.durationInFrames}
        premountFor={FPS}
      >
        <LayerContent overlay={overlay} baseUrl={baseUrl} />
      </Sequence>
    );
  }

  /**
   * Standard layer rendering for visual elements
   * Wraps the content in a Sequence for timing control and
   * a positioned div for layout management
   */
  return (
    <Sequence
      key={overlay.id}
      from={overlay.from}
      durationInFrames={transition?.sequenceDurationInFrames ?? overlay.durationInFrames}
      premountFor={FPS}
    >
      <div style={style}>
        <LayerContent overlay={overlay} baseUrl={baseUrl} transition={transition} />
        {transition?.in && <TransitionColorOverlay transition={transition} />}
      </div>
    </Sequence>
  );
});
