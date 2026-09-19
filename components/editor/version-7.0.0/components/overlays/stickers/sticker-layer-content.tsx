import React, { memo } from "react";
import { useCurrentFrame } from "remotion";
import { StickerOverlay } from "../../../types";
import { templateMap } from "../../../templates/sticker-templates/sticker-helpers";
import { getAnimationStyle } from "../../../utils/animation-phase";

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

    const animationStyle = getAnimationStyle(
      overlay.styles?.animation,
      frame,
      overlay.durationInFrames
    );

    const { Component } = template;
    const props = {
      ...template.config.defaultProps,
      overlay,
      isSelected,
      onUpdate,
      animationStyle,
    };

    // Animation applied once, on the wrapper only.
    return (
      <div style={animationStyle}>
        <Component {...props} />
      </div>
    );
  },
  (prev, next) =>
    prev.overlay === next.overlay &&
    prev.isSelected === next.isSelected &&
    prev.onUpdate === next.onUpdate
);

StickerLayerContent.displayName = "StickerLayerContent";
