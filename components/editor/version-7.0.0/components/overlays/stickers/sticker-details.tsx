/**
 * StickerDetails Component
 *
 * A component that provides a user interface for configuring sticker overlay settings.
 * It displays a sticker preview along with animation controls.
 *
 * Features:
 * - Sticker preview display
 * - Animation settings (enter/exit animations)
 *
 * @component
 */

import React from "react";
import { StickerOverlay } from "../../../types";
import { Sparkles } from "lucide-react";
import { AnimationSettings } from "../../shared/animation-preview";
import { animationTemplates } from "../../../templates/animation-templates";

interface StickerDetailsProps {
  /** The current state of the sticker overlay */
  localOverlay: StickerOverlay;
  /** Callback function to update the sticker overlay state */
  setLocalOverlay: (overlay: StickerOverlay) => void;
}

/**
 * StickerDetails component for managing sticker overlay configuration
 */
export const StickerDetails: React.FC<StickerDetailsProps> = ({
  localOverlay,
  setLocalOverlay,
}) => {
  /**
   * Updates the style properties of the sticker overlay
   */
  const handleStyleChange = (updates: Partial<StickerOverlay["styles"]>) => {
    const updatedOverlay = {
      ...localOverlay,
      styles: {
        ...localOverlay.styles,
        ...updates,
      },
    };
    setLocalOverlay(updatedOverlay);
  };

  /**
   * Handles animation selection for enter animations
   */
  const handleEnterAnimationSelect = (animationKey: string) => {
    handleStyleChange({
      animation: {
        ...localOverlay.styles.animation,
        enter: animationKey,
      },
    });
  };

  /**
   * Handles animation selection for exit animations
   */
  const handleExitAnimationSelect = (animationKey: string) => {
    handleStyleChange({
      animation: {
        ...localOverlay.styles.animation,
        exit: animationKey,
      },
    });
  };

  return (
    <div className="space-y-4 p-4">
      {/* Preview Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Sticker Animations
          </h3>
        </div>
      </div>

      {/* Animation Settings */}
      <AnimationSettings
        animations={animationTemplates}
        selectedEnterAnimation={localOverlay.styles.animation?.enter}
        selectedExitAnimation={localOverlay.styles.animation?.exit}
        onEnterAnimationSelect={handleEnterAnimationSelect}
        onExitAnimationSelect={handleExitAnimationSelect}
      />
    </div>
  );
};
