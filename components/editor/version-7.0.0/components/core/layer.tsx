import React, { useMemo } from "react";
import { Sequence } from "remotion";
import { LayerContent } from "./layer-content";
import { Overlay, OverlayType } from "../../types";

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
}> = ({ overlay, selectedOverlayId, baseUrl }) => {
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
    const zIndex = typeZIndex - rowOffset;
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
      durationInFrames={overlay.durationInFrames}
      layout="none"
    >
      <div style={style}>
        <LayerContent overlay={overlay} baseUrl={baseUrl} />
      </div>
    </Sequence>
  );
};
