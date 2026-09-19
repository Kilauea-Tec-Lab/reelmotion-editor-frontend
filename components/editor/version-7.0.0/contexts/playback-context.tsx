"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { PlayerRef } from "@remotion/player";

interface PlaybackState {
  currentFrame: number;
  isPlaying: boolean;
}

const PlaybackContext = createContext<PlaybackState>({
  currentFrame: 0,
  isPlaying: false,
});

/**
 * Holds the only two values that change on every frame. Kept in a separate,
 * tiny context so that the rest of the editor (EditorContext consumers) does
 * not re-render 30x/s during playback. State is driven by the Remotion
 * Player's own events, so it can never drift from the real player state.
 */
export const PlaybackProvider: React.FC<{
  playerRef: React.RefObject<PlayerRef>;
  children: React.ReactNode;
}> = ({ playerRef, children }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const onFrame = (e: { detail: { frame: number } }) =>
      setCurrentFrame(e.detail.frame);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    // The <Player> can mount later than this provider (LocalMediaProvider
    // holds its children until IndexedDB is restored), so poll the ref
    // until it exists instead of assuming child effects already ran.
    let raf = 0;
    let detach: (() => void) | undefined;
    const attach = () => {
      const player = playerRef.current;
      if (!player) {
        raf = requestAnimationFrame(attach);
        return;
      }
      player.addEventListener("frameupdate", onFrame);
      player.addEventListener("play", onPlay);
      player.addEventListener("pause", onPause);
      player.addEventListener("ended", onPause);
      detach = () => {
        player.removeEventListener("frameupdate", onFrame);
        player.removeEventListener("play", onPlay);
        player.removeEventListener("pause", onPause);
        player.removeEventListener("ended", onPause);
      };
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      detach?.();
    };
  }, [playerRef]);

  return (
    <PlaybackContext.Provider value={{ currentFrame, isPlaying }}>
      {children}
    </PlaybackContext.Provider>
  );
};

export const usePlayback = () => useContext(PlaybackContext);
