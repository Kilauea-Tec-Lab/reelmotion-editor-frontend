import React, { useMemo } from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { Caption, CaptionOverlay, CaptionWord } from "../../../types";
import { defaultCaptionStyles } from "./caption-settings";

/**
 * Props for the CaptionLayerContent component
 * @interface CaptionLayerContentProps
 * @property {CaptionOverlay} overlay - The caption overlay object containing timing and style information
 */
interface CaptionLayerContentProps {
  overlay: CaptionOverlay;
}

const FPS = 30;
// Frame-based fade durations so animations are deterministic in Remotion's
// frame-by-frame renderer (CSS transitions don't animate through seeks).
const CAPTION_FADE_FRAMES = 6; // ~200ms at 30fps
const WORD_HIGHLIGHT_FRAMES = 6; // ~200ms ramp on word activation

const msToFrames = (ms: number) => (ms / 1000) * FPS;

/**
 * Build a fade-in/out opacity ramp for a window [start, end] using `fadeFrames`
 * on each side. If the window is shorter than 2*fadeFrames, the input range
 * collapses to a 3-point triangle to keep it strictly monotonically increasing
 * (a Remotion requirement of `interpolate`).
 */
const fadeOpacity = (
  frame: number,
  start: number,
  end: number,
  fadeFrames: number
): number => {
  const duration = end - start;
  if (duration <= 0) return 0;

  const fade = Math.min(fadeFrames, duration / 2);
  const opts = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
    easing: Easing.out(Easing.ease),
  };

  if (fade > 0 && duration > fade * 2) {
    return interpolate(
      frame,
      [start, start + fade, end - fade, end],
      [0, 1, 1, 0],
      opts
    );
  }

  const mid = (start + end) / 2;
  return interpolate(frame, [start, mid, end], [0, 1, 0], opts);
};

/**
 * Stretch caption + word timings so they span the entire overlay duration with
 * no gaps. Preserves relative pacing where possible, but guarantees that some
 * caption (and word) is always on-screen as long as the overlay is visible.
 */
const buildStretchedCaptions = (
  captions: Caption[],
  overlayDurationMs: number
): Caption[] => {
  if (captions.length === 0 || overlayDurationMs <= 0) return [];

  const naturalStart = captions[0].startMs;
  const naturalEnd = captions[captions.length - 1].endMs;
  const naturalDuration = Math.max(naturalEnd - naturalStart, 1);
  const stretch = overlayDurationMs / naturalDuration;
  const remap = (ms: number) => (ms - naturalStart) * stretch;

  const remapped: Caption[] = captions.map((c) => ({
    ...c,
    startMs: remap(c.startMs),
    endMs: remap(c.endMs),
    words:
      c.words?.map((w) => ({
        ...w,
        startMs: remap(w.startMs),
        endMs: remap(w.endMs),
      })) ?? [],
  }));

  // Close gaps so a caption (and a word inside it) is always visible.
  for (let i = 0; i < remapped.length; i++) {
    const c = remapped[i];
    const next = remapped[i + 1];
    if (i === 0) c.startMs = 0;
    c.endMs = next ? next.startMs : overlayDurationMs;

    if (c.words.length > 0) {
      c.words[0].startMs = c.startMs;
      c.words[c.words.length - 1].endMs = c.endMs;
      for (let j = 0; j < c.words.length - 1; j++) {
        c.words[j].endMs = c.words[j + 1].startMs;
      }
    }
  }

  return remapped;
};

/**
 * CaptionLayerContent Component
 *
 * Renders animated captions with frame-based fade in/out and smooth
 * word-by-word highlight progression. Uses Remotion's `interpolate` so the
 * animation is consistent in both preview seek and final render.
 */
export const CaptionLayerContent: React.FC<CaptionLayerContentProps> = ({
  overlay,
}) => {
  const frame = useCurrentFrame();
  const frameMs = (frame / FPS) * 1000;
  const styles = overlay.styles || defaultCaptionStyles;
  const displayMode = overlay.displayMode ?? "all";

  const overlayDurationMs = (overlay.durationInFrames / FPS) * 1000;

  const stretchedCaptions = useMemo(
    () => buildStretchedCaptions(overlay.captions, overlayDurationMs),
    [overlay.captions, overlayDurationMs]
  );

  if (stretchedCaptions.length === 0) return null;

  // Find the active caption. Captions now cover the full overlay window with
  // no gaps, but clamp to the last one to guard against floating-point drift.
  const currentCaption =
    stretchedCaptions.find(
      (caption) => frameMs >= caption.startMs && frameMs < caption.endMs
    ) ?? stretchedCaptions[stretchedCaptions.length - 1];

  const captionStartFrame = msToFrames(currentCaption.startMs);
  const captionEndFrame = msToFrames(currentCaption.endMs);

  // Fade the caption container in at the start and out at the end of its
  // window so it doesn't pop in/out abruptly.
  const containerOpacity = fadeOpacity(
    frame,
    captionStartFrame,
    captionEndFrame,
    CAPTION_FADE_FRAMES
  );

  const highlightStyle =
    styles.highlightStyle || defaultCaptionStyles.highlightStyle;

  const renderWord = (
    word: CaptionWord,
    index: number,
    options: { highlightedOnly?: boolean } = {}
  ) => {
    const wordStartFrame = msToFrames(word.startMs);
    const wordEndFrame = msToFrames(word.endMs);
    const isActive = frame >= wordStartFrame && frame < wordEndFrame;

    const highlightProgress = fadeOpacity(
      frame,
      wordStartFrame,
      wordEndFrame,
      WORD_HIGHLIGHT_FRAMES
    );

    const targetScale = highlightStyle?.scale ?? 1.08;
    const scale = 1 + (targetScale - 1) * highlightProgress;
    const baseOpacity = options.highlightedOnly ? 1 : 0.85;
    const opacity = baseOpacity + (1 - baseOpacity) * highlightProgress;
    const useHighlight = options.highlightedOnly ? true : isActive;

    return (
      <span
        key={`${word.word}-${index}`}
        className="inline-block"
        style={{
          color: useHighlight ? highlightStyle?.color : styles.color,
          backgroundColor: useHighlight
            ? highlightStyle?.backgroundColor
            : "transparent",
          opacity,
          transform: `scale(${scale})`,
          fontWeight: useHighlight
            ? highlightStyle?.fontWeight || 600
            : styles.fontWeight || 400,
          textShadow: useHighlight
            ? highlightStyle?.textShadow
            : styles.textShadow,
          padding: highlightStyle?.padding || "4px 8px",
          borderRadius: highlightStyle?.borderRadius || "4px",
          margin: "0 2px",
          transition: "color 120ms linear, background-color 120ms linear",
        }}
      >
        {word.word}
      </span>
    );
  };

  // Pick the active word — fall back to the closest one so something is always
  // rendered when the playhead lands on a boundary.
  const activeWord = (() => {
    const words = currentCaption.words || [];
    if (words.length === 0) return null;
    const found = words.find(
      (w) => frameMs >= w.startMs && frameMs < w.endMs
    );
    if (found) return found;
    if (frameMs < words[0].startMs) return words[0];
    return words[words.length - 1];
  })();

  let body: React.ReactNode = null;

  if (displayMode === "word") {
    body = activeWord ? renderWord(activeWord, 0, { highlightedOnly: true }) : null;
  } else if (displayMode === "sentence") {
    body = (
      <span
        style={{
          color: styles.color,
          fontWeight: styles.fontWeight || 400,
          textShadow: styles.textShadow,
          padding: highlightStyle?.padding || "4px 8px",
          borderRadius: highlightStyle?.borderRadius || "4px",
        }}
      >
        {currentCaption.text}
      </span>
    );
  } else {
    body = currentCaption.words?.map((word, idx) => renderWord(word, idx));
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-4"
      style={{
        ...styles,
        width: "100%",
        height: "100%",
        opacity: containerOpacity,
      }}
    >
      <div
        className="leading-relaxed tracking-wide"
        style={{
          whiteSpace: "pre-wrap",
          width: "100%",
          textAlign: "center",
          wordBreak: "break-word",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "2px",
        }}
      >
        {body}
      </div>
    </div>
  );
};
