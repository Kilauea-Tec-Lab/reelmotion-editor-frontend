import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useEditorContext } from "../contexts/editor-context";
import { useTimeline } from "../contexts/timeline-context";
import { useTimelinePositioning } from "./use-timeline-positioning";
import { FPS, ZOOM_CONSTRAINTS } from "../constants";
import { Overlay } from "../types";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * All editor keyboard shortcuts (CapCut-style) in one place. Inputs and
 * contentEditable are ignored by react-hotkeys-hook's defaults.
 *
 * Space play/pause · K pause · L play · J back 1s · ←/→ ±1 frame ·
 * Shift+←/→ ±1s · Home/End · Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y · Ctrl+B split ·
 * Ctrl+C/V copy/paste · Ctrl+D duplicate · Ctrl+A select all · Esc deselect ·
 * Delete/Backspace · +/- zoom · S snap toggle
 */
export const useEditorShortcuts = () => {
  const {
    overlays,
    playerRef,
    getCurrentFrame,
    togglePlayPause,
    durationInFrames,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedOverlayId,
    selectedOverlayIds,
    setSelectedOverlayId,
    setSelectedOverlayIds,
    deleteOverlay,
    duplicateOverlay,
    splitOverlay,
    addOverlay,
  } = useEditorContext();
  const { zoomScale, setZoomScale, visibleRows, toggleSnap } = useTimeline();
  const { findNextAvailablePosition } = useTimelinePositioning();
  const clipboard = useRef<Overlay[]>([]);

  const opts = { preventDefault: true };
  const seekBy = (delta: number) =>
    playerRef.current?.seekTo(clamp(getCurrentFrame() + delta, 0, Math.max(0, durationInFrames - 1)));
  const zoomBy = (delta: number) =>
    setZoomScale(clamp(zoomScale + delta * ZOOM_CONSTRAINTS.step, ZOOM_CONSTRAINTS.min, ZOOM_CONSTRAINTS.max));

  useHotkeys("space", togglePlayPause, opts, [togglePlayPause]);
  useHotkeys("k", () => playerRef.current?.pause(), opts);
  useHotkeys("l", () => playerRef.current?.play(), opts);
  useHotkeys("j", () => seekBy(-FPS), opts, [getCurrentFrame, durationInFrames]);
  useHotkeys("left", () => seekBy(-1), opts, [getCurrentFrame, durationInFrames]);
  useHotkeys("right", () => seekBy(1), opts, [getCurrentFrame, durationInFrames]);
  useHotkeys("shift+left", () => seekBy(-FPS), opts, [getCurrentFrame, durationInFrames]);
  useHotkeys("shift+right", () => seekBy(FPS), opts, [getCurrentFrame, durationInFrames]);
  useHotkeys("home", () => playerRef.current?.seekTo(0), opts);
  useHotkeys("end", () => playerRef.current?.seekTo(Math.max(0, durationInFrames - 1)), opts, [durationInFrames]);

  useHotkeys("mod+z", () => canUndo && undo(), opts, [canUndo, undo]);
  useHotkeys("mod+shift+z, mod+y", () => canRedo && redo(), opts, [canRedo, redo]);

  useHotkeys(
    "delete, backspace",
    () => selectedOverlayIds.length && deleteOverlay(selectedOverlayIds),
    opts,
    [selectedOverlayIds, deleteOverlay]
  );
  useHotkeys("escape", () => setSelectedOverlayId(null), opts, [setSelectedOverlayId]);
  useHotkeys("mod+a", () => setSelectedOverlayIds(overlays.map((o) => o.id)), opts, [overlays, setSelectedOverlayIds]);
  useHotkeys("mod+d", () => selectedOverlayId !== null && duplicateOverlay(selectedOverlayId), opts, [selectedOverlayId, duplicateOverlay]);
  useHotkeys(
    "mod+b",
    () => selectedOverlayId !== null && splitOverlay(selectedOverlayId, getCurrentFrame()),
    opts,
    [selectedOverlayId, splitOverlay, getCurrentFrame]
  );

  useHotkeys(
    "mod+c",
    () => {
      clipboard.current = overlays.filter((o) => selectedOverlayIds.includes(o.id));
    },
    opts,
    [overlays, selectedOverlayIds]
  );
  useHotkeys(
    "mod+v",
    () => {
      const copied = clipboard.current;
      if (!copied.length) return;
      const first = Math.min(...copied.map((o) => o.from));
      const playhead = getCurrentFrame();
      // ponytail: each paste lands at the playhead on the first free row; group
      // layout across rows is not preserved.
      copied.forEach((o) => {
        const from = playhead + (o.from - first);
        const { row } = findNextAvailablePosition(overlays, visibleRows, durationInFrames, from);
        addOverlay({ ...o, from, row, isDragging: false });
      });
    },
    opts,
    [overlays, visibleRows, durationInFrames, getCurrentFrame, addOverlay, findNextAvailablePosition]
  );

  useHotkeys("=, alt+=", () => zoomBy(1), opts, [zoomScale, setZoomScale]);
  useHotkeys("-, alt+-", () => zoomBy(-1), opts, [zoomScale, setZoomScale]);
  useHotkeys("s", toggleSnap, opts, [toggleSnap]);
};
