import { z } from "zod";
import { useCallback, useMemo, useState } from "react";
import { CompositionProps } from "../types";
import {
  getProgress as ssrGetProgress,
  renderVideo as ssrRenderVideo,
} from "../ssr-helpers/api";
import {
  getProgress as lambdaGetProgress,
  renderVideo as lambdaRenderVideo,
} from "../lambda-helpers/api";
import {
  getProgress as cloudrunGetProgress,
  renderVideo as cloudrunRenderVideo,
} from "../cloudrun-helpers/api";

// Define possible states for the rendering process
export type State =
  | { status: "init" } // Initial state
  | { status: "invoking" } // API call is being made
  | {
      // Video is being rendered
      renderId: string;
      progress: number;
      status: "rendering";
      bucketName?: string; // Make bucketName optional
    }
  | {
      // Error occurred during rendering
      renderId: string | null;
      status: "error";
      error: Error;
    }
  | {
      // Rendering completed successfully
      url: string;
      size: number;
      status: "done";
    };

// Utility function to create a delay
const wait = async (milliSeconds: number) => {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, milliSeconds);
  });
};

type RenderType = "ssr" | "lambda" | "cloudrun";

const isRateLimitError = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  return (
    lower.includes("rate exceeded") ||
    lower.includes("too many requests") ||
    lower.includes("throttl")
  );
};

// Custom hook to manage video rendering process
export const useRendering = (
  id: string,
  inputProps: z.infer<typeof CompositionProps>,
  renderType: RenderType = "ssr" // Default to SSR rendering
) => {
  // Maintain current state of the rendering process
  const [state, setState] = useState<State>({
    status: "init",
  });

  // Main function to handle the rendering process
  const renderMedia = useCallback(async () => {
    console.log(`Starting renderMedia process using ${renderType}`);
    setState({
      status: "invoking",
    });
    try {
      // Select the appropriate API functions based on render type
      const renderVideo =
        renderType === "ssr"
          ? ssrRenderVideo
          : renderType === "lambda"
          ? lambdaRenderVideo
          : cloudrunRenderVideo;
      const getProgress =
        renderType === "ssr"
          ? ssrGetProgress
          : renderType === "lambda"
          ? lambdaGetProgress
          : cloudrunGetProgress;

      console.log("Calling renderVideo API with inputProps", inputProps);
      
      // Start the render (all render types now return a renderId for polling)
      const response = await renderVideo({ id, inputProps });
      console.log("Render response:", response);
      
      // Check if immediate error
      if ('type' in response && response.type === "error") {
        const errorResponse = response as { type: "error"; message: string; renderId?: string };
        setState({
          status: "error",
          renderId: errorResponse.renderId || null,
          error: new Error(errorResponse.message),
        });
        return;
      }
      
      // Check if immediate completion (unlikely but possible for cached renders)
      if ('type' in response && response.type === "done") {
        const doneResponse = response as { type: "done"; renderId?: string; url: string; size: number };
        setState({
          size: doneResponse.size,
          url: doneResponse.url,
          status: "done",
        });
        return;
      }

      // Extract renderId for polling
      const renderId = response.renderId;
      const bucketName =
        "bucketName" in response ? response.bucketName : undefined;

      if (renderType === "ssr") {
        // Add a small delay for SSR rendering to ensure initialization
        await wait(3000);
      } else if (renderType === "cloudrun") {
        // Cloud Run starts faster, only wait 1 second before first poll
        await wait(1000);
      }

      setState({
        status: "rendering",
        progress: -1, // -1 indicates indeterminate progress (Cloud Run doesn't report progress)
        renderId,
        bucketName: typeof bucketName === "string" ? bucketName : undefined,
      });

      let pending = true;

      // Configure polling based on render type
      // OPTIMIZED: Cloud Run uses faster polling since renders are now quicker
      // SSR: 1s interval (local, very fast)
      // Lambda: 2.5s interval (AWS, moderate)
      // CloudRun: 2s interval (GCP, optimized for speed)
      const basePollingIntervalMs = 
        renderType === "ssr" ? 1000 : 
        renderType === "cloudrun" ? 2000 : 
        2500;
      const initialThrottleBackoffMs = renderType === "ssr" ? 2000 : 3000;
      let throttleBackoffMs = initialThrottleBackoffMs;
      const maxThrottleBackoffMs = 10000; // Reduced from 15s for faster recovery

      while (pending) {
        console.log(`Checking progress for renderId=${renderId}`);
        let result: Awaited<ReturnType<typeof getProgress>>;

        try {
          result = await getProgress({
            id: renderId,
            bucketName: typeof bucketName === "string" ? bucketName : "",
          });
          throttleBackoffMs = initialThrottleBackoffMs;
        } catch (err) {
          if (isRateLimitError(err)) {
            console.warn(
              `Progress check throttled (Rate Exceeded). Retrying in ${throttleBackoffMs}ms`,
              err
            );
            await wait(throttleBackoffMs);
            throttleBackoffMs = Math.min(
              Math.round(throttleBackoffMs * 1.8),
              maxThrottleBackoffMs
            );
            continue;
          }

          throw err;
        }
        console.log("result", result);
        switch (result.type) {
          case "error": {
            console.error(`Render error: ${result.message}`);
            setState({
              status: "error",
              renderId: renderId,
              error: new Error(result.message),
            });
            pending = false;
            break;
          }
          case "done": {
            console.log(
              `Render complete: url=${result.url}, size=${result.size}`
            );
            setState({
              size: result.size,
              url: result.url,
              status: "done",
            });
            pending = false;
            break;
          }
          case "progress": {
            console.log(`Render progress: ${result.progress}%`);
            setState({
              status: "rendering",
              progress: result.progress,
              renderId: renderId,
            });
            await wait(basePollingIntervalMs);
          }
        }
      }
    } catch (err) {
      console.error("Unexpected error during rendering:", err);
      setState({
        status: "error",
        error: err as Error,
        renderId: null,
      });
    }
  }, [id, inputProps, renderType]);

  // Reset the rendering state back to initial
  const undo = useCallback(() => {
    setState({ status: "init" });
  }, []);

  // Return memoized values to prevent unnecessary re-renders
  return useMemo(
    () => ({
      renderMedia, // Function to start rendering
      state, // Current state of the render
      undo, // Function to reset the state
    }),
    [renderMedia, state, undo]
  );
};
