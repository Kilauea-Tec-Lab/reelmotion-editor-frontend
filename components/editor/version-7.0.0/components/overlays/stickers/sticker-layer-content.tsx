import React, { memo } from "react";
import { useCurrentFrame } from "remotion";
import { StickerOverlay } from "../../../types";
import { templateMap } from "../../../templates/sticker-templates/sticker-helpers";
import { animationTemplates } from "../../../templates/animation-templates";

interface StickerLayerContentProps {
  overlay: StickerOverlay;
  isSelected: boolean;
  onUpdate?: (updates: Partial<StickerOverlay>) => void;
}

export const StickerLayerContent: React.FC<StickerLayerContentProps> = memo(
  ({ overlay, isSelected, onUpdate }) => {
    const frame = useCurrentFrame();
    const template = templateMap[overlay.content];

    if (!template) {
      console.warn(`No sticker template found for id: ${overlay.content}`);
      return null;
    }

    // Calculate if we're in the exit phase (last 30 frames)
    const isExitPhase = frame >= overlay.durationInFrames - 30;

    // Apply enter animation only during entry phase
    const enterAnimation =
      !isExitPhase && overlay.styles?.animation?.enter
        ? animationTemplates[overlay.styles.animation.enter]?.enter(
            frame,
            overlay.durationInFrames
          )
        : {};

    // Apply exit animation only during exit phase
    const exitAnimation =
      isExitPhase && overlay.styles?.animation?.exit
        ? animationTemplates[overlay.styles.animation.exit]?.exit(
            frame,
            overlay.durationInFrames
          )
        : {};

    const { Component } = template;
    const MemoizedComponent = memo(Component);
    
    // Merge animation styles with overlay styles
    const animationStyle = isExitPhase ? exitAnimation : enterAnimation;
    
    const props = {
      ...template.config.defaultProps,
      overlay: {
        ...overlay,
        styles: {
          ...overlay.styles,
          // Don't override transform from animations if they exist
          ...(animationStyle.transform && { transform: animationStyle.transform }),
          ...(animationStyle.opacity !== undefined && { opacity: animationStyle.opacity }),
        },
      },
      isSelected,
      onUpdate,
      animationStyle, // Pass animation styles separately if needed
    };

    return (
      <div style={animationStyle}>
        <MemoizedComponent {...props} />
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if these props change
    return (
      prevProps.overlay.content === nextProps.overlay.content &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.overlay.styles?.opacity === nextProps.overlay.styles?.opacity &&
      prevProps.overlay.styles?.animation?.enter === nextProps.overlay.styles?.animation?.enter &&
      prevProps.overlay.styles?.animation?.exit === nextProps.overlay.styles?.animation?.exit &&
      prevProps.overlay.rotation === nextProps.overlay.rotation &&
      prevProps.overlay.width === nextProps.overlay.width &&
      prevProps.overlay.height === nextProps.overlay.height
    );
  }
);

StickerLayerContent.displayName = "StickerLayerContent";
