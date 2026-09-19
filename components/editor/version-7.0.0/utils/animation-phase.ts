import type React from "react";
import { animationTemplates } from "../templates/animation-templates";
import type { Overlay } from "../types";

type AnimationConfig = { enter?: string; exit?: string };

/** Frames the enter/exit templates animate over (see animation-templates.ts). */
export const ANIMATION_FRAMES = 15;

/**
 * Style for the current frame of an overlay's enter/exit animation.
 * One window shared by every layer type; the window shrinks on short clips so
 * the enter animation always gets to run.
 */
export const getAnimationStyle = (
  animation: AnimationConfig | undefined,
  frame: number,
  durationInFrames: number
): React.CSSProperties => {
  if (!animation) return {};
  // ponytail: templates still interpolate over 15 frames; on clips < 30 frames
  // the ramp is cut short (small pop) instead of never running.
  const window = Math.min(ANIMATION_FRAMES, Math.floor(durationInFrames / 2));
  if (animation.exit && frame >= durationInFrames - window) {
    return animationTemplates[animation.exit]?.exit(frame, durationInFrames) ?? {};
  }
  if (animation.enter && frame < window) {
    return animationTemplates[animation.enter]?.enter(frame, durationInFrames) ?? {};
  }
  return {};
};

/** Compose CSS filter strings, dropping empty/"none" parts. */
export const combineFilters = (
  ...parts: (string | undefined)[]
): string | undefined => {
  const kept = parts.filter((p): p is string => !!p && p !== "none");
  return kept.length ? kept.join(" ") : undefined;
};

/** Shallow prop equality for React.memo on layer components. */
export const isSameOverlay = <P extends { overlay: Overlay }>(a: P, b: P) =>
  (Object.keys(a) as (keyof P)[]).every((k) => a[k] === b[k]);
