import { useRef, useCallback } from "react";
import { PlayerRef } from "@remotion/player";
import { FPS } from "../constants";

/**
 * Player controls. Frame/playing state lives in PlaybackContext (driven by
 * Player events) so nothing here re-renders on every frame.
 */
export const useVideoPlayer = () => {
  const playerRef = useRef<PlayerRef>(null);

  const play = useCallback(() => {
    playerRef.current?.play();
  }, []);

  const togglePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) player.pause();
    else player.play();
  }, []);

  /** Read the playhead without subscribing to per-frame updates. */
  const getCurrentFrame = useCallback(
    () => playerRef.current?.getCurrentFrame() ?? 0,
    []
  );

  const formatTime = useCallback((frames: number) => {
    const totalSeconds = frames / FPS;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const frames2Digits = Math.floor(frames % FPS)
      .toString()
      .padStart(2, "0");

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${frames2Digits}`;
  }, []);

  const seekTo = useCallback((frame: number) => {
    playerRef.current?.seekTo(frame);
  }, []);

  return {
    playerRef,
    togglePlayPause,
    getCurrentFrame,
    formatTime,
    play,
    seekTo,
  };
};
