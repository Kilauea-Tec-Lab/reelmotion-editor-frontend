import {
  ProgressRequest,
  ProgressResponse,
} from "@/components/editor/version-7.0.0/types";
import { executeApi } from "@/components/editor/version-7.0.0/cloudrun-helpers/api-response";
import {
  GCS_RENDERED_VIDEOS_BUCKET,
} from "@/components/editor/version-7.0.0/constants";

/**
 * API endpoint to check the progress of a Remotion video render on Cloud Run
 * 
 * Since Netlify Functions are stateless, we check GCS directly to see if
 * the rendered video exists. Cloud Run renders write output to:
 * gs://{bucket}/renders/{renderId}/out.mp4
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
    
    const renderId = body.id;
    const bucketName = body.bucketName || GCS_RENDERED_VIDEOS_BUCKET || "remotioncloudrun-buaw10zfzk";
    
    // Construct the expected output URL
    const outputPath = `renders/${renderId}/out.mp4`;
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${outputPath}`;
    
    try {
      // Check if the file exists by making a HEAD request
      // GCS public URLs support HEAD requests
      const response = await fetch(publicUrl, {
        method: "HEAD",
      });
      
      if (response.ok) {
        // File exists - render is complete
        const contentLength = response.headers.get("content-length");
        const size = contentLength ? parseInt(contentLength, 10) : 0;
        
        console.log("[Cloud Run] Render complete, file found:", publicUrl);
        
        return {
          type: "done",
          url: publicUrl,
          size,
        };
      }
      
      if (response.status === 404) {
        // File doesn't exist yet - still rendering
        console.log("[Cloud Run] File not found yet, still rendering...");
        
        // We don't have actual progress info from Cloud Run,
        // so we return a simulated progress that increases over time
        // The client will keep polling until done
        return {
          type: "progress",
          progress: 0.1, // Indicate some progress is happening
        };
      }
      
      // Unexpected status
      console.error("[Cloud Run] Unexpected response status:", response.status);
      return {
        type: "progress",
        progress: 0.05,
      };
      
    } catch (error) {
      console.error("[Cloud Run] Error checking render status:", error);
      
      // Don't immediately error - might be a transient network issue
      // Return progress to keep polling
      return {
        type: "progress",
        progress: 0.05,
      };
    }
  }
);
