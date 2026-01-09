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
      
      // Cloud Run renders synchronously and returns the result directly
      if (renderType === "cloudrun") {
        setState({
          status: "rendering",
          progress: 0.05,
          renderId: "pending",
        });
        
        const response = await renderVideo({ id, inputProps });
        console.log("Cloud Run response:", response);
        
        // Check if response indicates an error
        if ('type' in response && response.type === "error") {
          const errorResponse = response as { type: "error"; message: string; renderId: string };
          setState({
            status: "error",
            renderId: errorResponse.renderId,
            error: new Error(errorResponse.message),
          });
          return;
        }
        
        // Check if response indicates completion
        if ('type' in response && response.type === "done") {
          const doneResponse = response as { type: "done"; renderId: string; url: string; size: number };
          setState({
            size: doneResponse.size,
            url: doneResponse.url,
            status: "done",
          });
          return;
        }
        
        // Fallback: treat as done if url exists
        if ('url' in response && response.url) {
          setState({
            size: (response as any).size || 0,
            url: (response as any).url,
            status: "done",
          });
          return;
        }
        
        // Unknown response format
        throw new Error("Unexpected response format from Cloud Run render");
      }

      // For SSR and Lambda, continue with polling approach
      const response = await renderVideo({ id, inputProps });
      const renderId = response.renderId;
      const bucketName =
        "bucketName" in response ? response.bucketName : undefined;

      if (renderType === "ssr") {
        // Add a small delay for SSR rendering to ensure initialization
        await wait(3000);
      }

      setState({
        status: "rendering",
        progress: 0,
        renderId,
        bucketName: typeof bucketName === "string" ? bucketName : undefined,
      });

      let pending = true;

      // Configure polling based on render type
      // Lambda uses longer intervals since it polls GCS
      const basePollingIntervalMs = renderType === "lambda" ? 2500 : 1000;
      const initialThrottleBackoffMs = renderType === "lambda" ? 4000 : 2000;
      let throttleBackoffMs = initialThrottleBackoffMs;
      const maxThrottleBackoffMs = 15000;

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
