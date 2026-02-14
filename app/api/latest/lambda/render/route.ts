import { AwsRegion, RenderMediaOnLambdaOutput } from "@remotion/lambda/client";
import { renderMediaOnLambda } from "@remotion/lambda/client";
import { RenderRequest } from "@/components/editor/version-7.0.0/types";
import { executeApi } from "@/components/editor/version-7.0.0/lambda-helpers/api-response";

import {
  LAMBDA_FUNCTION_NAME,
  REGION,
  SITE_NAME,
} from "@/components/editor/version-7.0.0/constants";

/**
 * Configuration for the Lambda render function
 * ⚡ MAXIMUM SPEED OPTIMIZATIONS:
 * - x264Preset "ultrafast": Fastest possible encoding
 * - CRF 28: Fast encoding with acceptable quality
 * - imageFormat "jpeg": Faster frame capture than PNG
 * - jpegQuality 80: Good enough quality
 */
const LAMBDA_CONFIG = {
  FUNCTION_NAME: LAMBDA_FUNCTION_NAME,
  FRAMES_PER_LAMBDA: 100,
  MAX_RETRIES: 2,
  CODEC: "h264" as const,
  // ⚡ MAXIMUM speed settings
  CRF: 28, // Fast (18-28 range, 28 is fastest)
  X264_PRESET: "ultrafast" as const, // Fastest possible
  IMAGE_FORMAT: "jpeg" as const, // Faster than PNG
  JPEG_QUALITY: 80, // Good enough
} as const;

/**
 * Validates AWS credentials are present in environment variables
 * @throws {TypeError} If AWS credentials are missing
 */
const validateAwsCredentials = () => {
  console.log("Validating AWS credentials....");
  if (
    !process.env.AWS_ACCESS_KEY_ID &&
    !process.env.REMOTION_AWS_ACCESS_KEY_ID
  ) {
    throw new TypeError(
      "Set up Remotion Lambda to render videos. See the README.md for how to do so."
    );
  }
  if (
    !process.env.AWS_SECRET_ACCESS_KEY &&
    !process.env.REMOTION_AWS_SECRET_ACCESS_KEY
  ) {
    throw new TypeError(
      "The environment variable REMOTION_AWS_SECRET_ACCESS_KEY is missing. Add it to your .env file."
    );
  }
};

/**
 * POST endpoint handler for rendering media using Remotion Lambda
 * @description Handles video rendering requests by delegating to AWS Lambda
 * @throws {Error} If rendering fails or AWS credentials are invalid
 */
export const POST = executeApi<RenderMediaOnLambdaOutput, typeof RenderRequest>(
  RenderRequest,
  async (req, body) => {
    // Debug logging
    // console.log("Received body:", JSON.stringify(body, null, 2));
    // console.log("inputProps:", JSON.stringify(body.inputProps, null, 2));

    // Validate AWS credentials
    validateAwsCredentials();

    try {
      console.log("Rendering media on Lambda....");
      // Use Remotion's scale parameter for resolution upscaling
      const renderScale = body.renderScale && body.renderScale > 0 ? body.renderScale : undefined;

      const result = await renderMediaOnLambda({
        codec: LAMBDA_CONFIG.CODEC,
        functionName: LAMBDA_CONFIG.FUNCTION_NAME,
        region: REGION as AwsRegion,
        serveUrl: SITE_NAME,
        composition: body.id,
        inputProps: body.inputProps,
        framesPerLambda: LAMBDA_CONFIG.FRAMES_PER_LAMBDA,
        downloadBehavior: {
          type: "download",
          fileName: "video.mp4",
        },
        maxRetries: LAMBDA_CONFIG.MAX_RETRIES,
        everyNthFrame: 1,
        // ⚡ SPEED OPTIMIZATIONS
        crf: LAMBDA_CONFIG.CRF,
        x264Preset: LAMBDA_CONFIG.X264_PRESET,
        imageFormat: LAMBDA_CONFIG.IMAGE_FORMAT,
        jpegQuality: LAMBDA_CONFIG.JPEG_QUALITY,
        // Resolution upscaling via Remotion's built-in scale
        ...(renderScale ? { scale: renderScale } : {}),
      });

      console.log("Render result:", JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error("Error in renderMediaOnLambda:", error);
      throw error;
    }
  }
);
