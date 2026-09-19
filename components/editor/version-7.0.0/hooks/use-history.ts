import { useState, useCallback, useEffect, useRef } from "react";
import { Overlay } from "../types";

interface HistoryState {
  past: Overlay[][];
  present: Overlay[];
  future: Overlay[][];
}

/** ponytail: fixed cap; undo beyond 50 steps is not a real need. */
const MAX_HISTORY = 50;

export function useHistory(
  overlays: Overlay[],
  setOverlays: (overlays: Overlay[]) => void
) {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: overlays,
    future: [],
  });
  // Set when undo/redo writes overlays so that write is not recorded again.
  const skipNextRef = useRef<Overlay[] | null>(null);

  useEffect(() => {
    if (skipNextRef.current === overlays) {
      skipNextRef.current = null;
      return;
    }
    // A canvas drag/resize/rotate writes overlays on every pointermove with
    // isDragging=true; only the final write (isDragging=false) is one undo step.
    if (overlays.some((o) => o.isDragging)) return;

    setHistory((prev) => {
      if (prev.present === overlays) return prev;
      return {
        past: [...prev.past, prev.present].slice(-MAX_HISTORY),
        present: overlays,
        future: [],
      };
    });
  }, [overlays]);

  const undo = useCallback(() => {
    if (history.past.length === 0) return;
    const newPresent = history.past[history.past.length - 1];
    skipNextRef.current = newPresent;
    setOverlays(newPresent);
    setHistory({
      past: history.past.slice(0, -1),
      present: newPresent,
      future: [history.present, ...history.future],
    });
  }, [history, setOverlays]);

  const redo = useCallback(() => {
    if (history.future.length === 0) return;
    const newPresent = history.future[0];
    skipNextRef.current = newPresent;
    setOverlays(newPresent);
    setHistory({
      past: [...history.past, history.present],
      present: newPresent,
      future: history.future.slice(1),
    });
  }, [history, setOverlays]);

  return {
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
