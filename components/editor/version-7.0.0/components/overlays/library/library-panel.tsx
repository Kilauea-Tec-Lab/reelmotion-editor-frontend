"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { usePexelsImages } from "../../../hooks/use-pexels-images";
import { usePexelsVideos } from "../../../hooks/use-pexels-video";
import { useEditorContext } from "../../../contexts/editor-context";
import { useTimelinePositioning } from "../../../hooks/use-timeline-positioning";
import { useAspectRatio } from "../../../hooks/use-aspect-ratio";
import { useTimeline } from "../../../contexts/timeline-context";
import { Overlay, OverlayType } from "../../../types";

/**
 * LibraryPanel Component
 *
 * A panel that provides access to Pexels stock media library.
 * Features:
 * 1. Curated/Popular content from Pexels
 * 2. Category-based browsing
 * 3. Lazy loading with infinite scroll
 * 4. Separate tabs for Images and Videos
 */

// Popular categories for images and videos
const IMAGE_CATEGORIES = [
  { label: "Curated", query: "curated" },
  { label: "Nature", query: "nature" },
  { label: "People", query: "people" },
  { label: "Technology", query: "technology" },
  { label: "Business", query: "business" },
  { label: "Fashion", query: "fashion" },
  { label: "Food", query: "food" },
  { label: "Travel", query: "travel" },
  { label: "Animals", query: "animals" },
  { label: "Abstract", query: "abstract" },
];

const VIDEO_CATEGORIES = [
  { label: "Popular", query: "popular" },
  { label: "Nature", query: "nature" },
  { label: "People", query: "people" },
  { label: "Technology", query: "technology" },
  { label: "City", query: "city" },
  { label: "Ocean", query: "ocean" },
  { label: "Sunset", query: "sunset" },
  { label: "Forest", query: "forest" },
  { label: "Sky", query: "sky" },
  { label: "Abstract", query: "abstract" },
];

export const LibraryPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"images" | "videos">("images");
  const [selectedImageCategory, setSelectedImageCategory] = useState("curated");
  const [selectedVideoCategory, setSelectedVideoCategory] = useState("popular");

  const { images, isLoading: imagesLoading, fetchImages, page: imagePage, hasMore: hasMoreImages } = usePexelsImages();
  const { videos, isLoading: videosLoading, fetchVideos, page: videoPage, hasMore: hasMoreVideos } = usePexelsVideos();

  const { addOverlay, overlays, durationInFrames } = useEditorContext();
  const { findNextAvailablePosition } = useTimelinePositioning();
  const { getAspectRatioDimensions } = useAspectRatio();
  const { visibleRows } = useTimeline();

  const imageScrollRef = React.useRef<HTMLDivElement>(null);
  const videoScrollRef = React.useRef<HTMLDivElement>(null);

  // Fetch initial content when category changes
  React.useEffect(() => {
    fetchImages(selectedImageCategory, 1, false);
  }, [selectedImageCategory]);

  React.useEffect(() => {
    fetchVideos(selectedVideoCategory, 1, false);
  }, [selectedVideoCategory]);

  const handleImageCategoryChange = (category: string) => {
    setSelectedImageCategory(category);
    if (imageScrollRef.current) {
      imageScrollRef.current.scrollTop = 0;
    }
  };

  const handleVideoCategoryChange = (category: string) => {
    setSelectedVideoCategory(category);
    if (videoScrollRef.current) {
      videoScrollRef.current.scrollTop = 0;
    }
  };

  // Infinite scroll handler for images
  const handleImageScroll = React.useCallback(() => {
    const container = imageScrollRef.current;
    if (!container || imagesLoading || !hasMoreImages) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop <= clientHeight + 200) {
      fetchImages(selectedImageCategory, imagePage + 1, true);
    }
  }, [imagesLoading, hasMoreImages, selectedImageCategory, imagePage, fetchImages]);

  // Infinite scroll handler for videos
  const handleVideoScroll = React.useCallback(() => {
    const container = videoScrollRef.current;
    if (!container || videosLoading || !hasMoreVideos) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop <= clientHeight + 200) {
      fetchVideos(selectedVideoCategory, videoPage + 1, true);
    }
  }, [videosLoading, hasMoreVideos, selectedVideoCategory, videoPage, fetchVideos]);

  // Attach scroll listeners
  React.useEffect(() => {
    const imageContainer = imageScrollRef.current;
    const videoContainer = videoScrollRef.current;

    if (imageContainer) {
      imageContainer.addEventListener('scroll', handleImageScroll);
    }
    if (videoContainer) {
      videoContainer.addEventListener('scroll', handleVideoScroll);
    }

    return () => {
      if (imageContainer) {
        imageContainer.removeEventListener('scroll', handleImageScroll);
      }
      if (videoContainer) {
        videoContainer.removeEventListener('scroll', handleVideoScroll);
      }
    };
  }, [handleImageScroll, handleVideoScroll, activeTab]);

  const handleAddImage = (image: any) => {
    const { width, height } = getAspectRatioDimensions();
    const { from, row } = findNextAvailablePosition(
      overlays,
      visibleRows,
      durationInFrames
    );

    const newOverlay: Overlay = {
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
      src: image.src.large,
      content: image.src.large,
      styles: {
        objectFit: "cover",
        animation: {
          enter: "fadeIn",
          exit: "fadeOut",
        },
      },
    };

    addOverlay(newOverlay);
  };

  const handleAddVideo = (video: any) => {
    const { width, height } = getAspectRatioDimensions();
    const { from, row } = findNextAvailablePosition(
      overlays,
      visibleRows,
      durationInFrames
    );

    // Find best quality video file
    const videoFile = video.video_files.find(
      (file: any) => file.quality === "hd" || file.quality === "sd"
    ) || video.video_files[0];

    // Calculate duration (default to 200 frames if not available)
    const videoDuration = 200; // Default 200 frames (~6.67 seconds at 30fps)

    const newOverlay: Overlay = {
      left: 0,
      top: 0,
      width,
      height,
      durationInFrames: videoDuration,
      from,
      id: Date.now(),
      rotation: 0,
      row,
      isDragging: false,
      type: OverlayType.VIDEO,
      content: video.image || "",
      src: videoFile.link,
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

  /**
   * Handle drag start for images
   */
  const handleImageDragStart = (e: React.DragEvent, image: any) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(
      "application/reelmotion-library-image",
      JSON.stringify({
        type: "image",
        src: image.src.large,
        alt: image.alt || `Image #${image.id}`,
        id: image.id,
      })
    );
  };

  /**
   * Handle drag start for videos
   */
  const handleVideoDragStart = (e: React.DragEvent, video: any) => {
    const videoFile = video.video_files.find(
      (file: any) => file.quality === "hd" || file.quality === "sd"
    ) || video.video_files[0];

    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(
      "application/reelmotion-library-video",
      JSON.stringify({
        type: "video",
        src: videoFile.link,
        image: video.image,
        duration: video.duration || 200,
        id: video.id,
      })
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-darkBox">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "images" | "videos")}
        className="flex flex-col h-full"
      >
        <TabsList  className="w-full grid grid-cols-2 bg-gray-100/50 dark:bg-darkBoxSub /50 backdrop-blur-sm rounded-sm border border-gray-200 dark:border-gray-700 gap-1">
          <TabsTrigger value="images" className="data-[state=active]:bg-primarioLogo data-[state=active]:text-gray-900 dark:data-[state=active]:text-white 
            rounded-sm transition-all duration-200 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50">Images</TabsTrigger>
          <TabsTrigger value="videos" className="data-[state=active]:bg-primarioLogo data-[state=active]:text-gray-900 dark:data-[state=active]:text-white 
            rounded-sm transition-all duration-200 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50">Videos</TabsTrigger>
        </TabsList>

        {/* Images Tab */}
        <TabsContent value="images" className="flex-1 overflow-hidden flex-col m-0 data-[state=active]:flex hidden">
          {/* Category buttons */}
          <div className="px-4 pb-3 pt-4">
            <div className="flex flex-wrap gap-2">
              {IMAGE_CATEGORIES.map((category) => (
                <button
                  key={category.query}
                  onClick={() => handleImageCategoryChange(category.query)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    selectedImageCategory === category.query
                      ? "bg-primarioLogo text-white font-medium"
                      : "bg-gray-100 dark:bg-darkBoxSub text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4" ref={imageScrollRef}>
            {imagesLoading && images.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {images.map((image, index) => (
                    <div
                      key={`${image.id}-${index}`}
                      draggable
                      onDragStart={(e) => handleImageDragStart(e, image)}
                      className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity group"
                      onClick={() => handleAddImage(image)}
                    >
                      <img
                        src={image.src.medium}
                        alt="Pexels image"
                        className="w-full h-full object-cover"
                      />
                      {/* Title badge */}
                      <div className="absolute bottom-0 left-0 right-0 text-[11px] text-white bg-gradient-to-t from-black/80 to-transparent px-2 py-2 pt-6">
                        <div className="line-clamp-1 font-medium">
                          {image.alt || `Image #${image.id}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {imagesLoading && images.length > 0 && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
            {!imagesLoading && images.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No images found. Try a different search term.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Videos Tab */}
        <TabsContent value="videos" className="flex-1 overflow-hidden flex-col m-0 data-[state=active]:flex hidden">
          {/* Category buttons */}
          <div className="px-4 pb-3 pt-4">
            <div className="flex flex-wrap gap-2">
              {VIDEO_CATEGORIES.map((category) => (
                <button
                  key={category.query}
                  onClick={() => handleVideoCategoryChange(category.query)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    selectedVideoCategory === category.query
                      ? "bg-primarioLogo text-white font-medium"
                      : "bg-gray-100 dark:bg-darkBoxSub text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4" ref={videoScrollRef}>
            {videosLoading && videos.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {videos.map((video, index) => (
                    <div
                      key={`${video.id}-${index}`}
                      draggable
                      onDragStart={(e) => handleVideoDragStart(e, video)}
                      className="relative aspect-video rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity group"
                      onClick={() => handleAddVideo(video)}
                    >
                      <img
                        src={video.image}
                        alt="Pexels video"
                        className="w-full h-full object-cover"
                      />
                      {/* Duration badge */}
                      {video.duration && (
                        <div className="absolute top-2 right-2 text-[10px] text-white bg-black/70 px-2 py-1 rounded backdrop-blur-sm">
                          {Math.round(video.duration)}s
                        </div>
                      )}
                      {/* Tags/Title badge */}
                      <div className="absolute bottom-0 left-0 right-0 text-[11px] text-white bg-gradient-to-t from-black/80 to-transparent px-2 py-2 pt-6">
                        <div className="line-clamp-1 font-medium">
                          {video.tags && video.tags.length > 0 
                            ? video.tags[0].charAt(0).toUpperCase() + video.tags[0].slice(1)
                            : `Video ${video.id}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {videosLoading && videos.length > 0 && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
            {!videosLoading && videos.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No videos found. Try a different search term.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LibraryPanel;
