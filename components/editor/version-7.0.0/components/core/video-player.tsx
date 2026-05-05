import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { Main } from "../../remotion/main";
import { useEditorContext } from "../../contexts/editor-context";
import { FPS } from "../../constants";
import { toast } from "@/hooks/use-toast";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";

/**
 * Props for the VideoPlayer component
 * @interface VideoPlayerProps
 * @property {React.RefObject<PlayerRef>} playerRef - Reference to the Remotion player instance
 */
interface VideoPlayerProps {
  playerRef: React.RefObject<PlayerRef>;
}

// Real component — hooks live here. Remotion's `errorFallback` is invoked as a
// plain function (not rendered as JSX), so calling hooks directly inside the
// fallback violates the Rules of Hooks. Returning <PlayerErrorToast /> lets
// React mount this as a normal component where hooks work.
const PlayerErrorToast: React.FC<{ error: Error }> = ({ error }) => {
  useEffect(() => {
    if (!error) return;
    console.error("Remotion Player error:", error);
    toast({
      title: "Playback error",
      description:
        error instanceof Error
          ? error.message
          : "The browser failed to play a media asset.",
      variant: "destructive",
    });
  }, [error]);

  return null;
};

const playerErrorFallback = ({ error }: { error: Error }) => (
  <PlayerErrorToast error={error} />
);

/**
 * VideoPlayer component that renders a responsive video editor with overlay support
 * The player automatically resizes based on its container and maintains the specified aspect ratio
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ playerRef }) => {
  const {
    overlays,
    setSelectedOverlayId,
    changeOverlay,
    selectedOverlayId,
    aspectRatio,
    playerDimensions,
    updatePlayerDimensions,
    getAspectRatioDimensions,
    durationInFrames,
    contentDurationInFrames,
    isPlaying,
    backgroundColor,
    setBackgroundColor,
  } = useEditorContext();

  // Color picker popover state for double-click
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerPos, setColorPickerPos] = useState({ x: 0, y: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // Only trigger if clicking on the grid background area, not the player itself
    const target = e.target as HTMLElement;
    if (target.closest('[data-remotion-player]') || target.closest('.remotion-player')) return;
    setColorPickerPos({ x: e.clientX, y: e.clientY });
    setColorPickerOpen(true);
  }, []);

  // Store previous playing state to restore it after overlay changes
  const wasPlayingRef = useRef(false);
  const currentFrameRef = useRef(0);
  const previousOverlaysLengthRef = useRef(overlays.length);

  // Update current frame reference
  useEffect(() => {
    if (playerRef.current) {
      currentFrameRef.current = playerRef.current.getCurrentFrame();
    }
  });

  // Track when overlays change (but not when added/removed)
  useEffect(() => {
    const currentLength = overlays.length;
    const lengthChanged = currentLength !== previousOverlaysLengthRef.current;
    
    // Only preserve playback state if overlays were modified (not added/removed)
    if (!lengthChanged && wasPlayingRef.current && playerRef.current) {
      const savedFrame = currentFrameRef.current;
      const shouldPlay = wasPlayingRef.current;
      
      // Small delay to ensure the player has finished re-rendering
      const timer = setTimeout(() => {
        if (playerRef.current) {
          // First seek to the saved position
          playerRef.current.seekTo(savedFrame);
          
          // Then resume playback if it was playing
          if (shouldPlay) {
            playerRef.current.play();
          }
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
    
    previousOverlaysLengthRef.current = currentLength;
  }, [overlays, playerRef]);

  // Track playing state
  useEffect(() => {
    wasPlayingRef.current = isPlaying;
  }, [isPlaying]);

  /**
   * Updates the player dimensions when the container size or aspect ratio changes
   */
  useEffect(() => {
    const handleDimensionUpdate = () => {
      const videoContainer = document.querySelector(".video-container");
      if (!videoContainer) return;

      const { width, height } = videoContainer.getBoundingClientRect();
      updatePlayerDimensions(width, height);
    };

    handleDimensionUpdate(); // Initial update
    window.addEventListener("resize", handleDimensionUpdate);

    return () => {
      window.removeEventListener("resize", handleDimensionUpdate);
    };
  }, [aspectRatio, updatePlayerDimensions]);

  const { width: compositionWidth, height: compositionHeight } =
    getAspectRatioDimensions();

  // Player composition length should match the actual content end so playback
  // stops where the last overlay ends. The wider `durationInFrames` (1-min
  // minimum) is only for the timeline editing UI.
  const playerDurationInFrames = Math.max(
    1,
    Math.round(contentDurationInFrames)
  );

  // Constants for player configuration
  const PLAYER_CONFIG = {
    durationInFrames: playerDurationInFrames,
    fps: FPS,
  };

  // Memoize inputProps to prevent unnecessary re-renders
  const inputProps = useMemo(() => ({
    overlays,
    setSelectedOverlayId,
    changeOverlay,
    selectedOverlayId,
    durationInFrames,
    fps: FPS,
    width: compositionWidth,
    height: compositionHeight,
    backgroundColor,
  }), [overlays, setSelectedOverlayId, changeOverlay, selectedOverlayId, durationInFrames, compositionWidth, compositionHeight, backgroundColor]);

  return (
    <div className="w-full h-full overflow-hidden">
      {/* Grid background container */}
      <div
        className="z-0 video-container relative w-full h-full
        bg-slate-100/90 dark:bg-darkBoxSub
        bg-[linear-gradient(to_right,#80808015_1px,transparent_1px),linear-gradient(to_bottom,#80808015_1px,transparent_1px)]
        dark:bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)]
        bg-[size:16px_16px]
        shadow-lg"
        onDoubleClick={handleDoubleClick}
        title="Double-click to change background color"
      >
        {/* Color picker popover anchored at double-click position */}
        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
          <PopoverAnchor asChild>
            <div
              ref={anchorRef}
              className="pointer-events-none fixed w-0 h-0"
              style={{ left: colorPickerPos.x, top: colorPickerPos.y }}
            />
          </PopoverAnchor>
          <PopoverContent
            className="w-auto p-3 bg-darkBox border-gray-700 z-[9999]"
            side="bottom"
            align="center"
            sideOffset={8}
          >
            <div
              className="space-y-2 [&_.react-colorful]:w-[200px] [&_.react-colorful]:h-[140px] [&_.react-colorful]:rounded-md [&_.react-colorful__saturation]:rounded-t-md [&_.react-colorful__last-control]:rounded-b-md [&_.react-colorful__pointer]:w-4 [&_.react-colorful__pointer]:h-4 [&_.react-colorful__hue]:h-3"
            >
              <HexColorPicker color={backgroundColor} onChange={setBackgroundColor} />
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border border-gray-600"
                  style={{ backgroundColor }}
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(val)) setBackgroundColor(val);
                  }}
                  className="flex-1 h-6 text-[11px] font-mono uppercase bg-darkBoxSub border border-gray-700 rounded px-2 text-zinc-300 outline-none focus:border-primarioLogo"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {/* Player wrapper with centering */}
        <div className="z-10 absolute inset-2 sm:inset-4 flex items-center justify-center">
          <div
            className="relative mx-2 sm:mx-0"
            style={{
              width: Math.min(playerDimensions.width, compositionWidth),
              height: Math.min(playerDimensions.height, compositionHeight),
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          >
            <Player
              ref={playerRef}
              className="w-full h-full"
              component={Main}
              compositionWidth={compositionWidth}
              compositionHeight={compositionHeight}
              style={{
                width: "100%",
                height: "100%",
              }}
              durationInFrames={PLAYER_CONFIG.durationInFrames}
              fps={PLAYER_CONFIG.fps}
              inputProps={inputProps}
              errorFallback={playerErrorFallback}
              overflowVisible
              numberOfSharedAudioTags={20}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
