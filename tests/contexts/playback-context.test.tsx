import React from "react";
import { renderHook, act } from "@testing-library/react";
import {
  PlaybackProvider,
  usePlayback,
} from "../../components/editor/version-7.0.0/contexts/playback-context";

const makeFakePlayer = () => {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  return {
    addEventListener: jest.fn((name: string, cb: (e: any) => void) => {
      (listeners[name] ||= []).push(cb);
    }),
    removeEventListener: jest.fn((name: string, cb: (e: any) => void) => {
      listeners[name] = (listeners[name] || []).filter((l) => l !== cb);
    }),
    emit: (name: string, e?: any) => (listeners[name] || []).forEach((l) => l(e)),
    listeners,
  };
};

describe("PlaybackProvider", () => {
  it("mirrors Player frameupdate/play/pause/ended events", () => {
    const player = makeFakePlayer();
    const playerRef = { current: player } as any;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlaybackProvider playerRef={playerRef}>{children}</PlaybackProvider>
    );
    const { result, unmount } = renderHook(() => usePlayback(), { wrapper });

    expect(result.current).toEqual({ currentFrame: 0, isPlaying: false });

    act(() => player.emit("play"));
    act(() => player.emit("frameupdate", { detail: { frame: 42 } }));
    expect(result.current).toEqual({ currentFrame: 42, isPlaying: true });

    act(() => player.emit("ended"));
    expect(result.current.isPlaying).toBe(false);

    unmount();
    expect(Object.values(player.listeners).flat()).toHaveLength(0);
  });
});
