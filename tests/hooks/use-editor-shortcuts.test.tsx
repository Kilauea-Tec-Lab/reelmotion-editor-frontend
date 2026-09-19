import { renderHook } from "@testing-library/react";
import { useEditorShortcuts } from "@/components/editor/version-7.0.0/hooks/use-editor-shortcuts";

const mockEditor = {
  overlays: [{ id: 1, from: 10 }, { id: 2, from: 40 }],
  playerRef: { current: { seekTo: jest.fn(), play: jest.fn(), pause: jest.fn() } },
  getCurrentFrame: () => 100,
  togglePlayPause: jest.fn(),
  durationInFrames: 300,
  undo: jest.fn(),
  redo: jest.fn(),
  canUndo: true,
  canRedo: false,
  selectedOverlayId: 2,
  selectedOverlayIds: [1, 2],
  setSelectedOverlayId: jest.fn(),
  setSelectedOverlayIds: jest.fn(),
  deleteOverlay: jest.fn(),
  duplicateOverlay: jest.fn(),
  splitOverlay: jest.fn(),
  addOverlay: jest.fn(),
};
const mockTimeline = { zoomScale: 1, setZoomScale: jest.fn(), visibleRows: 3, toggleSnap: jest.fn() };

jest.mock("@/components/editor/version-7.0.0/contexts/editor-context", () => ({
  useEditorContext: () => mockEditor,
}));
jest.mock("@/components/editor/version-7.0.0/contexts/timeline-context", () => ({
  useTimeline: () => mockTimeline,
}));
jest.mock("@/components/editor/version-7.0.0/hooks/use-timeline-positioning", () => ({
  // echoes the requested frame (+1 when it lands on 130, like "append after clip")
  useTimelinePositioning: () => ({
    findNextAvailablePosition: (_o: unknown, _r: unknown, _d: unknown, from: number) => ({ from: from === 130 ? 131 : from, row: 1 }),
  }),
}));

// Browsers send both key and code; the library matches arrows by code.
const press = (key: string, init: KeyboardEventInit = {}) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true, ...init }));
const release = (key: string) =>
  document.dispatchEvent(new KeyboardEvent("keyup", { key, code: key, bubbles: true }));

beforeEach(() => jest.clearAllMocks());

describe("useEditorShortcuts", () => {
  it("deletes the whole multi-selection and selects all with Ctrl+A", () => {
    renderHook(() => useEditorShortcuts());
    press("Delete");
    expect(mockEditor.deleteOverlay).toHaveBeenCalledWith([1, 2]);
    press("a", { ctrlKey: true });
    expect(mockEditor.setSelectedOverlayIds).toHaveBeenCalledWith([1, 2]);
  });

  it("steps frames and seconds around the playhead, clamped to the composition", () => {
    renderHook(() => useEditorShortcuts());
    press("ArrowRight");
    expect(mockEditor.playerRef.current.seekTo).toHaveBeenLastCalledWith(101);
    press("Shift", { shiftKey: true });
    press("ArrowLeft", { shiftKey: true });
    release("Shift");
    expect(mockEditor.playerRef.current.seekTo).toHaveBeenLastCalledWith(70);
    press("End");
    expect(mockEditor.playerRef.current.seekTo).toHaveBeenLastCalledWith(299);
  });

  it("splits the primary clip at the playhead and undoes only when possible", () => {
    renderHook(() => useEditorShortcuts());
    press("b", { ctrlKey: true });
    expect(mockEditor.splitOverlay).toHaveBeenCalledWith(2, 100);
    press("z", { ctrlKey: true });
    expect(mockEditor.undo).toHaveBeenCalled();
    press("y", { ctrlKey: true });
    expect(mockEditor.redo).not.toHaveBeenCalled();
  });

  it("pastes copies at the playhead keeping their relative offsets", () => {
    renderHook(() => useEditorShortcuts());
    press("c", { ctrlKey: true });
    press("v", { ctrlKey: true });
    expect(mockEditor.addOverlay).toHaveBeenCalledTimes(2);
    expect(mockEditor.addOverlay.mock.calls[0][0]).toMatchObject({ from: 100, row: 1 });
    expect(mockEditor.addOverlay.mock.calls[1][0]).toMatchObject({ from: 131, row: 1 });
  });

  it("ignores keys typed into inputs", () => {
    renderHook(() => useEditorShortcuts());
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(mockEditor.deleteOverlay).not.toHaveBeenCalled();
    input.remove();
  });
});
