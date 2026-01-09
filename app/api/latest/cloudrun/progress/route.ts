import {
  ProgressRequest,
  ProgressResponse,
} from "@/components/editor/version-7.0.0/types";
import { executeApi } from "@/components/editor/version-7.0.0/cloudrun-helpers/api-response";
import { renderProgressStore } from "../render/progress-store";

/**
 * API endpoint to check the progress of a Remotion video render on Cloud Run
 *
 * @route POST /api/latest/cloudrun/progress
 * @returns {ProgressResponse} The current status of the render
 *   - type: 'error' - If a fatal error occurred during rendering
 *   - type: 'done' - If rendering is complete, includes output URL and file size
 *   - type: 'progress' - If rendering is in progress, includes completion percentage
 */
export const POST = executeApi<ProgressResponse, typeof ProgressRequest>(
  ProgressRequest,
  async (req, body) => {
    console.log("[Cloud Run] Progress request", { body });
    
    const renderState = renderProgressStore.get(body.id);

    if (!renderState) {
      return {
        type: "error",
        message: `No render found with ID: ${body.id}`,
      };
    }

    if (renderState.status === "error") {
      return {
        type: "error",
        message: renderState.error || "Unknown error occurred",
      };
    }

    if (renderState.status === "done") {
      return {
        type: "done",
        url: renderState.url as string,
        size: renderState.size as number,
      };
    }

    // Status is pending or rendering
    return {
      type: "progress",
      progress: Math.max(0.03, renderState.progress),
    };
  }
);
