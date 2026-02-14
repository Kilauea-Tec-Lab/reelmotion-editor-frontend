import { registerRoot } from "remotion";
import React from "react";
import { Composition } from "remotion";
import {
  FPS,
  COMP_NAME,
  DURATION_IN_FRAMES,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
} from "../constants";
import { Main, MainProps } from "./main";

// Default props for the Main component
const defaultProps: MainProps = {
  overlays: [],
  setSelectedOverlayId: () => {},
  selectedOverlayId: null,
  changeOverlay: () => {},
  durationInFrames: DURATION_IN_FRAMES,
  fps: FPS,
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT,
};

// Define the root component directly in this file
const Root: React.FC = () => {
  return (
    <>
      <Composition
        id={COMP_NAME}
        component={Main}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        /**
         * Dynamically calculates video metadata from inputProps.
         * This allows the export resolution to be overridden
         * (e.g., 1080p, 4K) instead of being stuck at the default 1280x720.
         */
        calculateMetadata={async ({ props }) => {
          return {
            durationInFrames: props.durationInFrames,
            width: props.width,
            height: props.height,
          };
        }}
        defaultProps={defaultProps}
      />
    </>
  );
};

// Register the root component with Remotion
registerRoot(Root);
