import { OffthreadVideo, useCurrentFrame } from "remotion";
import { ClipOverlay } from "../../../types";
import { resolveVideoUrl } from "../../../utils/url-helper";
import { memo, useMemo } from "react";
import {
  combineFilters,
  getAnimationStyle,
  isSameOverlay,
} from "../../../utils/animation-phase";

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
export const VideoLayerContent: React.FC<VideoLayerContentProps> = memo(
  function VideoLayerContent({ overlay, baseUrl }) {
  const frame = useCurrentFrame();
  const { styles } = overlay;

  const videoSrc = useMemo(
    () => resolveVideoUrl(overlay.src, baseUrl),
    [overlay.src, baseUrl]
  );

  const anim = getAnimationStyle(styles.animation, frame, overlay.durationInFrames);
  const filter = combineFilters(styles.filter, anim.filter as string | undefined);

  // Only reallocated when a style value actually changes, not every frame.
  const videoStyle: React.CSSProperties = useMemo(
    () => ({
      width: "100%",
      height: "100%",
      objectFit: styles.objectFit || "cover",
      opacity: styles.opacity,
      transform: styles.transform || "none",
      borderRadius: styles.borderRadius || "0px",
      boxShadow: styles.boxShadow || "none",
      border: styles.border || "none",
      ...anim,
      filter,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [styles, anim.opacity, anim.transform, anim.clipPath, filter]
  );

  const containerStyle: React.CSSProperties = useMemo(
    () => ({
      width: "100%",
      height: "100%",
      padding: styles.padding || "0px",
      backgroundColor: styles.paddingBackgroundColor || "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }),
    [styles.padding, styles.paddingBackgroundColor]
  );

  return (
    <div style={containerStyle}>
      <OffthreadVideo
        src={videoSrc}
        startFrom={overlay.videoStartTime || 0}
        style={videoStyle}
        volume={overlay.styles.volume ?? 1}
        playbackRate={overlay.speed ?? 1}
        pauseWhenBuffering
        crossOrigin="anonymous"
      />
    </div>
  );
  },
  isSameOverlay
);
