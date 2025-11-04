import React, { useEffect, useMemo, useRef } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { Main } from "../../remotion/main";
import { useEditorContext } from "../../contexts/editor-context";
import { FPS } from "../../constants";

/**
 * Props for the VideoPlayer component
 * @interface VideoPlayerProps
 * @property {React.RefObject<PlayerRef>} playerRef - Reference to the Remotion player instance
 */
interface VideoPlayerProps {
  playerRef: React.RefObject<PlayerRef>;
}

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
    isPlaying,
  } = useEditorContext();

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

  // Constants for player configuration
  const PLAYER_CONFIG = {
    durationInFrames: Math.round(durationInFrames),
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
  }), [overlays, setSelectedOverlayId, changeOverlay, selectedOverlayId, durationInFrames, compositionWidth, compositionHeight]);

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
      >
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
              errorFallback={() => <></>}
              overflowVisible
            />
          </div>
        </div>
      </div>
    </div>
  );
};
