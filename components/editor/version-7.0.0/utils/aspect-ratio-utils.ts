import { AspectRatio } from "../types";

const ASPECT_RATIOS: Array<{ ratio: AspectRatio; value: number }> = [
  { ratio: "16:9", value: 16 / 9 },
  { ratio: "9:16", value: 9 / 16 },
  { ratio: "1:1", value: 1 },
  { ratio: "4:5", value: 4 / 5 },
  { ratio: "4:3", value: 4 / 3 },
  { ratio: "2:1", value: 2 },
  { ratio: "3:4", value: 3 / 4 },
];

/**
 * Infers a known aspect ratio from dimensions.
 * Useful for backwards compatibility with saved edits that only store width/height.
 */
export const inferAspectRatioFromDimensions = (
  width: unknown,
  height: unknown,
  tolerance = 0.01
): AspectRatio | null => {
  const w = typeof width === "number" ? width : Number(width);
  const h = typeof height === "number" ? height : Number(height);

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }

  const value = w / h;
  let best: { ratio: AspectRatio; diff: number } | null = null;

  for (const candidate of ASPECT_RATIOS) {
    const diff = Math.abs(candidate.value - value);
    if (!best || diff < best.diff) {
      best = { ratio: candidate.ratio, diff };
    }
  }

  if (!best) return null;
  return best.diff <= tolerance ? best.ratio : null;
};
