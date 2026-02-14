import { z } from "zod";
import {
  RenderRequest,
  ProgressRequest,
  ProgressResponse,
} from "@/components/editor/version-7.0.0/types";
import { CompositionProps } from "@/components/editor/version-7.0.0/types";

type ApiResponse<T> = {
  type: "success" | "error";
  data?: T;
  message?: string;
};

/**
 * Makes a POST request to the specified endpoint
 * @param endpoint API endpoint URL
 * @param body Request body
 * @returns Response data
 */
const makeRequest = async <Res>(
  endpoint: string,
  body: unknown
): Promise<Res> => {
  console.log(`[Cloud Run] Making request to ${endpoint}`, { body });
  const result = await fetch(endpoint, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
  const json = (await result.json()) as ApiResponse<Res>;
  console.log(`[Cloud Run] Response received from ${endpoint}`, { json });
  
  if (json.type === "error") {
    console.error(`[Cloud Run] Error in response from ${endpoint}:`, json.message);
    throw new Error(json.message);
  }

  if (!json.data) {
    throw new Error(`No data received from ${endpoint}`);
  }

  return json.data;
};

/**
 * Response type for Cloud Run render requests
 * Can be either:
 * - Success: contains url and size when render completes
 * - Error: contains error message
 */
export type CloudRunRenderResponse = 
  | {
      type: "done";
      renderId: string;
      bucketName: string;
      url: string;
      size: number;
    }
  | {
      type: "error";
      renderId: string;
      message: string;
    };

/**
 * Initiates a video render using Google Cloud Run
 * @param id Composition ID
 * @param inputProps Video composition properties
 * @returns Render ID and bucket name
 */
export const renderVideo = async ({
  id,
  inputProps,
  renderScale,
}: {
  id: string;
  inputProps: z.infer<typeof CompositionProps>;
  renderScale?: number;
}) => {
  console.log("[Cloud Run] Rendering video", { id, inputProps, renderScale });
  const body: z.infer<typeof RenderRequest> = {
    id,
    inputProps,
    renderScale,
  };

  const response = await makeRequest<CloudRunRenderResponse>(
    "/api/latest/cloudrun/render",
    body
  );
  console.log("[Cloud Run] Video render response", { response });
  return response;
};

/**
 * Gets the progress of a video render on Cloud Run
 * @param id Render ID
 * @param bucketName GCS bucket name
 * @returns Current progress status
 */
export const getProgress = async ({
  id,
  bucketName,
}: {
  id: string;
  bucketName: string;
}) => {
  console.log("[Cloud Run] Getting progress", { id, bucketName });
  const body: z.infer<typeof ProgressRequest> = {
    id,
    bucketName,
  };

  const response = await makeRequest<ProgressResponse>(
    "/api/latest/cloudrun/progress",
    body
  );
  console.log("[Cloud Run] Progress response", { response });
  return response;
};
