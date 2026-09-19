import { RenderRequest } from "@/components/editor/version-7.0.0/types";
import { executeApi } from "@/components/editor/version-7.0.0/ssr-helpers/api-response";
import { startRendering, warmupBundle } from "@/components/editor/version-7.0.0/ssr-helpers/custom-renderer";
import { chargeExport } from "@/components/editor/version-7.0.0/ssr-helpers/export-billing";

// ⚡ Pre-warm the bundle cache on module load
// This happens when the server starts, so first render is fast
warmupBundle().catch(console.error);

/**
 * POST endpoint handler for rendering media using Remotion SSR.
 * Every export is paid: the token charge happens here, server-side, before the
 * render starts; a failed render refunds it (see startRendering).
 */
export const POST = executeApi(RenderRequest, async (req, body, auth) => {
  if (!body.resolution) throw new Error("resolution is required");

  const charge = await chargeExport(auth.authHeader, auth.userId, body.resolution);

  try {
    const renderId = await startRendering(body.id, body.inputProps, body.renderScale, charge);
    return { renderId };
  } catch (error) {
    console.error("Error in renderMedia:", error);
    throw error;
  }
});
