import {
  OffthreadVideo,
  useCurrentFrame,
  prefetch,
} from "remotion";
import { ClipOverlay } from "../../../types";
import { animationTemplates } from "../../../templates/animation-templates";
import { resolveVideoUrl } from "../../../utils/url-helper";
import { useEffect, useState } from "react";

/**
 * Interface defining the props for the VideoLayerContent component
 */
interface VideoLayerContentProps {
  /** The overlay configuration object containing video properties and styles */
  overlay: ClipOverlay;
  /** The base URL for the video */
  baseUrl?: string;
}

/**
 * VideoLayerContent component renders a video layer with animations and styling
 *
 * This component handles:
 * - Video playback using Remotion's OffthreadVideo
 * - Enter/exit animations based on the current frame
 * - Styling including transform, opacity, border radius, etc.
 * - Video timing and volume controls
 *
 * @param props.overlay - Configuration object for the video overlay including:
 *   - src: Video source URL
 *   - videoStartTime: Start time offset for the video
 *   - durationInFrames: Total duration of the overlay
 *   - styles: Object containing visual styling properties and animations
 */
export const VideoLayerContent: React.FC<VideoLayerContentProps> = ({
  overlay,
  baseUrl,
}) => {
  const frame = useCurrentFrame();
  const [isReady, setIsReady] = useState(false);

  const videoSrc = resolveVideoUrl(overlay.src, baseUrl);

  // Prefetch video to prevent black flash during transitions
  useEffect(() => {
    setIsReady(false);
    
    const { free, waitUntilDone } = prefetch(videoSrc, {
      method: "blob-url",
      contentType: "video/mp4",
    });

    waitUntilDone()
      .then(() => {
        setIsReady(true);
      })
      .catch((err) => {
        console.warn(`Failed to prefetch video ${overlay.src}:`, err);
        // Still show the video even if prefetch fails
        setIsReady(true);
      });

    return () => {
      free();
    };
  }, [videoSrc, overlay.src]);

  // Calculate if we're in the exit phase (last 30 frames)
  const isExitPhase = frame >= overlay.durationInFrames - 30;

  // Apply enter animation only during entry phase
  const enterAnimation =
    !isExitPhase && overlay.styles.animation?.enter
      ? animationTemplates[overlay.styles.animation.enter]?.enter(
          frame,
          overlay.durationInFrames
        )
      : {};

  // Apply exit animation only during exit phase
  const exitAnimation =
    isExitPhase && overlay.styles.animation?.exit
      ? animationTemplates[overlay.styles.animation.exit]?.exit(
          frame,
          overlay.durationInFrames
        )
      : {};

  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: overlay.styles.objectFit || "cover",
    opacity: overlay.styles.opacity,
    transform: overlay.styles.transform || "none",
    borderRadius: overlay.styles.borderRadius || "0px",
    filter: overlay.styles.filter || "none",
    boxShadow: overlay.styles.boxShadow || "none",
    border: overlay.styles.border || "none",
    ...(isExitPhase ? exitAnimation : enterAnimation),
  };

  // Create a container style that includes padding and background color
  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: overlay.styles.padding || "0px",
    backgroundColor: overlay.styles.paddingBackgroundColor || "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  // Show transparent container while loading to prevent black flash
  if (!isReady) {
    return <div style={containerStyle} />;
  }

  return (
    <div style={containerStyle}>
      <OffthreadVideo
        src={videoSrc}
        startFrom={overlay.videoStartTime || 0}
        style={videoStyle}
        volume={overlay.styles.volume ?? 1}
        playbackRate={overlay.speed ?? 1}
        pauseWhenBuffering
      />
    </div>
  );
};
