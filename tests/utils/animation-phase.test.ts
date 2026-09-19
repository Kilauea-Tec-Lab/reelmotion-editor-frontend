import {
  getAnimationStyle,
  combineFilters,
} from "../../components/editor/version-7.0.0/utils/animation-phase";

describe("getAnimationStyle", () => {
  it("runs the enter animation on clips shorter than 30 frames", () => {
    // Old code used a fixed 30-frame exit window, so a 20-frame clip never entered.
    const style = getAnimationStyle({ enter: "fade", exit: "fade" }, 0, 20);
    expect(style.opacity).toBe(0);
  });

  it("switches to exit in the last window and is idle in the middle", () => {
    const anim = { enter: "fade", exit: "fade" };
    expect(getAnimationStyle(anim, 50, 100)).toEqual({});
    expect(getAnimationStyle(anim, 99, 100).opacity).toBeLessThan(0.2);
  });

  it("is deterministic (glitch uses seeded random)", () => {
    const a = getAnimationStyle({ enter: "glitch" }, 3, 100);
    const b = getAnimationStyle({ enter: "glitch" }, 3, 100);
    expect(a).toEqual(b);
  });
});

describe("combineFilters", () => {
  it("composes preset and animation filters, dropping none/empty", () => {
    expect(combineFilters("sepia(1)", "none", undefined, "blur(2px)")).toBe(
      "sepia(1) blur(2px)"
    );
    expect(combineFilters("none", undefined)).toBeUndefined();
  });
});
