import { renderHook } from "@testing-library/react";
import { useTimelinePositioning } from "../../components/editor/version-7.0.0/hooks/use-timeline-positioning";
import { Overlay, OverlayType } from "../../components/editor/version-7.0.0/types";

const clip = (id: number, from: number, durationInFrames: number, row: number): Overlay =>
  ({
    id,
    from,
    durationInFrames,
    row,
    type: OverlayType.VIDEO,
    height: 100,
    width: 100,
    left: 0,
    top: 0,
    isDragging: false,
    rotation: 0,
    content: "test.mp4",
    src: "test.mp4",
    styles: { opacity: 1, zIndex: 1 },
  }) as Overlay;

// New media always lands at the playhead, on the first row that is free there.
describe("useTimelinePositioning › findNextAvailablePosition", () => {
  const { result } = renderHook(() => useTimelinePositioning());
  const find = result.current.findNextAvailablePosition;

  it("returns the playhead on row 0 when the timeline is empty", () => {
    expect(find([], 3, 100)).toEqual({ from: 0, row: 0 });
    expect(find([], 3, 100, 42)).toEqual({ from: 42, row: 0 });
  });

  it("uses row 0 when it is free at the playhead, even if other rows are busy", () => {
    expect(find([clip(1, 0, 10, 1)], 3, 100, 5)).toEqual({ from: 5, row: 0 });
    expect(find([clip(1, 0, 10, 0)], 3, 100, 10)).toEqual({ from: 10, row: 0 });
  });

  it("drops to the next free row when the playhead is inside a clip", () => {
    expect(find([clip(1, 0, 10, 0)], 3, 100, 5)).toEqual({ from: 5, row: 1 });
    expect(find([clip(1, 0, 10, 0), clip(2, 0, 10, 1)], 3, 100, 5)).toEqual({ from: 5, row: 2 });
  });

  it("falls back to the last visible row when every row is busy at the playhead", () => {
    const overlays = [clip(1, 0, 10, 0), clip(2, 0, 10, 1), clip(3, 0, 10, 2)];
    expect(find(overlays, 3, 100, 5)).toEqual({ from: 5, row: 2 });
  });
});
