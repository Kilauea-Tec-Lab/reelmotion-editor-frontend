/**
 * Timeline Component
 *
 * A complex timeline interface that allows users to manage video overlays through
 * drag-and-drop interactions, splitting, duplicating, and deletion operations.
 * The timeline visualizes overlay positions and durations across video frames.
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useTimeline } from "../../contexts/timeline-context";
import { useTimelineDragAndDrop } from "../../hooks/use-timeline-drag-and-drop";
import { useTimelineEventHandlers } from "../../hooks/use-timeline-event-handlers";
import { useTimelineState } from "../../hooks/use-timeline-state";
import { Overlay, OverlayType } from "../../types";
import GhostMarker from "./ghost-marker";
import TimelineGrid from "./timeline-grid";
import TimelineMarker from "./timeline-marker";
import TimeMarkers from "./timeline-markers";
import { Grip, Loader2, Plus } from "lucide-react";
import {
  ROW_HEIGHT,
  SHOW_LOADING_PROJECT_ALERT,
  SNAPPING_CONFIG,
  MAX_ROWS,
} from "../../constants";
import { useAssetLoading } from "../../contexts/asset-loading-context";
import { MobileNavBar } from "../mobile/mobile-nav-bar";
import { useTimelineSnapping } from "../../hooks/use-timeline-snapping";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface TimelineProps {
  /** Array of overlay objects to be displayed on the timeline */
  overlays: Overlay[];
  /** Total duration of the video in frames */
  durationInFrames: number;
  /** ID of the currently selected overlay */
  selectedOverlayId: number | null;
  /** Callback to update the selected overlay */
  setSelectedOverlayId: (id: number | null) => void;
  /** Current playhead position in frames */
  currentFrame: number;
  /** Callback when an overlay is modified */
  onOverlayChange: (updatedOverlay: Overlay) => void;
  /** Callback to update the current frame position */
  setCurrentFrame: (frame: number) => void;
  /** Callback for timeline click events */
  onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Callback to delete an overlay */
  onOverlayDelete: (id: number) => void;
  /** Callback to duplicate an overlay */
  onOverlayDuplicate: (id: number) => void;
  /** Callback to split an overlay at a specific position */
  onSplitOverlay: (id: number, splitPosition: number) => void;
  /** Callback to set the overlays state */
  setOverlays: (overlays: Overlay[]) => void;
}

const Timeline: React.FC<TimelineProps> = ({
  overlays,
  durationInFrames,
  selectedOverlayId,
  setSelectedOverlayId,
  currentFrame,
  onOverlayChange,
  setCurrentFrame,
  onTimelineClick,
  onOverlayDelete,
  onOverlayDuplicate,
  onSplitOverlay,
  setOverlays,
}) => {
  // State for tracking hover position during split operations
  const [lastKnownHoverInfo, setLastKnownHoverInfo] = useState<{
    itemId: number;
    position: number;
  } | null>(null);

  const {
    visibleRows,
    timelineRef,
    zoomScale,
    handleWheelZoom,
    addRow,
    removeRow,
  } = useTimeline();

  // State for context menu visibility
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  // Custom hooks for timeline functionality
  const {
    isDragging,
    draggedItem,
    ghostElement, // Raw ghost from hook
    ghostMarkerPosition,
    livePushOffsets,
    dragInfo,
    handleDragStart: timelineStateHandleDragStart,
    updateGhostElement,
    resetDragState,
    setGhostMarkerPosition,
  } = useTimelineState(durationInFrames, visibleRows, timelineRef);

  const { handleDragStart, handleDrag, handleDragEnd } = useTimelineDragAndDrop(
    {
      overlays,
      durationInFrames,
      onOverlayChange,
      updateGhostElement,
      resetDragState,
      timelineRef,
      dragInfo,
      maxRows: visibleRows,
    }
  );

  const { handleMouseMove, handleTouchMove, handleTimelineMouseLeave } =
    useTimelineEventHandlers({
      handleDrag,
      handleDragEnd,
      isDragging,
      timelineRef,
      setGhostMarkerPosition,
    });

  // Call the new snapping hook
  const { alignmentLines, snappedGhostElement } = useTimelineSnapping({
    isDragging,
    ghostElement,
    draggedItem,
    dragInfo,
    overlays,
    durationInFrames,
    visibleRows,
    snapThreshold: SNAPPING_CONFIG.thresholdFrames,
  });

  // Event Handlers
  const combinedHandleDragStart = useCallback(
    (
      overlay: Overlay,
      clientX: number,
      clientY: number,
      action: "move" | "resize-start" | "resize-end"
    ) => {
      timelineStateHandleDragStart(overlay, clientX, clientY, action);
      handleDragStart(overlay, clientX, clientY, action);
    },
    [timelineStateHandleDragStart, handleDragStart]
  );

  const handleDeleteItem = useCallback(
    (id: number) => onOverlayDelete(id),
    [onOverlayDelete]
  );

  const handleDuplicateItem = useCallback(
    (id: number) => onOverlayDuplicate(id),
    [onOverlayDuplicate]
  );

  const handleItemHover = useCallback(
    (itemId: number, hoverPosition: number) => {
      setLastKnownHoverInfo({
        itemId,
        position: Math.round(hoverPosition),
      });
    },
    []
  );

  const handleSplitItem = useCallback(
    (id: number) => {
      if (lastKnownHoverInfo?.itemId === id) {
        onSplitOverlay(id, lastKnownHoverInfo.position);
      }
    },
    [lastKnownHoverInfo, onSplitOverlay]
  );

  const handleContextMenuChange = useCallback(
    (isOpen: boolean) => setIsContextMenuOpen(isOpen),
    []
  );

  const handleRemoveGap = useCallback(
    (rowIndex: number, gapStart: number, gapEnd: number) => {
      const overlaysToShift = overlays
        .filter((overlay) => overlay.row === rowIndex && overlay.from >= gapEnd)
        .sort((a, b) => a.from - b.from);

      if (overlaysToShift.length === 0) return;

      const firstOverlayAfterGap = overlaysToShift[0];
      const gapSize = firstOverlayAfterGap.from - gapStart;

      if (gapSize <= 0) return;

      const updates = overlaysToShift.map((overlay) => ({
        ...overlay,
        from: overlay.from - gapSize,
      }));

      updates.forEach((update) => onOverlayChange(update));
    },
    [overlays, onOverlayChange]
  );

  const handleReorderRows = (fromIndex: number, toIndex: number) => {
    const updatedOverlays = overlays.map((overlay) => {
      if (overlay.row === fromIndex) {
        return { ...overlay, row: toIndex };
      }
      if (overlay.row === toIndex) {
        return { ...overlay, row: fromIndex };
      }
      return overlay;
    });

    // Update your overlays state here
    setOverlays(updatedOverlays);
  };

  // Handle deleting a specific row
  const handleDeleteRow = (rowIndex: number) => {
    // First, delete all overlays in that row
    const overlaysInRow = overlays.filter((overlay) => overlay.row === rowIndex);
    overlaysInRow.forEach((overlay) => onOverlayDelete(overlay.id));

    // Then adjust row indices for rows below the deleted one
    const updatedOverlays = overlays
      .filter((overlay) => overlay.row !== rowIndex)
      .map((overlay) => {
        if (overlay.row > rowIndex) {
          return { ...overlay, row: overlay.row - 1 };
        }
        return overlay;
      });

    setOverlays(updatedOverlays);

    // Remove the row from the timeline
    removeRow();
  };

  // Add state for row dragging
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

  // Add visual feedback state
  const [isDraggingRow, setIsDraggingRow] = useState(false);

  const handleRowDragStart = (e: React.DragEvent, rowIndex: number) => {
    setDraggedRowIndex(rowIndex);
    setIsDraggingRow(true);
    // Set a transparent drag image to hide the default ghost
  };

  const handleRowDragOver = (e: React.DragEvent, rowIndex: number) => {
    e.preventDefault();
    if (draggedRowIndex === null) return;
    setDragOverRowIndex(rowIndex);
  };

  const handleRowDrop = (targetIndex: number) => {
    if (draggedRowIndex === null) return;
    handleReorderRows(draggedRowIndex, targetIndex);
    setDraggedRowIndex(null);
    setDragOverRowIndex(null);
    setIsDraggingRow(false);
  };

  const handleRowDragEnd = () => {
    setDraggedRowIndex(null);
    setDragOverRowIndex(null);
    setIsDraggingRow(false);
  };

  // Handle drop from sidebar panels (videos, audio, images)
  const handleTimelineDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    const videoData = e.dataTransfer.getData("application/reelmotion-video");
    const soundData = e.dataTransfer.getData("application/reelmotion-sound");
    
    if (videoData) {
      try {
        const data = JSON.parse(videoData);
        const { width, height } = { width: 1280, height: 720 }; // Default dimensions
        
        // Calculate drop position
        const timelineRect = timelineRef.current?.getBoundingClientRect();
        if (!timelineRect) return;
        
        const dropX = e.clientX - timelineRect.left;
        const dropY = e.clientY - timelineRect.top;
        
        // Calculate frame position from X coordinate
        const timelineWidth = timelineRect.width * zoomScale;
        const framePosition = Math.round((dropX / timelineWidth) * durationInFrames);
        
        // Calculate row from Y coordinate (accounting for header)
        const headerHeight = 21; // 1.3rem converted to pixels
        const rowY = dropY - headerHeight;
        const targetRow = Math.max(0, Math.min(visibleRows - 1, Math.floor(rowY / ROW_HEIGHT)));
        
        // Get video duration
        const getVideoDuration = (videoUrl: string): Promise<number> => {
          return new Promise((resolve) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.src = videoUrl;
            
            video.onloadedmetadata = () => {
              resolve(video.duration);
            };
            
            video.onerror = () => {
              resolve(200 / 30); // Fallback
            };
          });
        };
        
        const videoDuration = await getVideoDuration(data.video_url);
        const fps = 30;
        const videoDurationInFrames = Math.floor(videoDuration * fps);
        
        // Find the last occupied frame in the target row
        const overlaysInRow = overlays.filter(o => o.row === targetRow);
        const lastFrameInRow = overlaysInRow.length > 0
          ? Math.max(...overlaysInRow.map(o => o.from + o.durationInFrames))
          : 0;
        
        // Place the new overlay after the last element in the row
        const newOverlayStartFrame = Math.max(lastFrameInRow, 0);
        
        const newOverlay: Overlay = {
          left: 0,
          top: 0,
          width,
          height,
          durationInFrames: videoDurationInFrames || 200,
          from: newOverlayStartFrame,
          id: Date.now(),
          rotation: 0,
          row: targetRow,
          isDragging: false,
          type: OverlayType.VIDEO,
          content: data.video_url,
          src: data.video_url,
          videoStartTime: 0,
          styles: {
            opacity: 1,
            zIndex: 100,
            transform: "none",
            objectFit: "cover",
          },
        };
        
        // Add the overlay to the array
        setOverlays([...overlays, newOverlay]);
        setSelectedOverlayId(newOverlay.id);
      } catch (error) {
        console.error("Error dropping video:", error);
      }
    } else if (soundData) {
      try {
        const data = JSON.parse(soundData);
        
        // Calculate drop position
        const timelineRect = timelineRef.current?.getBoundingClientRect();
        if (!timelineRect) return;
        
        const dropX = e.clientX - timelineRect.left;
        const dropY = e.clientY - timelineRect.top;
        
        // Calculate frame position from X coordinate
        const timelineWidth = timelineRect.width * zoomScale;
        const framePosition = Math.round((dropX / timelineWidth) * durationInFrames);
        
        // Calculate row from Y coordinate (accounting for header)
        const headerHeight = 21;
        const rowY = dropY - headerHeight;
        const targetRow = Math.max(0, Math.min(visibleRows - 1, Math.floor(rowY / ROW_HEIGHT)));
        
        // Find the last occupied frame in the target row
        const overlaysInRow = overlays.filter(o => o.row === targetRow);
        const lastFrameInRow = overlaysInRow.length > 0
          ? Math.max(...overlaysInRow.map(o => o.from + o.durationInFrames))
          : 0;
        
        // Place the new overlay after the last element in the row
        const newOverlayStartFrame = Math.max(lastFrameInRow, 0);
        
        const newOverlay: Overlay = {
          id: Date.now(),
          type: OverlayType.SOUND,
          content: data.title,
          src: data.file,
          from: newOverlayStartFrame,
          row: targetRow,
          left: 0,
          top: 0,
          width: 1920,
          height: 100,
          rotation: 0,
          isDragging: false,
          durationInFrames: data.duration * 30,
          styles: {
            opacity: 1,
          },
        };
        
        setOverlays([...overlays, newOverlay]);
        setSelectedOverlayId(newOverlay.id);
      } catch (error) {
        console.error("Error dropping sound:", error);
      }
    }
  };

  const handleTimelineDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  useEffect(() => {
    const element = timelineRef.current;
    if (!element) return;

    element.addEventListener("wheel", handleWheelZoom, { passive: false });
    return () => element.removeEventListener("wheel", handleWheelZoom);
  }, [handleWheelZoom]);

  // Replace the loading state management with context
  const {
    isLoadingAssets,
    isInitialLoad,
    handleAssetLoadingChange,
    setInitialLoadComplete,
  } = useAssetLoading();

  // Effect to handle initial load completion
  const [shouldShowInitialLoader, setShouldShowInitialLoader] = useState(false);

  useEffect(() => {
    const hasVideoOverlay = overlays.some(
      (overlay) => overlay.type === OverlayType.VIDEO
    );

    if (!shouldShowInitialLoader && hasVideoOverlay && isInitialLoad) {
      setShouldShowInitialLoader(true);
    }

    if (overlays.length > 0 && !isLoadingAssets) {
      setInitialLoadComplete();
    }
  }, [
    overlays,
    isInitialLoad,
    isLoadingAssets,
    shouldShowInitialLoader,
    setInitialLoadComplete,
  ]);

  // Render
  return (
    <div className="flex flex-col">
      <div className="flex ">
        {/* Row Drag Handles Column */}
        <div className="hidden md:block w-7 flex-shrink-0 border-l border-r border-gray-200 dark:border-gray-100/10 bg-gray-50 dark:bg-darkBox ">
          {/* Match TimeMarkers height */}
          <div className="h-[1.3rem] bg-gray-100 dark:bg-darkBoxSub /50" />

          {/* Match the grid layout exactly */}
          <div
            className="flex flex-col gap-2 pt-2 pb-2"
            style={{ height: `${visibleRows * ROW_HEIGHT}px` }}
          >
            {Array.from({ length: visibleRows }).map((_, rowIndex) => (
              <ContextMenu key={`drag-${rowIndex}`}>
                <ContextMenuTrigger asChild>
                  <div
                    className={`flex-1 flex items-center justify-center transition-all duration-200 
                  ${
                    dragOverRowIndex === rowIndex
                      ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-500"
                      : ""
                  }
                  ${
                    draggedRowIndex === rowIndex
                      ? "opacity-50 bg-gray-100/50 dark:bg-darkBoxSub /50"
                      : ""
                  }
                  ${
                    isDraggingRow
                      ? "cursor-grabbing"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800/30"
                  }`}
                    onDragOver={(e) => handleRowDragOver(e, rowIndex)}
                    onDrop={() => handleRowDrop(rowIndex)}
                  >
                    <div
                      className={`w-5 h-5 flex items-center justify-center rounded-md 
                    transition-all duration-150 
                    hover:bg-gray-200 dark:hover:bg-gray-700
                    active:scale-95
                    ${isDraggingRow ? "cursor-grabbing" : "cursor-grab"} 
                    active:cursor-grabbing
                    group`}
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                      onDragEnd={handleRowDragEnd}
                    >
                      <Grip
                        className="w-3 h-3 text-gray-400 dark:text-gray-500 
                    group-hover:text-gray-600 dark:group-hover:text-gray-300
                    transition-colors duration-150"
                      />
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="dark:bg-slate-900 dark:border-slate-800">
                  <ContextMenuItem
                    onClick={() => handleDeleteRow(rowIndex)}
                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
                  >
                    Delete Row
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        </div>

        {/* Timeline Content */}
        <div
          className="relative overflow-x-auto scrollbar-hide flex-1 md:pl-0 pl-2"
          style={{
            scrollbarWidth: "none" /* Firefox */,
            msOverflowStyle: "none" /* IE and Edge */,
          }}
        >
          <div
            ref={timelineRef}
            className="pr-2 pb-2 relative bg-white dark:bg-darkBox"
            style={{
              width: `${100 * zoomScale}%`,
              minWidth: "100%",
              willChange: "width, transform",
              transform: `translateZ(0)`,
            }}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
            onMouseUp={handleDragEnd}
            onTouchEnd={handleDragEnd}
            onMouseLeave={handleTimelineMouseLeave}
            onClick={onTimelineClick}
            onDrop={handleTimelineDrop}
            onDragOver={handleTimelineDragOver}
          >
            <div className="relative h-full">
              {/* Timeline header with frame markers */}
              <div className="h-[1.3rem]">
                <TimeMarkers
                  durationInFrames={durationInFrames}
                  handleTimelineClick={setCurrentFrame}
                  zoomScale={zoomScale}
                />
              </div>

              {/* Current frame indicator */}
              <TimelineMarker
                currentFrame={currentFrame}
                totalDuration={durationInFrames}
              />

              {/* Drag operation visual feedback */}
              <GhostMarker
                position={ghostMarkerPosition}
                isDragging={isDragging}
                isContextMenuOpen={isContextMenuOpen}
              />

              {/* Main timeline grid with overlays */}
              <TimelineGrid
                overlays={overlays}
                currentFrame={currentFrame}
                isDragging={isDragging}
                draggedItem={draggedItem}
                selectedOverlayId={selectedOverlayId}
                setSelectedOverlayId={setSelectedOverlayId}
                handleDragStart={combinedHandleDragStart}
                totalDuration={durationInFrames}
                ghostElement={snappedGhostElement}
                livePushOffsets={livePushOffsets}
                onDeleteItem={handleDeleteItem}
                onDuplicateItem={handleDuplicateItem}
                onSplitItem={handleSplitItem}
                onHover={handleItemHover}
                onContextMenuChange={handleContextMenuChange}
                onRemoveGap={handleRemoveGap}
                zoomScale={zoomScale}
                draggedRowIndex={draggedRowIndex}
                dragOverRowIndex={dragOverRowIndex}
                onAssetLoadingChange={handleAssetLoadingChange}
                alignmentLines={alignmentLines}
              />

              {/* Loading Indicator - Only shows during initial project load */}
              {SHOW_LOADING_PROJECT_ALERT &&
                isLoadingAssets &&
                isInitialLoad &&
                shouldShowInitialLoader && (
                  <div
                    className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-[1px] flex items-center justify-center z-50"
                    style={{ willChange: "opacity" }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/90 dark:bg-darkBoxSub /90 rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600 dark:text-gray-300" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        Loading project...
                      </span>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Row Button - Shows when rows < MAX_ROWS */}
      {visibleRows < MAX_ROWS && (
        <div className="flex justify-center py-1 dark:bg-darkBox border dark:border-gray-100/10">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-darkBoxSub rounded-lg transition-colors"
            title="Add new row"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </button>
        </div>
      )}

      {/* Mobile Navigation Bar
       * Only shows on mobile devices (md:hidden)
       * Improved scrollable design inspired by TimelineControls
       * Horizontal scrolling with fade indicators for better UX
       * Touch-friendly buttons with tooltips for content creation
       * Placed at the bottom of the timeline for easy access
       */}
      <MobileNavBar />
    </div>
  );
};

export default Timeline;
