import { useState, useCallback, useRef } from "react";
import { Overlay, OverlayType, CaptionStyles, CaptionOverlay } from "../types";
import { defaultCaptionStyles } from "../components/overlays/captions/caption-settings";

/**
 * Hook to manage overlay elements in the editor
 * Overlays can be text, videos, or sounds that are positioned on the timeline
 * @returns Object containing overlay state and management functions
 */
export const useOverlays = (initialOverlays?: Overlay[]) => {
  // Initialize with provided overlays or default overlays
  const [overlays, setOverlays] = useState<Overlay[]>(initialOverlays || []);
  // Mirror for stable callbacks that need the latest list without re-creating.
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const nextIdRef = useRef(0);

  // Selection: the last id is the "primary" one (panels, canvas outline);
  // the whole list is used by delete / copy.
  const [selectedOverlayIds, setSelectedOverlayIds] = useState<number[]>([]);
  const selectedOverlayId =
    selectedOverlayIds.length > 0 ? selectedOverlayIds[selectedOverlayIds.length - 1] : null;
  const setSelectedOverlayId = useCallback(
    (id: number | null) => setSelectedOverlayIds(id === null ? [] : [id]),
    []
  );
  const toggleSelectedOverlayId = useCallback(
    (id: number) =>
      setSelectedOverlayIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      ),
    []
  );

  /**
   * Updates properties of a specific overlay
   * Supports both direct property updates and functional updates
   * @example
   * // Direct update
   * changeOverlay(1, { width: 100 })
   * // Functional update
   * changeOverlay(1, (overlay) => ({ ...overlay, width: overlay.width + 10 }))
   */
  const changeOverlay = useCallback(
    (
      overlayId: number,
      updater: Partial<Overlay> | ((overlay: Overlay) => Overlay)
    ) => {
      setOverlays((prevOverlays) =>
        prevOverlays.map((overlay) => {
          if (overlay.id !== overlayId) return overlay;
          return typeof updater === "function"
            ? updater(overlay)
            : ({ ...overlay, ...updater } as Overlay);
        })
      );
    },
    []
  );

  /**
   * Adds a new overlay to the editor
   * Automatically generates a new unique ID and appends it to the overlays array
   * Deselects any currently selected overlay
   */
  const addOverlay = useCallback((newOverlay: Omit<Overlay, "id">) => {
    // Updaters run lazily in React 18, so the id must be decided up front.
    const maxExisting = overlaysRef.current.reduce((m, o) => Math.max(m, o.id), -1);
    const newId = Math.max(nextIdRef.current, maxExisting + 1);
    nextIdRef.current = newId + 1;
    setOverlays((prevOverlays) => [
      ...prevOverlays,
      { ...newOverlay, id: newId } as Overlay,
    ]);
    setSelectedOverlayId(newId);
  }, []);

  /**
   * Removes an overlay by its ID and clears the selection
   */
  const deleteOverlay = useCallback((id: number | number[]) => {
    const ids = Array.isArray(id) ? id : [id];
    setOverlays((prevOverlays) =>
      prevOverlays.filter((overlay) => !ids.includes(overlay.id))
    );
    setSelectedOverlayId(null);
  }, [setSelectedOverlayId]);

  /**
   * Removes all overlays on a specified row
   * @param row The row number to clear
   */
  const deleteOverlaysByRow = useCallback((row: number) => {
    setOverlays((prevOverlays) =>
      prevOverlays.filter((overlay) => overlay.row !== row)
    );
    setSelectedOverlayId(null);
  }, []);

  /**
   * Creates a copy of an existing overlay
   * The duplicated overlay is positioned immediately after the original in the timeline
   */
  const duplicateOverlay = useCallback((id: number) => {
    setOverlays((prevOverlays) => {
      const overlayToDuplicate = prevOverlays.find(
        (overlay) => overlay.id === id
      );
      if (!overlayToDuplicate) return prevOverlays;

      const newId = Math.max(...prevOverlays.map((o) => o.id)) + 1;

      // Find any overlays that would overlap with the duplicated position
      const overlaysInRow = prevOverlays.filter(
        (o) => o.row === overlayToDuplicate.row && o.id !== id
      );

      // Calculate initial position for duplicate
      let newFrom =
        overlayToDuplicate.from + overlayToDuplicate.durationInFrames;

      // Check for overlaps and adjust position if needed
      let hasOverlap = true;
      while (hasOverlap) {
        hasOverlap = overlaysInRow.some((existingOverlay) => {
          const duplicateEnd = newFrom + overlayToDuplicate.durationInFrames;
          const existingEnd =
            existingOverlay.from + existingOverlay.durationInFrames;

          // Check for any overlap
          return (
            (newFrom >= existingOverlay.from && newFrom < existingEnd) ||
            (duplicateEnd > existingOverlay.from &&
              duplicateEnd <= existingEnd) ||
            (newFrom <= existingOverlay.from && duplicateEnd >= existingEnd)
          );
        });

        if (hasOverlap) {
          // If there's an overlap, try positioning after the last overlay in the row
          const lastOverlay = [...overlaysInRow].sort(
            (a, b) =>
              b.from + b.durationInFrames - (a.from + a.durationInFrames)
          )[0];
          newFrom = lastOverlay
            ? lastOverlay.from + lastOverlay.durationInFrames
            : newFrom + 1;
        }
      }

      const duplicatedOverlay: Overlay = {
        ...overlayToDuplicate,
        id: newId,
        from: newFrom,
      };

      return [...prevOverlays, duplicatedOverlay];
    });
  }, []);

  /**
   * Splits an overlay into two separate overlays at a specified frame
   * Useful for creating cuts or transitions in video/audio content
   * @example
   * // Split an overlay at frame 100
   * splitOverlay(1, 100)
   */
  const splitOverlay = useCallback((id: number, splitFrame: number) => {
    const fps = 30; // Make this configurable
    const msPerFrame = 1000 / fps;

    setOverlays((prevOverlays) => {
      const overlayToSplit = prevOverlays.find((overlay) => overlay.id === id);
      if (!overlayToSplit) {
        return prevOverlays;
      }

      // Validate split point
      if (
        splitFrame <= overlayToSplit.from ||
        splitFrame >= overlayToSplit.from + overlayToSplit.durationInFrames
      ) {
        console.warn("Invalid split point");
        return prevOverlays;
      }

      const firstPartDuration = splitFrame - overlayToSplit.from;
      const secondPartDuration =
        overlayToSplit.durationInFrames - firstPartDuration;
      const newId = Math.max(...prevOverlays.map((o) => o.id)) + 1;

      // Calculate start times for media overlays
      const secondHalfStartTime = calculateSecondHalfStartTime(
        overlayToSplit,
        firstPartDuration
      );

      // Create split overlays
      const [firstHalf, secondHalf] = createSplitOverlays(
        overlayToSplit,
        newId,
        splitFrame,
        firstPartDuration,
        secondPartDuration,
        secondHalfStartTime
      );

      return prevOverlays
        .map((overlay) => (overlay.id === id ? firstHalf : overlay))
        .concat(secondHalf);
    });
  }, []);

  const updateOverlayStyles = useCallback(
    (overlayId: number, styles: Partial<CaptionStyles>) => {
      changeOverlay(overlayId, (overlay) => {
        if (overlay.type !== OverlayType.CAPTION) return overlay;
        return {
          ...overlay,
          styles: {
            ...(overlay.styles || defaultCaptionStyles),
            ...styles,
          },
        };
      });
    },
    [changeOverlay]
  );

  const resetOverlays = useCallback(() => {
    setOverlays([]);
    setSelectedOverlayId(null);
  }, []);

  return {
    overlays,
    selectedOverlayId,
    setSelectedOverlayId,
    selectedOverlayIds,
    setSelectedOverlayIds,
    toggleSelectedOverlayId,
    setOverlays,
    changeOverlay,
    addOverlay,
    deleteOverlay,
    deleteOverlaysByRow,
    duplicateOverlay,
    splitOverlay,
    updateOverlayStyles,
    resetOverlays,
  };
};

/**
 * Calculates the starting time for the second half of a split media overlay
 * For clips and sounds, we need to adjust their internal start times
 * to maintain continuity after the split
 */
const calculateSecondHalfStartTime = (
  overlay: Overlay,
  firstPartDuration: number
): number => {
  if (overlay.type === OverlayType.VIDEO) {
    return (overlay.videoStartTime || 0) + firstPartDuration;
  }
  if (overlay.type === OverlayType.SOUND) {
    return (overlay.startFromSound || 0) + firstPartDuration;
  }
  return 0;
};

/**
 * Creates two new overlay objects from an original overlay when splitting
 * The first half maintains the original ID and timing
 * The second half gets a new ID and adjusted timing properties
 * Preserves all other properties from the original overlay
 */
const createSplitOverlays = (
  original: Overlay,
  newId: number,
  splitFrame: number,
  firstPartDuration: number,
  secondPartDuration: number,
  secondHalfStartTime: number
): [Overlay, Overlay] => {
  const fps = 30;
  const msPerFrame = 1000 / fps;
  const splitTimeMs = splitFrame * msPerFrame;

  if (original.type === OverlayType.CAPTION) {
    // Calculate absolute time ranges for both splits
    const originalStartMs = original.from * msPerFrame;
    const splitOffsetMs = splitTimeMs - originalStartMs; // Time relative to overlay start


    // Split captions at word level, keeping timestamps relative to their overlay
    const firstHalfCaptions = original.captions
      .filter((caption) => caption.startMs < splitOffsetMs)
      .map((caption) => ({
        ...caption,
        endMs: Math.min(caption.endMs, splitOffsetMs),
        words: caption.words
          .filter((word) => word.startMs < splitOffsetMs)
          .map((word) => ({
            ...word,
            endMs: Math.min(word.endMs, splitOffsetMs),
          })),
      }))
      .filter((caption) => caption.words.length > 0)
      .map((caption) => ({
        ...caption,
        text: caption.words.map((w) => w.word).join(" "),
      }));

    const secondHalfCaptions = original.captions
      .filter((caption) => caption.endMs > splitOffsetMs)
      .map((caption) => ({
        ...caption,
        startMs: Math.max(0, caption.startMs - splitOffsetMs),
        endMs: caption.endMs - splitOffsetMs,
        words: caption.words
          .filter((word) => word.endMs > splitOffsetMs)
          .map((word) => ({
            ...word,
            startMs: Math.max(0, word.startMs - splitOffsetMs),
            endMs: word.endMs - splitOffsetMs,
          })),
      }))
      .filter((caption) => caption.words.length > 0)
      .map((caption) => ({
        ...caption,
        text: caption.words.map((w) => w.word).join(" "),
      }));


    // Create the split overlays with adjusted captions
    const firstHalf: CaptionOverlay = {
      ...original,
      durationInFrames: firstPartDuration,
      captions: firstHalfCaptions,
    };

    const secondHalf: CaptionOverlay = {
      ...original,
      id: newId,
      from: splitFrame,
      durationInFrames: secondPartDuration,
      captions: secondHalfCaptions,
    };

    return [firstHalf, secondHalf];
  }

  const firstHalf: Overlay = {
    ...original,
    durationInFrames: firstPartDuration,
  };

  const secondHalf: Overlay = {
    ...original,
    id: newId,
    from: splitFrame,
    durationInFrames: secondPartDuration,
    ...(original.type === OverlayType.VIDEO && {
      videoStartTime: secondHalfStartTime,
    }),
    ...(original.type === OverlayType.SOUND && {
      startFromSound: secondHalfStartTime,
    }),
    // The transition belongs to the cut with the previous clip; the left piece keeps it.
    ...("transitionIn" in original && { transitionIn: undefined }),
  };

  return [firstHalf, secondHalf];
};
