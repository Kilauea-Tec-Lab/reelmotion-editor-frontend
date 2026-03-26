"use client";

import { useEditorContext } from "../../../contexts/editor-context";
import { useTimelinePositioning } from "../../../hooks/use-timeline-positioning";
import { useAspectRatio } from "../../../hooks/use-aspect-ratio";
import { useTimeline } from "../../../contexts/timeline-context";
import { Overlay, OverlayType } from "../../../types";
import { FPS } from "../../../constants";
import { LocalMediaGallery } from "../../local-media/local-media-gallery";

/**
 * LocalMediaPanel Component
 *
 * A panel that allows users to:
 * 1. Upload their own media files (videos, images, audio)
 * 2. View and manage uploaded media files
 * 3. Add uploaded media to the timeline
 */
export const LocalMediaPanel: React.FC = () => {
  const { addOverlay, overlays, durationInFrames, currentFrame } = useEditorContext();
  const { findNextAvailablePosition } = useTimelinePositioning();
  const { getAspectRatioDimensions } = useAspectRatio();
  const { visibleRows } = useTimeline();

  /**
   * Probe media duration from a URL when it's not available in file metadata.
   */
  const probeDurationFromUrl = (url: string, mediaType: "video" | "audio"): Promise<number | undefined> => {
    return new Promise((resolve) => {
      const el = document.createElement(mediaType === "video" ? "video" : "audio");
      el.preload = "metadata";

      const timeout = setTimeout(() => {
        resolve(undefined);
      }, 5000);

      el.onloadedmetadata = () => {
        clearTimeout(timeout);
        const dur = isFinite(el.duration) ? el.duration : undefined;
        resolve(dur);
      };
      el.onerror = () => {
        clearTimeout(timeout);
        resolve(undefined);
      };

      el.src = url;
    });
  };

  /**
   * Add a media file to the timeline
   */
  const handleAddToTimeline = async (file: any) => {
    const { width, height } = getAspectRatioDimensions();
    const { from, row } = findNextAvailablePosition(
      overlays,
      visibleRows,
      durationInFrames,
      currentFrame
    );

    // Resolve duration: use stored value, or probe from URL as fallback
    let fileDuration: number | undefined = file.duration;
    if (!fileDuration && (file.type === "video" || file.type === "audio")) {
      fileDuration = await probeDurationFromUrl(file.path, file.type);
    }

    let newOverlay: Overlay;

    if (file.type === "video") {
      newOverlay = {
        left: 0,
        top: 0,
        width,
        height,
        durationInFrames: fileDuration ? Math.round(fileDuration * FPS) : 200,
        from,
        id: Date.now(),
        rotation: 0,
        row,
        isDragging: false,
        type: OverlayType.VIDEO,
        content: file.path,
        src: file.path,
        videoStartTime: 0,
        styles: {
          opacity: 1,
          zIndex: 100,
          transform: "none",
          objectFit: "cover",
        },
      };
    } else if (file.type === "image") {
      newOverlay = {
        left: 0,
        top: 0,
        width,
        height,
        durationInFrames: 200,
        from,
        id: Date.now(),
        rotation: 0,
        row,
        isDragging: false,
        type: OverlayType.IMAGE,
        src: file.path,
        content: file.path,
        styles: {
          objectFit: "cover",
          animation: {
            enter: "fadeIn",
            exit: "fadeOut",
          },
        },
      };
    } else if (file.type === "audio") {
      newOverlay = {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        durationInFrames: fileDuration ? Math.round(fileDuration * FPS) : 200,
        from,
        id: Date.now(),
        rotation: 0,
        row,
        isDragging: false,
        type: OverlayType.SOUND,
        content: file.name,
        src: file.path,
        styles: {
          volume: 1,
        },
      };
    } else {
      return; // Unsupported file type
    }

    addOverlay(newOverlay);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white dark:bg-darkBox  h-full">
      <LocalMediaGallery onSelectMedia={handleAddToTimeline} />
    </div>
  );
};

export default LocalMediaPanel;
