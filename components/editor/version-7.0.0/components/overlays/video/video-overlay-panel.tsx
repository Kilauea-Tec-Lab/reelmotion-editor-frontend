import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, Pencil, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import Cookies from "js-cookie";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  thumbnail_url?: string | null;
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
    updateVideoName,
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
  const [loadedVideos, setLoadedVideos] = useState<Set<string>>(new Set());
  
  // Rename state
  const [videoToRename, setVideoToRename] = useState<ReelmotionVideo | null>(null);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  
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

  const handleRename = async () => {
    if (!videoToRename || !newName.trim()) return;
    
    setIsRenaming(true);
    try {
      const token = Cookies.get("token");
      const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend.reelmotion.ai";
      
      const formData = new FormData();
      formData.append("attachment_id", videoToRename.id);
      formData.append("name", newName);

      const response = await fetch(`${backendUrl}/chat/update-attachment-name`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to update name");
      }

      // Update local state
      updateVideoName(videoToRename.id, newName);
      
      setVideoToRename(null);
      setNewName("");
      
      toast({
        title: "Success",
        description: "Video name updated successfully",
      });
    } catch (error) {
      console.error("Error updating video name:", error);
      toast({
        title: "Error",
        description: "Failed to update video name",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

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

  const handleVideoLoaded = (videoId: string) => {
    setLoadedVideos((prev) => new Set(prev).add(videoId));
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
                      <div className="relative aspect-video bg-gray-200 dark:bg-darkBoxSub">
                        {/* Loading spinner */}
                        {!loadedVideos.has(video.id) && (
                          <div className="absolute inset-0 flex items-center justify-center z-10">
                            <Loader2 className="w-8 h-8 text-gray-400 dark:text-gray-500 animate-spin" />
                          </div>
                        )}
                        
                        {/* Use thumbnail if available, otherwise video element */}
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.name || "Video thumbnail"}
                            className={`w-full h-full rounded-sm object-cover hover:opacity-60 transition-opacity duration-200 ${
                              !loadedVideos.has(video.id) ? 'opacity-0' : 'opacity-100'
                            }`}
                            loading="lazy"
                            onLoad={() => handleVideoLoaded(video.id)}
                            onError={() => handleVideoLoaded(video.id)}
                          />
                        ) : (
                          <video
                            src={video.video_url}
                            className={`w-full h-full rounded-sm object-cover hover:opacity-60 transition-opacity duration-200 ${
                              !loadedVideos.has(video.id) ? 'opacity-0' : 'opacity-100'
                            }`}
                            muted
                            playsInline
                            preload="metadata"
                            onLoadedData={() => handleVideoLoaded(video.id)}
                          />
                        )}
                        
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200" />
                        
                        {/* Video name & Options */}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between gap-1 group">
                          <p className="text-white text-xs font-medium truncate flex-1 text-left">
                            {video.name || "Untitled"}
                          </p>
                          
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu onOpenChange={(isOpen) => {
                              if (isOpen) {
                                setVideoToRename(video);
                                setNewName(video.name || "");
                              }
                            }}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-all bg-black/60 backdrop-blur-sm hover:bg-black/80 text-pink-400 rounded-full"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-60 p-2">
                                <div className="flex items-center gap-2" onKeyDown={(e) => e.stopPropagation()}>
                                  <Input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="h-8 text-xs"
                                    placeholder="Rename video..."
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRename();
                                    }}
                                  />
                                  <Button 
                                    size="icon" 
                                    className="h-8 w-8 shrink-0 bg-pink-500 hover:bg-pink-600 text-white"
                                    onClick={handleRename}
                                    disabled={isRenaming}
                                  >
                                    {isRenaming ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
