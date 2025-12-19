import { renderHook, act } from "@testing-library/react";
import { useRendering } from "../../components/editor/version-7.0.0/hooks/use-rendering";
import {
  getProgress as ssrGetProgress,
  renderVideo as ssrRenderVideo,
} from "../../components/editor/version-7.0.0/ssr-helpers/api";
import {
  getProgress as lambdaGetProgress,
  renderVideo as lambdaRenderVideo,
} from "../../components/editor/version-7.0.0/lambda-helpers/api";

// Mock the API modules
jest.mock("../../components/editor/version-7.0.0/ssr-helpers/api");
jest.mock("../../components/editor/version-7.0.0/lambda-helpers/api");

describe("useRendering", () => {
  const mockId = "test-id";
  const mockInputProps = {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
    overlays: [],
    src: "test-video.mp4",
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should initialize with init status", () => {
    const { result } = renderHook(() => useRendering(mockId, mockInputProps));
    expect(result.current.state).toEqual({ status: "init" });
  });

  it("should handle SSR rendering flow successfully", async () => {
    const mockRenderId = "test-render-id";

    // Setup all mocks before starting the test
    (ssrRenderVideo as jest.Mock).mockImplementation(() =>
      Promise.resolve({ renderId: mockRenderId })
    );

    const progressMock = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({ type: "progress", progress: 0 })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ type: "progress", progress: 50 })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          type: "done",
          url: "https://example.com/video.mp4",
          size: 1024,
        })
      );

    (ssrGetProgress as jest.Mock).mockImplementation(progressMock);

    const { result } = renderHook(() =>
      useRendering(mockId, mockInputProps, "ssr")
    );

    await act(async () => {
      result.current.renderMedia();
      await Promise.resolve();
    });

    expect(result.current.state).toEqual({ status: "invoking" });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(result.current.state).toEqual({
      status: "rendering",
      progress: 0,
      renderId: mockRenderId,
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(result.current.state).toEqual({
      status: "rendering",
      progress: 50,
      renderId: mockRenderId,
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(result.current.state).toEqual({
      status: "done",
      url: "https://example.com/video.mp4",
      size: 1024,
    });
  });

  it("should handle SSR rendering errors", async () => {
    const mockError = new Error("Rendering failed");
    (ssrRenderVideo as jest.Mock).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useRendering(mockId, mockInputProps));

    await act(async () => {
      result.current.renderMedia();
    });

    expect(result.current.state).toEqual({
      status: "error",
      error: mockError,
      renderId: null,
    });
  });

  it("should handle SSR progress errors", async () => {
    const mockRenderId = "error-render-id";

    (ssrRenderVideo as jest.Mock).mockResolvedValueOnce({
      renderId: mockRenderId,
    });

    // Mock only one progress update that returns an error
    (ssrGetProgress as jest.Mock).mockResolvedValueOnce({
      type: "error",
      message: "Progress check failed",
    });

    const { result } = renderHook(() => useRendering(mockId, mockInputProps));

    await act(async () => {
      result.current.renderMedia();
    });

    // Fast-forward past the initial delay
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.state).toEqual({
      status: "error",
      error: new Error("Progress check failed"),
      renderId: mockRenderId,
    });
  });

  it("should reset state when undo is called", async () => {
    const { result } = renderHook(() => useRendering(mockId, mockInputProps));

    await act(async () => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ status: "init" });
  });

  it("should handle Lambda rendering errors", async () => {
    const mockError = new Error("Lambda rendering failed");
    (lambdaRenderVideo as jest.Mock).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() =>
      useRendering(mockId, mockInputProps, "lambda")
    );

    await act(async () => {
      result.current.renderMedia();
    });

    expect(result.current.state).toEqual({
      status: "error",
      error: mockError,
      renderId: null,
    });
  });

  it("should retry progress polling when rate limited (Rate Exceeded)", async () => {
    const mockRenderId = "lambda-render-id";
    const bucketName = "lambda-bucket";

    (lambdaRenderVideo as jest.Mock).mockResolvedValueOnce({
      renderId: mockRenderId,
      bucketName,
    });

    (lambdaGetProgress as jest.Mock)
      .mockRejectedValueOnce(new Error("Rate Exceeded."))
      .mockResolvedValueOnce({ type: "progress", progress: 0.25 })
      .mockResolvedValueOnce({
        type: "done",
        url: "https://example.com/video.mp4",
        size: 1234,
      });

    const { result } = renderHook(() =>
      useRendering(mockId, mockInputProps, "lambda")
    );

    await act(async () => {
      result.current.renderMedia();
      await Promise.resolve();
    });

    // The hook should be in rendering state even if first progress poll is throttled.
    expect(result.current.state).toEqual({
      status: "rendering",
      progress: 0,
      renderId: mockRenderId,
      bucketName,
    });

    // First retry backoff for lambda starts at 4000ms
    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    expect(result.current.state).toEqual({
      status: "rendering",
      progress: 0.25,
      renderId: mockRenderId,
    });

    // Next poll interval for lambda is 2500ms
    await act(async () => {
      jest.advanceTimersByTime(2500);
      await Promise.resolve();
    });

    expect(result.current.state).toEqual({
      status: "done",
      url: "https://example.com/video.mp4",
      size: 1234,
    });
  });
});
