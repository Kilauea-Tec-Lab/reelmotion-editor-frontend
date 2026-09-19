import React from "react";
import { useCurrentFrame } from "remotion";
import { ImageOverlay } from "../../../types";
import { combineFilters, getAnimationStyle } from "../../../utils/animation-phase";
import { Img } from "remotion";
import { resolveMediaUrl } from "../../../utils/url-helper";
import { getTransitionFrameStyle, LayerTransition } from "../../../utils/transitions";

/**
 * Props for the ImageLayerContent component
 * @interface ImageLayerContentProps
 * @property {ImageOverlay} overlay - The image overlay object containing source and style information
 * @property {string | undefined} baseUrl - The base URL for the image
 */
interface ImageLayerContentProps {
  overlay: ImageOverlay;
  baseUrl?: string;
  transition?: LayerTransition;
}

/**
 * ImageLayerContent Component
 *
 * @component
 * @description
 * Renders an image layer in the video editor with animation support.
 * Features include:
 * - Enter/exit animations
 * - Style customization (fit, position, opacity)
 * - Transform effects
 * - Visual effects (filters, shadows, borders)
 * - Filter presets (retro, vintage, noir, etc.)
 * - Border radius customization
 *
 * The component handles both the visual presentation and animation
 * timing for image overlays.
 *
 * @example
 * ```tsx
 * <ImageLayerContent
 *   overlay={{
 *     src: "path/to/image.jpg",
 *     styles: {
 *       objectFit: "cover",
 *       filter: "contrast(120%) saturate(110%)", // Can be a preset or custom filter
 *       borderRadius: "8px",
 *       animation: {
 *         enter: "fadeIn",
 *         exit: "fadeOut"
 *       }
 *     }
 *   }}
 * />
 * ```
 */
export const ImageLayerContent: React.FC<ImageLayerContentProps> = ({
  overlay,
  baseUrl,
  transition,
}) => {
  const frame = useCurrentFrame();
  // A running transition replaces the clip's own enter/exit animation.
  const tr = getTransitionFrameStyle(transition, frame);
  const anim = tr.active
    ? tr.style
    : getAnimationStyle(overlay.styles.animation, frame, overlay.durationInFrames);

  /**
   * Combine base styles with current animation phase
   */
  const imageStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: overlay.styles.objectFit || "cover",
    objectPosition: overlay.styles.objectPosition,
    opacity: overlay.styles.opacity,
    transform: overlay.styles.transform || "none",
    borderRadius: overlay.styles.borderRadius || "0px",
    boxShadow: overlay.styles.boxShadow || "none",
    border: overlay.styles.border || "none",
    ...anim,
    filter: combineFilters(overlay.styles.filter, anim.filter as string | undefined),
  };

  /**
   * Create a container style that includes padding and background color
   */
  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: overlay.styles.padding || "0px",
    backgroundColor: overlay.styles.paddingBackgroundColor || "transparent",
    display: "flex", // Use flexbox for centering
    alignItems: "center",
    justifyContent: "center",
  };

  const imageSrc = resolveMediaUrl(overlay.src, baseUrl);

  return (
    <div style={containerStyle}>
      <Img src={imageSrc} style={imageStyle} alt="" />
    </div>
  );
};
