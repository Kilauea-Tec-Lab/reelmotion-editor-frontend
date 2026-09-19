/**
 * Clip transitions.
 *
 * A transition lives on the incoming clip (`transitionIn`). The user's data
 * (`from`/`durationInFrames`) never changes: at render time the outgoing clip's
 * Sequence is extended `d` frames into the incoming clip and both layers get a
 * per-frame style. Main runs the same code in the Player and on the render
 * server, so preview and export match by construction.
 */
import type React from "react";
import { Easing, interpolate } from "remotion";
import { Overlay, OverlayType } from "../types";

export type TransitionType =
  | "crossfade"
  | "dipToBlack"
  | "dipToWhite"
  | "slide"
  | "wipe"
  | "push"
  | "zoomIn"
  | "zoomOut"
  | "blur"
  | "whipPan"
  | "flash";

export type TransitionDirection = "left" | "right" | "up" | "down";

export interface TransitionConfig {
  type: TransitionType;
  durationInFrames: number;
  direction?: TransitionDirection;
}

export const TRANSITION_MIN_FRAMES = 6;
export const TRANSITION_MAX_FRAMES = 60;
/** Legacy projects may have a 1-frame hole between "adjacent" clips. */
const ADJACENCY_TOLERANCE = 1;

interface TransitionTemplate {
  durationDefault: number;
  directional?: boolean;
  /** Style of the clip coming in; p goes 0 → 1 over the transition. */
  incoming: (p: number, dir: TransitionDirection) => React.CSSProperties;
  /** Style of the clip going out. */
  outgoing: (p: number, dir: TransitionDirection) => React.CSSProperties;
  /** Full-cover color drawn over the incoming clip (dips, flash). */
  overlayColor?: (p: number) => string | undefined;
}

const ease = (p: number) =>
  interpolate(p, [0, 1], [0, 1], { easing: Easing.inOut(Easing.ease) });

// +1 pushes towards +x/+y (right/down); incoming enters from the opposite side.
const sign = (dir: TransitionDirection) => (dir === "left" || dir === "up" ? -1 : 1);
const axis = (dir: TransitionDirection) => (dir === "left" || dir === "right" ? "X" : "Y");
const translate = (dir: TransitionDirection, pct: number) =>
  `translate${axis(dir)}(${pct.toFixed(2)}%)`;

const slideIn = (p: number, dir: TransitionDirection) => ({
  transform: translate(dir, -sign(dir) * (1 - ease(p)) * 100),
});
const slideOut = (p: number, dir: TransitionDirection) => ({
  transform: translate(dir, sign(dir) * ease(p) * 100),
});

const wipeInset = (dir: TransitionDirection, hidden: number) => {
  const h = `${(hidden * 100).toFixed(2)}%`;
  switch (dir) {
    case "left":
      return `inset(0 0 0 ${h})`;
    case "right":
      return `inset(0 ${h} 0 0)`;
    case "up":
      return `inset(${h} 0 0 0)`;
    default:
      return `inset(0 0 ${h} 0)`;
  }
};

/** 0 → 1 → 0 with the peak at `peak`. */
const bump = (p: number, peak: number) =>
  p < peak ? p / peak : (1 - p) / (1 - peak);

const dip = (color: string): TransitionTemplate => ({
  durationDefault: 20,
  incoming: (p) => ({ opacity: p >= 0.5 ? 1 : 0 }),
  outgoing: (p) => ({ opacity: p < 0.5 ? 1 : 0 }),
  overlayColor: (p) => `rgba(${color}, ${bump(p, 0.5).toFixed(3)})`,
});

export const transitionTemplates: Record<TransitionType, TransitionTemplate> = {
  crossfade: {
    durationDefault: 15,
    incoming: (p) => ({ opacity: p }),
    outgoing: () => ({}),
  },
  dipToBlack: dip("0, 0, 0"),
  dipToWhite: dip("255, 255, 255"),
  slide: { durationDefault: 15, directional: true, incoming: slideIn, outgoing: () => ({}) },
  push: { durationDefault: 15, directional: true, incoming: slideIn, outgoing: slideOut },
  wipe: {
    durationDefault: 15,
    directional: true,
    incoming: (p, dir) => ({ clipPath: wipeInset(dir, 1 - ease(p)) }),
    outgoing: () => ({}),
  },
  zoomIn: {
    durationDefault: 15,
    incoming: (p) => ({ opacity: p, transform: `scale(${(0.6 + 0.4 * ease(p)).toFixed(3)})` }),
    outgoing: (p) => ({ transform: `scale(${(1 + 0.4 * ease(p)).toFixed(3)})` }),
  },
  zoomOut: {
    durationDefault: 15,
    incoming: (p) => ({ opacity: p, transform: `scale(${(1.4 - 0.4 * ease(p)).toFixed(3)})` }),
    outgoing: (p) => ({ transform: `scale(${(1 - 0.4 * ease(p)).toFixed(3)})` }),
  },
  blur: {
    durationDefault: 15,
    incoming: (p) => ({ opacity: p, filter: `blur(${((1 - ease(p)) * 20).toFixed(1)}px)` }),
    outgoing: (p) => ({ filter: `blur(${(ease(p) * 20).toFixed(1)}px)` }),
  },
  whipPan: {
    durationDefault: 8,
    directional: true,
    incoming: (p, dir) => ({
      ...slideIn(p, dir),
      filter: `blur(${(Math.sin(p * Math.PI) * 14).toFixed(1)}px)`,
    }),
    outgoing: (p, dir) => ({
      ...slideOut(p, dir),
      filter: `blur(${(Math.sin(p * Math.PI) * 14).toFixed(1)}px)`,
    }),
  },
  flash: {
    durationDefault: 10,
    incoming: (p) => ({ opacity: p >= 0.3 ? 1 : 0 }),
    outgoing: (p) => ({ opacity: p < 0.3 ? 1 : 0 }),
    overlayColor: (p) => `rgba(255, 255, 255, ${bump(p, 0.3).toFixed(3)})`,
  },
};

export const transitionTypes = Object.keys(transitionTemplates) as TransitionType[];

/** Per-overlay render info produced by `resolveTransitions`. */
export interface LayerTransition {
  /** Frames the Sequence runs; longer than the clip when it fades into the next one. */
  sequenceDurationInFrames: number;
  in?: { config: TransitionConfig; durationInFrames: number };
  out?: { config: TransitionConfig; startLocalFrame: number; durationInFrames: number };
  /** Later clips in a row sit above earlier ones so the incoming clip composes on top. */
  zRank: number;
}

export const isTransitionCapable = (
  o: Overlay
): o is Overlay & { transitionIn?: TransitionConfig } =>
  o.type === OverlayType.VIDEO || o.type === OverlayType.IMAGE;
const canTransition = isTransitionCapable;

const clampDuration = (cfg: TransitionConfig, a: Overlay, b: Overlay) =>
  Math.max(
    TRANSITION_MIN_FRAMES,
    Math.min(cfg.durationInFrames, TRANSITION_MAX_FRAMES, a.durationInFrames, b.durationInFrames)
  );

/** The clip that ends where `incoming` starts (same row, video/image), if any. */
export const findOutgoingNeighbor = (
  overlays: Overlay[],
  incoming: Overlay
): Overlay | undefined =>
  overlays.find((o) => {
    if (o.id === incoming.id || o.row !== incoming.row || !canTransition(o)) return false;
    const gap = incoming.from - (o.from + o.durationInFrames);
    return gap >= 0 && gap <= ADJACENCY_TOLERANCE;
  });

/**
 * Pure: maps overlay id → timing/z info for every clip taking part in a
 * transition. Clips whose neighbor moved away simply get no entry (the
 * transition is kept on the data and comes back when they touch again).
 */
export const resolveTransitions = (overlays: Overlay[]): Map<number, LayerTransition> => {
  const result = new Map<number, LayerTransition>();
  const entry = (o: Overlay): LayerTransition => {
    let e = result.get(o.id);
    if (!e) {
      e = { sequenceDurationInFrames: o.durationInFrames, zRank: 0 };
      result.set(o.id, e);
    }
    return e;
  };

  for (const incoming of overlays) {
    if (!canTransition(incoming) || !incoming.transitionIn) continue;
    const outgoing = findOutgoingNeighbor(overlays, incoming);
    if (!outgoing) continue;

    const config = incoming.transitionIn;
    const d = clampDuration(config, outgoing, incoming);
    const gap = incoming.from - (outgoing.from + outgoing.durationInFrames);

    entry(incoming).in = { config, durationInFrames: d };
    const out = entry(outgoing);
    out.sequenceDurationInFrames = outgoing.durationInFrames + gap + d;
    out.out = { config, startLocalFrame: outgoing.durationInFrames + gap, durationInFrames: d };
  }

  // z order: rank by start time within each row, only among clips in the map.
  const byRow = new Map<number, Overlay[]>();
  overlays.forEach((o) => {
    if (!result.has(o.id)) return;
    byRow.set(o.row, [...(byRow.get(o.row) ?? []), o]);
  });
  byRow.forEach((row) =>
    [...row]
      .sort((a, b) => a.from - b.from)
      .forEach((o, rank) => {
        result.get(o.id)!.zRank = rank;
      })
  );

  return result;
};

export interface TransitionFrameStyle {
  /** True while a transition is running on this frame (enter/exit animations are skipped). */
  active: boolean;
  style: React.CSSProperties;
  overlayColor?: string;
  /** 0..1 multiplier for the outgoing clip's audio. */
  volume: number;
}

const IDLE: TransitionFrameStyle = { active: false, style: {}, volume: 1 };

/** Style for `localFrame` (relative to the layer's Sequence). */
export const getTransitionFrameStyle = (
  t: LayerTransition | undefined,
  localFrame: number
): TransitionFrameStyle => {
  if (!t) return IDLE;
  if (t.in && localFrame < t.in.durationInFrames) {
    const p = localFrame / t.in.durationInFrames;
    const tpl = transitionTemplates[t.in.config.type];
    const dir = t.in.config.direction ?? "left";
    return {
      active: true,
      style: tpl.incoming(p, dir),
      overlayColor: tpl.overlayColor?.(p),
      volume: 1,
    };
  }
  if (t.out && localFrame >= t.out.startLocalFrame) {
    const p = Math.min(1, (localFrame - t.out.startLocalFrame) / t.out.durationInFrames);
    const tpl = transitionTemplates[t.out.config.type];
    return {
      active: true,
      style: tpl.outgoing(p, t.out.config.direction ?? "left"),
      volume: 1 - p,
    };
  }
  return IDLE;
};
