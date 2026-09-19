import {
  findOutgoingNeighbor,
  getTransitionFrameStyle,
  resolveTransitions,
  transitionTemplates,
  transitionTypes,
} from "@/components/editor/version-7.0.0/utils/transitions";
import { OverlayType } from "@/components/editor/version-7.0.0/types";

const clip = (id: number, from: number, durationInFrames: number, extra: object = {}) =>
  ({ id, from, durationInFrames, row: 0, type: OverlayType.VIDEO, ...extra }) as any;

describe("resolveTransitions", () => {
  it("extends the outgoing clip into the incoming one and ranks z by start", () => {
    const a = clip(1, 0, 100);
    const b = clip(2, 100, 100, { transitionIn: { type: "crossfade", durationInFrames: 15 } });
    const map = resolveTransitions([b, a]); // order in the array must not matter

    expect(map.get(1)).toMatchObject({
      sequenceDurationInFrames: 115,
      out: { startLocalFrame: 100, durationInFrames: 15 },
      zRank: 0,
    });
    expect(map.get(2)).toMatchObject({ in: { durationInFrames: 15 }, zRank: 1 });
  });

  it("tolerates a legacy 1-frame hole but not a 2-frame gap", () => {
    const a = clip(1, 0, 100);
    const cfg = { transitionIn: { type: "crossfade", durationInFrames: 15 } };
    expect(resolveTransitions([a, clip(2, 101, 50, cfg)]).get(1)?.sequenceDurationInFrames).toBe(116);
    expect(resolveTransitions([a, clip(2, 102, 50, cfg)]).size).toBe(0);
    expect(findOutgoingNeighbor([a], clip(2, 100, 50, { row: 1 }))).toBeUndefined();
  });

  it("clamps the duration to the shorter clip", () => {
    const a = clip(1, 0, 10);
    const b = clip(2, 10, 100, { transitionIn: { type: "crossfade", durationInFrames: 45 } });
    expect(resolveTransitions([a, b]).get(2)?.in?.durationInFrames).toBe(10);
  });

  it("a middle clip can be both incoming and outgoing", () => {
    const cfg = { type: "slide", durationInFrames: 10 };
    const map = resolveTransitions([
      clip(1, 0, 50),
      clip(2, 50, 50, { transitionIn: cfg }),
      clip(3, 100, 50, { transitionIn: cfg }),
    ]);
    expect(map.get(2)).toMatchObject({ in: { durationInFrames: 10 }, out: { startLocalFrame: 50 }, zRank: 1 });
    expect(map.get(3)?.zRank).toBe(2);
  });
});

describe("getTransitionFrameStyle", () => {
  it("is inactive outside the window and fades the outgoing audio inside it", () => {
    const t = {
      sequenceDurationInFrames: 110,
      out: { config: { type: "crossfade" as const, durationInFrames: 10 }, startLocalFrame: 100, durationInFrames: 10 },
      zRank: 0,
    };
    expect(getTransitionFrameStyle(t, 50).active).toBe(false);
    expect(getTransitionFrameStyle(t, 105).volume).toBeCloseTo(0.5);
    expect(getTransitionFrameStyle(undefined, 0).active).toBe(false);
  });

  it("every template is defined and deterministic at both ends", () => {
    for (const type of transitionTypes) {
      const tpl = transitionTemplates[type];
      for (const p of [0, 0.5, 1]) {
        expect(tpl.incoming(p, "left")).toEqual(tpl.incoming(p, "left"));
        expect(tpl.outgoing(p, "up")).toEqual(tpl.outgoing(p, "up"));
      }
    }
    expect(transitionTemplates.crossfade.incoming(0, "left").opacity).toBe(0);
    expect(transitionTemplates.crossfade.incoming(1, "left").opacity).toBe(1);
    expect(transitionTemplates.wipe.incoming(1, "left").clipPath).toBe("inset(0 0 0 0.00%)");
    expect(transitionTemplates.dipToBlack.overlayColor?.(0.5)).toBe("rgba(0, 0, 0, 1.000)");
  });
});
