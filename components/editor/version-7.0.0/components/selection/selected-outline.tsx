import React, { useCallback, useMemo } from "react";
import { useCurrentScale, useVideoConfig } from "remotion";
import { ResizeHandle } from "./resize-handle";
import { Overlay, OverlayType } from "../../types";
import { RotateHandle } from "./rotate-handle";

const SNAP_THRESHOLD = 5;

/** Calculate snapped position for an overlay being dragged */
function snapPosition(
  left: number,
  top: number,
  width: number,
  height: number,
  canvasW: number,
  canvasH: number,
  otherOverlays: Overlay[]
): { left: number; top: number } {
  let snappedLeft = left;
  let snappedTop = top;

  const centerX = left + width / 2;
  const centerY = top + height / 2;
  const right = left + width;
  const bottom = top + height;

  const canvasCX = canvasW / 2;
  const canvasCY = canvasH / 2;

  // Collect snap targets
  const xTargets: { edge: number; anchor: "left" | "center" | "right" }[] = [
    { edge: 0, anchor: "left" },
    { edge: canvasCX, anchor: "center" },
    { edge: canvasW, anchor: "right" },
  ];
  const yTargets: { edge: number; anchor: "top" | "center" | "bottom" }[] = [
    { edge: 0, anchor: "top" },
    { edge: canvasCY, anchor: "center" },
    { edge: canvasH, anchor: "bottom" },
  ];

  for (const o of otherOverlays) {
    if (o.type === OverlayType.SOUND) continue;
    xTargets.push(
      { edge: o.left, anchor: "left" },
      { edge: o.left + o.width, anchor: "right" },
      { edge: o.left + o.width / 2, anchor: "center" }
    );
    yTargets.push(
      { edge: o.top, anchor: "top" },
      { edge: o.top + o.height, anchor: "bottom" },
      { edge: o.top + o.height / 2, anchor: "center" }
    );
  }

  // Find closest X snap
  let bestXDist = SNAP_THRESHOLD;
  for (const t of xTargets) {
    for (const [val, ref] of [
      [left, "left"],
      [centerX, "center"],
      [right, "right"],
    ] as [number, string][]) {
      const dist = Math.abs(val - t.edge);
      if (dist < bestXDist) {
        bestXDist = dist;
        if (ref === "left") snappedLeft = t.edge;
        else if (ref === "center") snappedLeft = t.edge - width / 2;
        else snappedLeft = t.edge - width;
      }
    }
  }

  // Find closest Y snap
  let bestYDist = SNAP_THRESHOLD;
  for (const t of yTargets) {
    for (const [val, ref] of [
      [top, "top"],
      [centerY, "center"],
      [bottom, "bottom"],
    ] as [number, string][]) {
      const dist = Math.abs(val - t.edge);
      if (dist < bestYDist) {
        bestYDist = dist;
        if (ref === "top") snappedTop = t.edge;
        else if (ref === "center") snappedTop = t.edge - height / 2;
        else snappedTop = t.edge - height;
      }
    }
  }

  return { left: Math.round(snappedLeft), top: Math.round(snappedTop) };
}

/**
 * SelectionOutline is a component that renders a draggable, resizable outline around selected overlays.
 * It provides visual feedback and interaction handles for manipulating overlay elements.
 *
 * @component
 * @param {Object} props
 * @param {Overlay} props.overlay - The overlay object containing position, size, and other properties
 * @param {Function} props.changeOverlay - Callback to update overlay properties
 * @param {Function} props.setSelectedOverlayId - Function to update the currently selected overlay
 * @param {number|null} props.selectedOverlayId - ID of the currently selected overlay
 * @param {boolean} props.isDragging - Whether the overlay is currently being dragged
 */
export const SelectionOutline: React.FC<{
  overlay: Overlay;
  changeOverlay: (
    overlayId: number,
    updater: (overlay: Overlay) => Overlay
  ) => void;
  setSelectedOverlayId: React.Dispatch<React.SetStateAction<number | null>>;
  selectedOverlayId: number | null;
  isDragging: boolean;
  allOverlays: Overlay[];
}> = ({
  overlay,
  changeOverlay,
  setSelectedOverlayId,
  selectedOverlayId,
  isDragging,
  allOverlays,
}) => {
  const scale = useCurrentScale();
  const { width: canvasW, height: canvasH } = useVideoConfig();
  const scaledBorder = Math.ceil(1 / scale);

  const [hovered, setHovered] = React.useState(false);

  const onMouseEnter = useCallback(() => {
    setHovered(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

  const isSelected = overlay.id === selectedOverlayId;

  const style: React.CSSProperties = useMemo(() => {
    // Selection outlines should match layer stacking
    // But start at 1000 to be above content
    // e.g. row 4 = z-index 960, row 0 = z-index 1000
    const baseZIndex = 1000 - (overlay.row || 0) * 10;

    // Selected items get an additional boost
    const selectionBoost = isSelected ? 1000 : 0;
    const zIndex = baseZIndex + selectionBoost;

    return {
      width: Number.isFinite(overlay.width) ? overlay.width : 0,
      height: Number.isFinite(overlay.height) ? overlay.height : 0,
      left: overlay.left,
      top: overlay.top,
      position: "absolute",
      outline:
        (hovered && !isDragging) || isSelected
          ? `${scaledBorder}px solid #3B8BF2`
          : undefined,
      transform: `rotate(${overlay.rotation || 0}deg)`,
      transformOrigin: "center center",
      userSelect: "none",
      touchAction: "none",
      zIndex,
      pointerEvents: "all",
      // hovered || isDragging ? "all" : isSelected ? "none" : "all",
      cursor: "pointer",
    };
  }, [overlay, hovered, isDragging, isSelected, scaledBorder]);

  const startDragging = useCallback(
    (e: PointerEvent | React.MouseEvent) => {
      const initialX = e.clientX;
      const initialY = e.clientY;

      const onPointerMove = (pointerMoveEvent: PointerEvent) => {
        const offsetX = (pointerMoveEvent.clientX - initialX) / scale;
        const offsetY = (pointerMoveEvent.clientY - initialY) / scale;
        const rawLeft = overlay.left + offsetX;
        const rawTop = overlay.top + offsetY;

        const others = allOverlays.filter((o) => o.id !== overlay.id);
        const snapped = snapPosition(
          rawLeft,
          rawTop,
          overlay.width,
          overlay.height,
          canvasW,
          canvasH,
          others
        );

        changeOverlay(overlay.id, (o) => {
          return {
            ...o,
            left: snapped.left,
            top: snapped.top,
            isDragging: true,
          };
        });
      };

      const onPointerUp = () => {
        changeOverlay(overlay.id, (o) => {
          return {
            ...o,
            isDragging: false,
          };
        });
        window.removeEventListener("pointermove", onPointerMove);
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });

      window.addEventListener("pointerup", onPointerUp, {
        once: true,
      });
    },
    [overlay, scale, changeOverlay, allOverlays, canvasW, canvasH]
  );

  const onPointerDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.button !== 0) {
        return;
      }

      setSelectedOverlayId(overlay.id);
      startDragging(e);
    },
    [overlay.id, setSelectedOverlayId, startDragging]
  );

  if (overlay.type === OverlayType.SOUND) {
    return null;
  }

  return (
    <>
      <div
        onPointerDown={onPointerDown}
        onPointerEnter={onMouseEnter}
        onPointerLeave={onMouseLeave}
        style={style}
      >
        {isSelected ? (
          <>
            <ResizeHandle
              overlay={overlay}
              setOverlay={changeOverlay}
              type="top-left"
            />
            <ResizeHandle
              overlay={overlay}
              setOverlay={changeOverlay}
              type="top-right"
            />
            <ResizeHandle
              overlay={overlay}
              setOverlay={changeOverlay}
              type="bottom-left"
            />
            <ResizeHandle
              overlay={overlay}
              setOverlay={changeOverlay}
              type="bottom-right"
            />
            <RotateHandle
              overlay={overlay}
              setOverlay={changeOverlay}
              scale={scale}
            />
          </>
        ) : null}
      </div>
    </>
  );
};
