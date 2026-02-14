import { RenderRequest } from "@/components/editor/version-7.0.0/types";
import { executeApi } from "@/components/editor/version-7.0.0/ssr-helpers/api-response";
import { startRendering, warmupBundle } from "@/components/editor/version-7.0.0/ssr-helpers/custom-renderer";

// ⚡ Pre-warm the bundle cache on module load
// This happens when the server starts, so first render is fast
warmupBundle().catch(console.error);

/**
 * POST endpoint handler for rendering media using Remotion SSR
 */
export const POST = executeApi(RenderRequest, async (req, body) => {
  console.log("Received body:", JSON.stringify(body, null, 2));
  console.log("inputProps:", JSON.stringify(body.inputProps, null, 2));

  try {
    // Start the rendering process using our custom renderer
    const renderId = await startRendering(body.id, body.inputProps, body.renderScale);

    return { renderId };
  } catch (error) {
    console.error("Error in renderMedia:", error);
    throw error;
  }
});
