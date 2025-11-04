import { useState, useEffect, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useEditorContext } from "../../../contexts/editor-context";
import { useTimelinePositioning } from "../../../hooks/use-timeline-positioning";

import { useReelmotionVideos } from "../../../hooks/use-reelmotion-videos";
import { useAspectRatio } from "../../../hooks/use-aspect-ratio";
import { useTimeline } from "../../../contexts/timeline-context";
import { ClipOverlay, Overlay, OverlayType } from "../../../types";
import { VideoDetails } from "./video-details";

interface ReelmotionVideo {
  id: string;
  name: string | null;
  video_url: string;
}

/**
 * VideoOverlayPanel is a component that provides video search and management functionality.
 * It allows users to:
 * - Search and browse videos from the Reelmotion backend
 * - Add videos to the timeline as overlays
 * - Manage video properties when a video overlay is selected
 * - Lazy load videos in batches of 15
 *
 * The component has two main states:
 * 1. Search/Browse mode: Shows a search input and grid of video thumbnails
 * 2. Edit mode: Shows video details panel when a video overlay is selected
 *
 * @component
 * @example
 * ```tsx
 * <VideoOverlayPanel />
 * ```
 */
export const VideoOverlayPanel: React.FC = () => {
  const {
    videos,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    searchQuery,
    setSearchQuery,
  } = useReelmotionVideos();
  
  const {
    addOverlay,
    overlays,
    durationInFrames,
    selectedOverlayId,
    changeOverlay,
  } = useEditorContext();
  const { findNextAvailablePosition } = useTimelinePositioning();
  const { getAspectRatioDimensions } = useAspectRatio();
  const { visibleRows } = useTimeline();
  const [localOverlay, setLocalOverlay] = useState<Overlay | null>(null);
  
  // Ref for infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedOverlayId === null) {
      setLocalOverlay(null);
      return;
    }

    const selectedOverlay = overlays.find(
      (overlay) => overlay.id === selectedOverlayId
    );

    if (selectedOverlay?.type === OverlayType.VIDEO) {
      setLocalOverlay(selectedOverlay);
    }
  }, [selectedOverlayId, overlays]);

  // Setup infinite scroll observer
  useEffect(() => {
    if (!loadMoreTriggerRef.current || !hasMore || isLoadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreTriggerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, loadMore]);

  const handleAddClip = async (video: ReelmotionVideo) => {
    const { width, height } = getAspectRatioDimensions();

    const { from, row } = findNextAvailablePosition(
      overlays,
      visibleRows,
      durationInFrames
    );

    // Get video duration
    const videoDuration = await getVideoDuration(video.video_url);
    const fps = 30; // Default FPS
    const videoDurationInFrames = Math.floor(videoDuration * fps);

    const newOverlay: Overlay = {
      left: 0,
      top: 0,
      width,
      height,
      durationInFrames: videoDurationInFrames || 200, // Fallback to 200 if duration couldn't be determined
      from,
      id: Date.now(),
      rotation: 0,
      row,
      isDragging: false,
      type: OverlayType.VIDEO,
      content: video.video_url,
      src: video.video_url,
      videoStartTime: 0,
      styles: {
        opacity: 1,
        zIndex: 100,
        transform: "none",
        objectFit: "cover",
      },
    };

    addOverlay(newOverlay);
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, video: ReelmotionVideo) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(
      "application/reelmotion-video",
      JSON.stringify({
        type: "video",
        video_url: video.video_url,
        name: video.name,
        id: video.id,
      })
    );
  };

  // Helper function to get video duration
  const getVideoDuration = (videoUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = videoUrl;
      
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
      
      video.onerror = () => {
        console.error("Error loading video metadata");
        resolve(200 / 30); // Fallback: 200 frames at 30fps
      };
    });
  };

  const handleUpdateOverlay = (updatedOverlay: Overlay) => {
    setLocalOverlay(updatedOverlay);
    changeOverlay(updatedOverlay.id, updatedOverlay);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-100/40 dark:bg-darkBox  h-full">
      {!localOverlay ? (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="Search videos..."
              value={searchQuery}
              className="bg-white dark:bg-darkBoxSub  border-gray-200 dark:border-white/5 text-gray-900 dark:text-zinc-200 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-blue-400"
              onChange={(e) => setSearchQuery(e.target.value)}
              // NOTE: Stops zooming in on input focus on iPhone
              style={{ fontSize: "16px" }}
            />
          </div>

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto"
          >
            <div className="grid grid-cols-2 gap-3">
              {isLoading ? (
                Array.from({ length: 15 }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="relative aspect-video w-full bg-gray-200 dark:bg-darkBoxSub  animate-pulse rounded-sm"
                  />
                ))
              ) : videos.length > 0 ? (
                <>
                  {videos.map((video) => (
                    <button
                      key={`${video.id}-${video.video_url}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, video)}
                      className="relative block w-full cursor-pointer border border-transparent rounded-md overflow-hidden"
                      onClick={() => handleAddClip(video)}
                    >
                      <div className="relative">
                        <video
                          src={video.video_url}
                          className="w-full h-auto rounded-sm object-cover hover:opacity-60 transition-opacity duration-200"
                          muted
                          playsInline
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200" />
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                          <p className="text-white text-xs font-medium truncate">
                            {video.name || "Untitled"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  
                  {/* Loading more indicator */}
                  {isLoadingMore &&
                    Array.from({ length: 15 }).map((_, index) => (
                      <div
                        key={`loading-more-${index}`}
                        className="relative aspect-video w-full bg-gray-200 dark:bg-darkBoxSub  animate-pulse rounded-sm"
                      />
                    ))}

                  {/* Intersection observer trigger */}
                  {hasMore && !isLoadingMore && (
                    <div ref={loadMoreTriggerRef} className="h-4 col-span-2" />
                  )}
                </>
              ) : (
                <div className="col-span-2 flex flex-col items-center justify-center py-8 text-gray-500">
                  <p>No videos found</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <VideoDetails
          localOverlay={localOverlay as ClipOverlay}
          setLocalOverlay={handleUpdateOverlay}
        />
      )}
    </div>
  );
};
