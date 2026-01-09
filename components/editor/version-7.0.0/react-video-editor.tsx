"use client";

// UI Components
import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/sidebar/app-sidebar";
import { Editor } from "./components/core/editor";
import { SidebarProvider as UISidebarProvider } from "@/components/ui/sidebar";
import { SidebarProvider as EditorSidebarProvider } from "./contexts/sidebar-context";

// Context Providers
import { EditorProvider } from "./contexts/editor-context";

// Custom Hooks
import { useOverlays } from "./hooks/use-overlays";
import { useVideoPlayer } from "./hooks/use-video-player";
import { useTimelineClick } from "./hooks/use-timeline-click";
import { TimelineRowAdjuster } from "./components/core/timeline-row-adjuster";
import { useAspectRatio } from "./hooks/use-aspect-ratio";
import { useCompositionDuration } from "./hooks/use-composition-duration";
import { useHistory } from "./hooks/use-history";
import { useEditorAuth } from "./hooks/use-editor-auth";
import { useVideoPrefetch } from "./hooks/use-video-prefetch";

// Types
import { Overlay } from "./types";
import { useRendering } from "./hooks/use-rendering";
import {
  AUTO_SAVE_INTERVAL,
  DEFAULT_OVERLAYS,
  FPS,
  RENDER_TYPE,
} from "./constants";
import { TimelineProvider } from "./contexts/timeline-context";

// Autosave Components
import { AutosaveRecoveryDialog } from "./components/autosave/autosave-recovery-dialog";
import { AutosaveStatus } from "./components/autosave/autosave-status";
import { useState, useEffect } from "react";
import { useAutosave } from "./hooks/use-autosave";
import { LocalMediaProvider } from "./contexts/local-media-context";
import { KeyframeProvider } from "./contexts/keyframe-context";
import { AssetLoadingProvider } from "./contexts/asset-loading-context";
import { useTimeline } from "./contexts/timeline-context";
import { ZOOM_CONSTRAINTS } from "./constants";
import { inferAspectRatioFromDimensions } from "./utils/aspect-ratio-utils";

// Component to handle zoom keyboard shortcuts
// Must be inside TimelineProvider to access zoom context
function ZoomKeyboardShortcuts() {
  const { zoomScale, setZoomScale } = useTimeline();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're not in an input field
      const target = e.target as HTMLElement;
      const isInputField = 
        target.tagName === "INPUT" || 
        target.tagName === "TEXTAREA" || 
        target.isContentEditable;
      
      if (isInputField) return;

      // Handle + key (zoom in)
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        const newScale = Math.min(
          zoomScale + ZOOM_CONSTRAINTS.step,
          ZOOM_CONSTRAINTS.max
        );
        setZoomScale(newScale);
      }
      
      // Handle - key (zoom out)
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        const newScale = Math.max(
          zoomScale - ZOOM_CONSTRAINTS.step,
          ZOOM_CONSTRAINTS.min
        );
        setZoomScale(newScale);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomScale, setZoomScale]);

  return null; // This component doesn't render anything
}

export default function ReactVideoEditor({ projectId }: { projectId: string }) {
  // Authentication check
  const { isLoading, isAuthorized, editorData } = useEditorAuth();

  // Autosave state
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [autosaveTimestamp, setAutosaveTimestamp] = useState<number | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // Current edit state (for load/save functionality)
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [currentEditName, setCurrentEditName] = useState<string | null>(null);

  // Overlay management hooks
  const {
    overlays,
    setOverlays,
    selectedOverlayId,
    setSelectedOverlayId,
    changeOverlay,
    addOverlay,
    deleteOverlay,
    duplicateOverlay,
    splitOverlay,
    deleteOverlaysByRow,
    updateOverlayStyles,
    resetOverlays,
  } = useOverlays(DEFAULT_OVERLAYS);

  // Video player controls and state
  const { isPlaying, currentFrame, playerRef, togglePlayPause, formatTime } =
    useVideoPlayer();

  // Prefetch all videos in the timeline to prevent black flashes during transitions
  useVideoPrefetch(overlays);

  // Composition duration calculations
  const { durationInFrames, contentDurationInFrames, durationInSeconds } =
    useCompositionDuration(overlays);

  // Aspect ratio and player dimension management
  const {
    aspectRatio,
    setAspectRatio,
    playerDimensions,
    updatePlayerDimensions,
    getAspectRatioDimensions,
  } = useAspectRatio();

  // Event handlers
  const handleOverlayChange = (updatedOverlay: Overlay) => {
    changeOverlay(updatedOverlay.id, () => updatedOverlay);
  };

  const { width: compositionWidth, height: compositionHeight } =
    getAspectRatioDimensions();

  const handleTimelineClick = useTimelineClick(playerRef, durationInFrames);

  const inputProps = {
    overlays,
    durationInFrames: contentDurationInFrames, // Use actual content duration for rendering
    fps: FPS,
    width: compositionWidth,
    height: compositionHeight,
    src: "",
  };

  const { renderMedia, state } = useRendering(
    "TestComponent",
    inputProps,
    RENDER_TYPE
  );

  // Replace history management code with hook
  const { undo, redo, canUndo, canRedo } = useHistory(overlays, setOverlays);

  // Create the editor state object to be saved
  const editorState = {
    overlays,
    aspectRatio,
    playerDimensions,
  };

  // Implment load state
  const { saveState, loadState } = useAutosave(projectId, editorState, {
    interval: AUTO_SAVE_INTERVAL,
    onSave: () => {
      setIsSaving(false);
      setLastSaveTime(Date.now());
    },
    onLoad: (loadedState) => {
      console.log("loadedState", loadedState);
      if (loadedState) {
        // Apply loaded state to editor
        setOverlays(loadedState.overlays || []);
        if (loadedState.aspectRatio) setAspectRatio(loadedState.aspectRatio);
        if (loadedState.playerDimensions)
          updatePlayerDimensions(
            loadedState.playerDimensions.width,
            loadedState.playerDimensions.height
          );
      }
    },
    onAutosaveDetected: (timestamp) => {
      // Only show recovery dialog on initial load, not during an active session
      if (!initialLoadComplete) {
        setAutosaveTimestamp(timestamp);
        setShowRecoveryDialog(true);
      }
    },
  });

  // Mark initial load as complete after component mounts
  useEffect(() => {
    setInitialLoadComplete(true);
  }, []);

  console.log("DEBUG: overlays", overlays);
  // Handle recovery dialog actions
  const handleRecoverAutosave = async () => {
    const loadedState = await loadState();
    console.log("loadedState", loadedState);
    
    if (loadedState) {
      // Restore overlays
      if (loadedState.overlays) {
        setOverlays(loadedState.overlays);
      }
      
      // Restore aspect ratio
      if (loadedState.aspectRatio) {
        setAspectRatio(loadedState.aspectRatio);
      }
      
      // Restore player dimensions
      if (loadedState.playerDimensions) {
        updatePlayerDimensions(
          loadedState.playerDimensions.width,
          loadedState.playerDimensions.height
        );
      }
    }
    
    setShowRecoveryDialog(false);
  };

  const handleDiscardAutosave = () => {
    setShowRecoveryDialog(false);
  };

  // Handle loading an edit from the backend
  const handleLoadEdit = (loadedEdit: any) => {
    console.log("Loading edition:", loadedEdit);
    
    // Store the edit ID and name for future saves
    if (loadedEdit.id) {
      setCurrentEditId(loadedEdit.id);
    }
    if (loadedEdit.name) {
      setCurrentEditName(loadedEdit.name);
    }
    
    // Parse edition data if it's still a string
    const editionData = typeof loadedEdit.editionData === 'string' 
      ? JSON.parse(loadedEdit.editionData) 
      : loadedEdit.editionData;
    
    if (editionData && editionData.inputProps) {
      // Restore overlays
      if (editionData.inputProps.overlays) {
        setOverlays(editionData.inputProps.overlays);
      }

      // Restore aspect ratio if present (new schema) or infer from width/height (old schema)
      const savedAspectRatio =
        editionData.aspectRatio ?? editionData.inputProps?.aspectRatio;

      if (savedAspectRatio) {
        setAspectRatio(savedAspectRatio);
      } else {
        const inferred = inferAspectRatioFromDimensions(
          editionData.inputProps?.width,
          editionData.inputProps?.height
        );
        if (inferred) setAspectRatio(inferred);
      }
    }
  };

  // Manual save function for use in keyboard shortcuts or save button
  const handleManualSave = async () => {
    setIsSaving(true);
    await saveState();
  };

  // Set up keyboard shortcut for manual save (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorState]);

  // Set up keyboard shortcut for deleting selected overlay (Backspace / Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Backspace or Delete key is pressed
      if (e.key === "Backspace" || e.key === "Delete") {
        // Check if we're not in an input field
        const target = e.target as HTMLElement;
        const isInputField = 
          target.tagName === "INPUT" || 
          target.tagName === "TEXTAREA" || 
          target.isContentEditable;
        
        // Only delete overlay if not in an input field and an overlay is selected
        if (!isInputField && selectedOverlayId !== null) {
          e.preventDefault();
          deleteOverlay(selectedOverlayId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedOverlayId, deleteOverlay]);

  // Create edition data for backend save
  const editionData = {
    id: "TestComponent",
    inputProps: {
      overlays,
      durationInFrames,
      fps: FPS,
      width: compositionWidth,
      height: compositionHeight,
      aspectRatio,
      src: "",
    },
    aspectRatio,
    // Include current edit info if available
    editId: currentEditId,
    editName: currentEditName,
  };

  // Combine all editor context values
  const editorContextValue = {
    // Overlay management
    overlays,
    setOverlays,
    selectedOverlayId,
    setSelectedOverlayId,
    changeOverlay,
    handleOverlayChange,
    addOverlay,
    deleteOverlay,
    duplicateOverlay,
    splitOverlay,
    resetOverlays,

    // Player controls
    isPlaying,
    currentFrame,
    playerRef,
    togglePlayPause,
    formatTime,
    handleTimelineClick,
    playbackRate,
    setPlaybackRate,

    // Dimensions and duration
    aspectRatio,
    setAspectRatio,
    playerDimensions,
    updatePlayerDimensions,
    getAspectRatioDimensions,
    durationInFrames,
    durationInSeconds,

    // Add renderType to the context
    renderType: RENDER_TYPE,
    renderMedia,
    state,

    deleteOverlaysByRow,

    // History management
    undo,
    redo,
    canUndo,
    canRedo,

    // New style management
    updateOverlayStyles,

    // Autosave
    saveProject: handleManualSave,

    // Edition data for backend save
    editionData,

    // Load edit functionality
    loadEdit: handleLoadEdit,
  };

  // Show loading state while authenticating
  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen dark:bg-darkBox ">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primarioLogo"></div>
      </div>
    );
  }

  // If not authorized, the hook will handle the redirect
  // This is just a safety check
  if (!isAuthorized) {
    return null;
  }

  return (
    <UISidebarProvider>
      <EditorSidebarProvider>
        <KeyframeProvider>
          <TimelineProvider>
            <ZoomKeyboardShortcuts />
            <EditorProvider value={editorContextValue}>
              <TimelineRowAdjuster />
              <LocalMediaProvider backendUploads={editorData?.uploads || []}>
                <AssetLoadingProvider>
                  <AppSidebar />
                  <SidebarInset>
                    <Editor />
                  </SidebarInset>

                  {/* Autosave Status Indicator */}
                  <AutosaveStatus
                    isSaving={isSaving}
                    lastSaveTime={lastSaveTime}
                  />

                  {/* Autosave Recovery Dialog */}
                  {showRecoveryDialog && autosaveTimestamp && (
                    <AutosaveRecoveryDialog
                      projectId={projectId}
                      timestamp={autosaveTimestamp}
                      onRecover={handleRecoverAutosave}
                      onDiscard={handleDiscardAutosave}
                      onClose={() => setShowRecoveryDialog(false)}
                    />
                  )}
                </AssetLoadingProvider>
              </LocalMediaProvider>
            </EditorProvider>
          </TimelineProvider>
        </KeyframeProvider>
      </EditorSidebarProvider>
    </UISidebarProvider>
  );
}
