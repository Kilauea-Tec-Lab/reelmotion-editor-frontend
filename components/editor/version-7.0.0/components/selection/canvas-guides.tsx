import React, { useMemo } from "react";
import { useCurrentScale, useVideoConfig } from "remotion";
import { Overlay, OverlayType } from "../../types";

/** Threshold in composition pixels for showing a guide */
const GUIDE_THRESHOLD = 5;

const GUIDE_COLOR = "#FF2E8B";
const GUIDE_COLOR_CENTER = "#3B8BF2";

type GuideLine = {
  type: "horizontal" | "vertical";
  position: number;
  isCenter: boolean;
};

/**
 * CanvasGuides renders alignment guide lines when an overlay is being dragged.
 * Shows guides when the dragged overlay aligns with:
 * - Canvas center (horizontal/vertical)
 * - Canvas edges
 * - Other overlay edges or centers
 */
export const CanvasGuides: React.FC<{
  overlays: Overlay[];
  selectedOverlayId: number | null;
}> = ({ overlays, selectedOverlayId }) => {
  const { width: canvasW, height: canvasH } = useVideoConfig();
  const scale = useCurrentScale();
  const lineWidth = Math.max(1, Math.ceil(1 / scale));

  const guides = useMemo(() => {
    const dragging = overlays.find(
      (o) => o.isDragging && o.id === selectedOverlayId
    );
    if (!dragging || dragging.type === OverlayType.SOUND) return [];

    const dragLeft = dragging.left;
    const dragTop = dragging.top;
    const dragRight = dragLeft + dragging.width;
    const dragBottom = dragTop + dragging.height;
    const dragCenterX = dragLeft + dragging.width / 2;
    const dragCenterY = dragTop + dragging.height / 2;

    const lines: GuideLine[] = [];
    const addedH = new Set<number>();
    const addedV = new Set<number>();

    const addGuide = (
      type: "horizontal" | "vertical",
      pos: number,
      isCenter: boolean
    ) => {
      const roundedPos = Math.round(pos);
      const set = type === "horizontal" ? addedH : addedV;
      if (set.has(roundedPos)) return;
      set.add(roundedPos);
      lines.push({ type, position: roundedPos, isCenter });
    };

    const near = (a: number, b: number) => Math.abs(a - b) < GUIDE_THRESHOLD;

    // Canvas center guides
    const canvasCX = canvasW / 2;
    const canvasCY = canvasH / 2;

    if (near(dragCenterX, canvasCX)) addGuide("vertical", canvasCX, true);
    if (near(dragCenterY, canvasCY)) addGuide("horizontal", canvasCY, true);

    // Canvas edge guides
    if (near(dragLeft, 0)) addGuide("vertical", 0, false);
    if (near(dragTop, 0)) addGuide("horizontal", 0, false);
    if (near(dragRight, canvasW)) addGuide("vertical", canvasW, false);
    if (near(dragBottom, canvasH)) addGuide("horizontal", canvasH, false);

    // Other overlays alignment
    for (const other of overlays) {
      if (
        other.id === dragging.id ||
        other.type === OverlayType.SOUND
      )
        continue;

      const oLeft = other.left;
      const oTop = other.top;
      const oRight = oLeft + other.width;
      const oBottom = oTop + other.height;
      const oCenterX = oLeft + other.width / 2;
      const oCenterY = oTop + other.height / 2;

      // Vertical guides (X alignment)
      if (near(dragLeft, oLeft)) addGuide("vertical", oLeft, false);
      if (near(dragLeft, oRight)) addGuide("vertical", oRight, false);
      if (near(dragRight, oLeft)) addGuide("vertical", oLeft, false);
      if (near(dragRight, oRight)) addGuide("vertical", oRight, false);
      if (near(dragCenterX, oCenterX)) addGuide("vertical", oCenterX, true);

      // Horizontal guides (Y alignment)
      if (near(dragTop, oTop)) addGuide("horizontal", oTop, false);
      if (near(dragTop, oBottom)) addGuide("horizontal", oBottom, false);
      if (near(dragBottom, oTop)) addGuide("horizontal", oTop, false);
      if (near(dragBottom, oBottom)) addGuide("horizontal", oBottom, false);
      if (near(dragCenterY, oCenterY)) addGuide("horizontal", oCenterY, true);
    }

    return lines;
  }, [overlays, selectedOverlayId, canvasW, canvasH]);

  if (guides.length === 0) return null;

  return (
    <>
      {guides.map((guide, i) => {
        const color = guide.isCenter ? GUIDE_COLOR_CENTER : GUIDE_COLOR;
        if (guide.type === "vertical") {
          return (
            <div
              key={`v-${i}`}
              style={{
                position: "absolute",
                left: guide.position,
                top: 0,
                width: lineWidth,
                height: canvasH,
                backgroundColor: color,
                pointerEvents: "none",
                zIndex: 50000,
              }}
            />
          );
        }
        return (
          <div
            key={`h-${i}`}
            style={{
              position: "absolute",
              top: guide.position,
              left: 0,
              height: lineWidth,
              width: canvasW,
              backgroundColor: color,
              pointerEvents: "none",
              zIndex: 50000,
            }}
          />
        );
      })}
    </>
  );
};
