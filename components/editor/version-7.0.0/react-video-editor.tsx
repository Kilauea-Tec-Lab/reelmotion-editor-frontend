"use client";

// UI Components
import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/sidebar/app-sidebar";
import { Editor } from "./components/core/editor";
import { SidebarProvider as UISidebarProvider } from "@/components/ui/sidebar";
import { SidebarProvider as EditorSidebarProvider } from "./contexts/sidebar-context";

// Context Providers
import { EditorProvider } from "./contexts/editor-context";
import { PlaybackProvider } from "./contexts/playback-context";

// Custom Hooks
import { useOverlays } from "./hooks/use-overlays";
import { useVideoPlayer } from "./hooks/use-video-player";
import { useTimelineClick } from "./hooks/use-timeline-click";
import { TimelineRowAdjuster } from "./components/core/timeline-row-adjuster";
import { useAspectRatio } from "./hooks/use-aspect-ratio";
import { useCompositionDuration } from "./hooks/use-composition-duration";
import { useHistory } from "./hooks/use-history";
import { useEditorAuth } from "./hooks/use-editor-auth";

// Types
import { Overlay, OverlayType } from "./types";

// Utils
import { prepareUrlForRender } from "./utils/url-helper";
import { isLocalSrc, resolveLocalSrc, restoreLocalFiles } from "./utils/local-file-store";
import { useRendering } from "./hooks/use-rendering";
import {
  AUTO_SAVE_INTERVAL,
  DEFAULT_OVERLAYS,
  FPS,
  RENDER_TYPE,
  WATERMARK_VIDEO_SRC,
  WATERMARK_DURATION_FRAMES,
} from "./constants";
import { TimelineProvider } from "./contexts/timeline-context";

// Autosave Components
import { AutosaveRecoveryDialog } from "./components/autosave/autosave-recovery-dialog";
import { AutosaveStatus } from "./components/autosave/autosave-status";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAutosave } from "./hooks/use-autosave";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { LocalMediaProvider } from "./contexts/local-media-context";
import { KeyframeProvider } from "./contexts/keyframe-context";
import { AssetLoadingProvider } from "./contexts/asset-loading-context";
import { inferAspectRatioFromDimensions } from "./utils/aspect-ratio-utils";


export default function ReactVideoEditor({ projectId }: { projectId: string }) {
  // Authentication check
  const { isLoading, isAuthorized, editorData } = useEditorAuth();
  const { t } = useTranslation();
  
  const subscriptionPlan = editorData?.suscription?.suscription || "free";
  const isPro = subscriptionPlan !== "free";
  const exportNumber = editorData?.export_number ?? 0;

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

  // Background color for the composition canvas
  const [backgroundColor, setBackgroundColor] = useState("#222225");

  // Overlay management hooks
  const {
    overlays,
    setOverlays,
    selectedOverlayId,
    setSelectedOverlayId,
    selectedOverlayIds,
    setSelectedOverlayIds,
    toggleSelectedOverlayId,
    changeOverlay,
    addOverlay,
    deleteOverlay,
    duplicateOverlay,
    splitOverlay,
    deleteOverlaysByRow,
    updateOverlayStyles,
    resetOverlays,
  } = useOverlays(DEFAULT_OVERLAYS);

  // Track which URLs have already been validated to avoid re-checking
  const validatedUrlsRef = useRef<Set<string>>(new Set());
  const isValidatingRef = useRef(false);

  /**
   * Validate overlay URLs and remove overlays whose media no longer exists (404).
   * Runs once when overlays are loaded from autosave/backend.
   */
  const validateOverlayUrls = useCallback(async (currentOverlays: Overlay[]) => {
    if (isValidatingRef.current || currentOverlays.length === 0) return;

    // Find overlays with remote or local src URLs that haven't been validated yet
    const overlaysToCheck = currentOverlays.filter((o) => {
      if (!('src' in o) || typeof (o as any).src !== 'string') return false;
      const src = (o as any).src as string;
      if (!src.startsWith('http') && !isLocalSrc(src)) return false;
      return !validatedUrlsRef.current.has(src);
    });

    if (overlaysToCheck.length === 0) return;

    isValidatingRef.current = true;
    const brokenIds: number[] = [];
    await restoreLocalFiles();

    await Promise.all(
      overlaysToCheck.map(async (overlay) => {
        const src = (overlay as any).src as string;
        // Local files live only in this browser; gone after a cleared IndexedDB.
        if (isLocalSrc(src)) {
          if (!resolveLocalSrc(src)) brokenIds.push(overlay.id);
          return;
        }
        try {
          const res = await fetch(src, { method: 'HEAD', mode: 'cors' });
          if (res.status === 404 || res.status === 403) {
            brokenIds.push(overlay.id);
          } else {
            validatedUrlsRef.current.add(src);
          }
        } catch {
          // Network error or CORS — try GET with no-cors as fallback
          try {
            const res = await fetch(src, { method: 'HEAD', mode: 'no-cors' });
            // no-cors returns opaque response (status 0) — can't determine 404
            // Mark as valid to avoid false positives
            validatedUrlsRef.current.add(src);
          } catch {
            // Complete network failure — mark as broken
            brokenIds.push(overlay.id);
          }
        }
      })
    );

    isValidatingRef.current = false;

    if (brokenIds.length > 0) {
      setOverlays((prev) => prev.filter((o) => !brokenIds.includes(o.id)));
      toast({
        title: t("toast.removedMissingMedia.title"),
        description: t("toast.removedMissingMedia.body", { count: brokenIds.length }),
      });
    }
  }, [setOverlays, t]);

  // Run URL validation when overlays change (debounced, only for new overlays)
  useEffect(() => {
    const timer = setTimeout(() => {
      validateOverlayUrls(overlays);
    }, 1000);
    return () => clearTimeout(timer);
  }, [overlays, validateOverlayUrls]);

  // Video player controls and state
  const { playerRef, togglePlayPause, getCurrentFrame, formatTime } =
    useVideoPlayer();

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
  const handleOverlayChange = useCallback((updatedOverlay: Overlay) => {
    changeOverlay(updatedOverlay.id, () => updatedOverlay);
  }, [changeOverlay]);

  const { width: compositionWidth, height: compositionHeight } =
    getAspectRatioDimensions();

  // Calculate render dimensions based on subscription plan
  let renderWidth = compositionWidth;
  let renderHeight = compositionHeight;

  if (!isPro) {
    const MAX_RES = 720;
    if (compositionWidth > compositionHeight) {
      // Landscape
      if (compositionHeight > MAX_RES) {
        const ratio = compositionWidth / compositionHeight;
        renderHeight = MAX_RES;
        renderWidth = Math.round(renderHeight * ratio);
      }
    } else {
      // Portrait or Square
      if (compositionWidth > MAX_RES) {
        const ratio = compositionHeight / compositionWidth;
        renderWidth = MAX_RES;
        renderHeight = Math.round(renderWidth * ratio);
      }
    }
    // Ensure even dimensions
    renderWidth = Math.round(renderWidth / 2) * 2;
    renderHeight = Math.round(renderHeight / 2) * 2;
  }

  const handleTimelineClick = useTimelineClick(playerRef, durationInFrames);

  /**
   * Prepare overlays for rendering by converting all media URLs to absolute URLs
   * that don't use the local proxy (which only works on Next.js server)
   * And adding watermark if needed relative to render context
   */
  const prepareOverlaysForRender = useCallback((overlays: Overlay[]): Overlay[] => {
    const processedOverlays = overlays.map((overlay) => {
      // Handle overlays with src property (video, image, sound)
      if ('src' in overlay && typeof overlay.src === 'string') {
        return {
          ...overlay,
          src: prepareUrlForRender(overlay.src),
        };
      }
      return overlay;
    });

    // Add watermark for free users
    if (!isPro) {
      // Calculate the end time of the composition
      const maxDuration =
        processedOverlays.length > 0
          ? Math.max(...processedOverlays.map((o) => o.from + o.durationInFrames))
          : 0;
      
      // Create new video overlay
      const watermarkOverlay = {
        id: -999, // Special ID for watermark
        type: OverlayType.VIDEO,
        from: maxDuration,
        durationInFrames: WATERMARK_DURATION_FRAMES,
        row: 0,
        src: prepareUrlForRender(WATERMARK_VIDEO_SRC),
        content: "Watermark",
        height: compositionHeight, 
        width: compositionWidth,
        left: 0,
        top: 0,
        isDragging: false,
        rotation: 0,
        styles: {
          objectFit: "contain",
          opacity: 1,
          zIndex: 9999, // Ensure it's on top if overlapping
        },
      } as unknown as Overlay;

      processedOverlays.push(watermarkOverlay);
    }

    return processedOverlays;
  }, [isPro, compositionWidth, compositionHeight]);

  const inputProps = useMemo(() => ({
    overlays: prepareOverlaysForRender(overlays),
    durationInFrames: contentDurationInFrames + (!isPro ? WATERMARK_DURATION_FRAMES : 0), // Add watermark duration for free users
    fps: FPS,
    width: renderWidth, // Use calculated render dimensions
    height: renderHeight,
    src: "",
    backgroundColor,
  }), [overlays, prepareOverlaysForRender, contentDurationInFrames, isPro, renderWidth, renderHeight, backgroundColor]);

  const { renderMedia: startRender, state } = useRendering(
    "TestComponent",
    inputProps,
    RENDER_TYPE
  );

  // Export may pass overlays materialized a moment ago (local files uploaded)
  // that the memoized inputProps do not contain yet.
  const renderMedia = useCallback(
    (options?: { scale?: number; overlays?: Overlay[] }) =>
      startRender({
        scale: options?.scale,
        inputProps: options?.overlays
          ? { ...inputProps, overlays: prepareOverlaysForRender(options.overlays) }
          : undefined,
      }),
    [startRender, inputProps, prepareOverlaysForRender]
  );

  // Replace history management code with hook
  const { undo, redo, canUndo, canRedo } = useHistory(overlays, setOverlays);

  // Create the editor state object to be saved
  const editorState = useMemo(() => ({
    overlays,
    aspectRatio,
    playerDimensions,
    backgroundColor,
  }), [overlays, aspectRatio, playerDimensions, backgroundColor]);

  // Implment load state
  const { saveState, loadState } = useAutosave(projectId, editorState, {
    interval: AUTO_SAVE_INTERVAL,
    onSave: () => {
      setIsSaving(false);
      setLastSaveTime(Date.now());
    },
    onLoad: (loadedState) => {
      if (loadedState) {
        // Apply loaded state to editor
        setOverlays(loadedState.overlays || []);
        if (loadedState.aspectRatio) setAspectRatio(loadedState.aspectRatio);
        if (loadedState.playerDimensions)
          updatePlayerDimensions(
            loadedState.playerDimensions.width,
            loadedState.playerDimensions.height
          );
        if (loadedState.backgroundColor)
          setBackgroundColor(loadedState.backgroundColor);
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

  // Handle recovery dialog actions
  const handleRecoverAutosave = async () => {
    const loadedState = await loadState();
    
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

      // Restore background color
      if (loadedState.backgroundColor) {
        setBackgroundColor(loadedState.backgroundColor);
      }
    }

    setShowRecoveryDialog(false);
  };

  const handleDiscardAutosave = () => {
    setShowRecoveryDialog(false);
  };

  // Handle loading an edit from the backend
  const handleLoadEdit = useCallback((loadedEdit: any) => {
    
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

      // Restore background color
      const savedBgColor =
        editionData.backgroundColor ?? editionData.inputProps?.backgroundColor;
      if (savedBgColor) setBackgroundColor(savedBgColor);
    }
  }, [setOverlays, setAspectRatio]);

  // Manual save function for use in keyboard shortcuts or save button
  const handleManualSave = useCallback(async () => {
    setIsSaving(true);
    await saveState();
  }, [saveState]);


  // Create edition data for backend save
  const editionData = useMemo(() => ({
    id: "TestComponent",
    inputProps: {
      overlays,
      durationInFrames,
      fps: FPS,
      width: compositionWidth,
      height: compositionHeight,
      aspectRatio,
      backgroundColor,
      src: "",
    },
    aspectRatio,
    backgroundColor,
    // Include current edit info if available
    editId: currentEditId,
    editName: currentEditName,
  }), [overlays, durationInFrames, compositionWidth, compositionHeight, aspectRatio, backgroundColor, currentEditId, currentEditName]);

  const getRenderDimensions = useCallback(
    () => ({ width: renderWidth, height: renderHeight }),
    [renderWidth, renderHeight]
  );

  // Combine all editor context values. Memoized: 22 consumers re-render when
  // this identity changes, so it must only change when a real value does.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const editorContextValue = useMemo(() => ({
    // Overlay management
    overlays,
    setOverlays,
    selectedOverlayId,
    setSelectedOverlayId,
    selectedOverlayIds,
    setSelectedOverlayIds,
    toggleSelectedOverlayId,
    changeOverlay,
    handleOverlayChange,
    addOverlay,
    deleteOverlay,
    duplicateOverlay,
    splitOverlay,
    resetOverlays,

    // Player controls
    playerRef,
    getCurrentFrame,
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
    getRenderDimensions,
    durationInFrames,
    contentDurationInFrames, // Added contentDurationInFrames
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

    // Subscription info
    subscriptionPlan,
    isPro,

    // Export limit
    exportNumber,

    // Background color
    backgroundColor,
    setBackgroundColor,
  }), [
    overlays, setOverlays, selectedOverlayId, setSelectedOverlayId, selectedOverlayIds,
    setSelectedOverlayIds, toggleSelectedOverlayId, changeOverlay, handleOverlayChange, addOverlay, deleteOverlay, duplicateOverlay, splitOverlay,
    resetOverlays, playerRef, getCurrentFrame, togglePlayPause, formatTime,
    handleTimelineClick, playbackRate, aspectRatio, setAspectRatio, playerDimensions,
    updatePlayerDimensions, getAspectRatioDimensions, getRenderDimensions,
    durationInFrames, contentDurationInFrames, durationInSeconds, renderMedia, state,
    deleteOverlaysByRow, undo, redo, canUndo, canRedo, updateOverlayStyles,
    handleManualSave, editionData, handleLoadEdit, subscriptionPlan, isPro,
    exportNumber, backgroundColor,
  ]);

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
            <EditorProvider value={editorContextValue}>
              <PlaybackProvider playerRef={playerRef}>
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
              </PlaybackProvider>
            </EditorProvider>
          </TimelineProvider>
        </KeyframeProvider>
      </EditorSidebarProvider>
    </UISidebarProvider>
  );
}
