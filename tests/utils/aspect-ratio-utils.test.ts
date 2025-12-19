import { inferAspectRatioFromDimensions } from "../../components/editor/version-7.0.0/utils/aspect-ratio-utils";

describe("inferAspectRatioFromDimensions", () => {
  it("returns null for invalid inputs", () => {
    expect(inferAspectRatioFromDimensions(undefined, 100)).toBeNull();
    expect(inferAspectRatioFromDimensions(100, undefined)).toBeNull();
    expect(inferAspectRatioFromDimensions(0, 100)).toBeNull();
    expect(inferAspectRatioFromDimensions(100, 0)).toBeNull();
    expect(inferAspectRatioFromDimensions(NaN, 100)).toBeNull();
  });

  it("infers common ratios from typical dimensions", () => {
    expect(inferAspectRatioFromDimensions(1280, 720)).toBe("16:9");
    expect(inferAspectRatioFromDimensions(1080, 1920)).toBe("9:16");
    expect(inferAspectRatioFromDimensions(1080, 1080)).toBe("1:1");
    expect(inferAspectRatioFromDimensions(1080, 1350)).toBe("4:5");
    expect(inferAspectRatioFromDimensions(1024, 768)).toBe("4:3");
    expect(inferAspectRatioFromDimensions(2048, 1024)).toBe("2:1");
    expect(inferAspectRatioFromDimensions(1080, 1440)).toBe("3:4");
  });

  it("returns null when the ratio is not close to a supported one", () => {
    expect(inferAspectRatioFromDimensions(1000, 1000 - 123)).toBeNull();
  });
});
