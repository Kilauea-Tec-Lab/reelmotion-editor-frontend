import { renderHook, act } from "@testing-library/react";
import { useHistory } from "../../components/editor/version-7.0.0/hooks/use-history";
import {
  Overlay,
  OverlayType,
} from "../../components/editor/version-7.0.0/types";

describe("useHistory", () => {
  const createMockOverlay = (id: number): Overlay => ({
    from: 0,
    durationInFrames: 30,
    id,
    type: OverlayType.VIDEO,
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    isDragging: false,
    rotation: 0,
    row: 0,
    content: `test-video-${id}.mp4`,
    src: `test-video-${id}.mp4`,
    styles: {
      opacity: 1,
      zIndex: 1,
      transform: "none",
    },
  });

  it("should initialize with initial state", () => {
    const initialOverlays = [createMockOverlay(1)];
    const setOverlays = jest.fn();

    const { result } = renderHook(() =>
      useHistory(initialOverlays, setOverlays)
    );

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("should record history when overlays change", () => {
    const initialOverlays = [createMockOverlay(1)];
    const setOverlays = jest.fn();

    const { result, rerender } = renderHook(
      ({ overlays }) => useHistory(overlays, setOverlays),
      { initialProps: { overlays: initialOverlays } }
    );

    // Add a new overlay
    const newOverlays = [...initialOverlays, createMockOverlay(2)];
    rerender({ overlays: newOverlays });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("should undo and redo changes", () => {
    const initialOverlays = [createMockOverlay(1)];
    const setOverlays = jest.fn();

    const { result, rerender } = renderHook(
      ({ overlays }) => useHistory(overlays, setOverlays),
      { initialProps: { overlays: initialOverlays } }
    );

    // Add a new overlay
    const newOverlays = [...initialOverlays, createMockOverlay(2)];
    rerender({ overlays: newOverlays });

    // Perform undo
    act(() => {
      result.current.undo();
    });

    expect(setOverlays).toHaveBeenCalledWith(initialOverlays);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    // Perform redo
    act(() => {
      result.current.redo();
    });

    expect(setOverlays).toHaveBeenCalledWith(newOverlays);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("should clear future history when new change is made", () => {
    const initialOverlays = [createMockOverlay(1)];
    const setOverlays = jest.fn();

    const { result, rerender } = renderHook(
      ({ overlays }) => useHistory(overlays, setOverlays),
      { initialProps: { overlays: initialOverlays } }
    );

    // Add overlay 2
    const overlaysWithTwo = [...initialOverlays, createMockOverlay(2)];
    rerender({ overlays: overlaysWithTwo });

    // Undo to get back to initial state
    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    // Add overlay 3 instead
    const overlaysWithThree = [...initialOverlays, createMockOverlay(3)];
    rerender({ overlays: overlaysWithThree });

    // Future history should be cleared
    expect(result.current.canRedo).toBe(false);
  });
  it("records one undo step per canvas gesture (isDragging writes are skipped)", () => {
    const start = [createMockOverlay(1)];
    const setOverlays = jest.fn();
    const { result, rerender } = renderHook(
      ({ overlays }) => useHistory(overlays, setOverlays),
      { initialProps: { overlays: start } }
    );

    // 20 pointermove writes while dragging, then the final commit
    for (let i = 1; i <= 20; i++) {
      rerender({ overlays: [{ ...start[0], left: i, isDragging: true }] });
    }
    rerender({ overlays: [{ ...start[0], left: 20, isDragging: false }] });

    act(() => result.current.undo());
    expect(setOverlays).toHaveBeenCalledTimes(1);
    expect(setOverlays).toHaveBeenCalledWith(start);
    expect(result.current.canUndo).toBe(false);
  });

  it("caps history at 50 entries", () => {
    const setOverlays = jest.fn();
    const { result, rerender } = renderHook(
      ({ overlays }) => useHistory(overlays, setOverlays),
      { initialProps: { overlays: [createMockOverlay(1)] } }
    );
    for (let i = 0; i < 80; i++) rerender({ overlays: [createMockOverlay(i + 2)] });
    for (let i = 0; i < 50; i++) act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
    expect(setOverlays).toHaveBeenCalledTimes(50);
  });
});
