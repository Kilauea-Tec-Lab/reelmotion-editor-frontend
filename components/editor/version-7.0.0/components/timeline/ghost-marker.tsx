import React from "react";

/**
 * Props for the GhostMarker component.
 */
interface GhostMarkerProps {
  /** DOM ref; the timeline moves the marker by writing style.left directly (no React state per mousemove). */
  markerRef: React.RefObject<HTMLDivElement>;

  /** Indicates whether a dragging action is currently in progress. */
  isDragging: boolean;

  /** Indicates whether the context menu is open. */
  isContextMenuOpen: boolean;
}

/**
 * GhostMarker component displays a vertical line with a triangle on top to indicate a specific position.
 * It's typically used in editing interfaces to show potential insertion points or selections.
 *
 * @param {GhostMarkerProps} props - The props for the GhostMarker component.
 * @returns {React.ReactElement | null} The rendered GhostMarker or null if it should not be displayed.
 */
const GhostMarker: React.FC<GhostMarkerProps> = ({
  markerRef,
  isDragging,
  isContextMenuOpen,
}) => {
  if (isDragging || isContextMenuOpen) {
    return null;
  }

  return (
    <div
      ref={markerRef}
      className="absolute top-0 w-[2px] bg-sky-500/50 dark:bg-blue-500/50 pointer-events-none z-40"
      style={{ display: "none", height: "100%" }}
    >
      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-sky-500 dark:border-t-blue-500 absolute top-[0px] left-1/2 transform -translate-x-1/2 pointer-events-none" />
    </div>
  );
};

export default GhostMarker;
