import { renderMediaOnCloudrun } from "@remotion/cloudrun/client";
import { RenderRequest } from "@/components/editor/version-7.0.0/types";
import { executeApi } from "@/components/editor/version-7.0.0/cloudrun-helpers/api-response";
import {
  GCP_REGION,
  GCS_RENDERED_VIDEOS_BUCKET,
  GCP_PROJECT_ID,
} from "@/components/editor/version-7.0.0/constants";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Configuration for the Cloud Run render function
 */
const RENDER_CONFIG = {
  CODEC: "h264" as const,
  CRF: 18,
  X264_PRESET: "medium" as const,
} as const;

/**
 * Validates Google Cloud credentials are present in environment variables
 * Creates a temporary credentials JSON file for Google Cloud SDK
 * @throws {TypeError} If GCP credentials are missing
 */
const validateGcpCredentials = () => {
  console.log("[Cloud Run] Validating GCP credentials...");

  if (
    process.env.REMOTION_GCP_CLIENT_EMAIL &&
    process.env.REMOTION_GCP_PRIVATE_KEY &&
    process.env.REMOTION_GCP_PROJECT_ID
  ) {
    return;
  }

  const tryReadJson = (p: string) => {
    try {
      if (!p || !fs.existsSync(p)) {
        return null;
      }
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const fromEnvPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : null;

  const fromRepoPath = path.resolve(process.cwd(), "gcp-credentials.json");

  const creds =
    (fromEnvPath ? tryReadJson(fromEnvPath) : null) ?? tryReadJson(fromRepoPath);

  let projectId = GCP_PROJECT_ID || "reelmotion-ai";
  let clientEmail: string | undefined;
  let privateKey: string | undefined;

  if (creds?.client_email && creds?.private_key) {
    clientEmail = String(creds.client_email);
    privateKey = String(creds.private_key).replace(/\\n/g, "\n");
    if (creds.project_id) {
      projectId = String(creds.project_id);
    }
  } else {
    const fallbackClientEmail = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL;
    const privateKeyBase64 = process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY_BASE64;
    if (!fallbackClientEmail || !privateKeyBase64) {
      throw new TypeError(
        "Missing GCP credentials. Provide gcp-credentials.json / GOOGLE_APPLICATION_CREDENTIALS, or set NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL and NEXT_PUBLIC_GOOGLE_PRIVATE_KEY_BASE64."
      );
    }
    clientEmail = fallbackClientEmail;
    try {
      privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf-8");
    } catch {
      throw new TypeError("Failed to decode NEXT_PUBLIC_GOOGLE_PRIVATE_KEY_BASE64");
    }
    const projectIdMatch = clientEmail.match(/@(.*)\.iam\.gserviceaccount\.com/);
    projectId = projectIdMatch?.[1] || projectId;
  }

  if (!clientEmail || !privateKey) {
    throw new TypeError(
      "Service account credentials are incomplete (client_email/private_key missing)."
    );
  }

  console.log(`[Cloud Run] Using Project ID: ${projectId}`);
  console.log(`[Cloud Run] Using Service Account: ${clientEmail}`);

  // Remotion Cloud Run APIs rely on these env vars when NOT running inside Cloud Tasks.
  process.env.REMOTION_GCP_CLIENT_EMAIL = clientEmail;
  process.env.REMOTION_GCP_PRIVATE_KEY = privateKey;
  process.env.REMOTION_GCP_PROJECT_ID = projectId;

  // Keep these for compatibility with other libs / existing code.
  process.env.GCP_PROJECT_ID = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;

  // For tools that *do* rely on ADC-style credentials files, make sure the env points to something valid.
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credentialsPath = path.join(os.tmpdir(), "gcp-credentials.json");
    const credentials = {
      type: "service_account",
      project_id: projectId,
      private_key_id: "auto-generated",
      private_key: privateKey,
      client_email: clientEmail,
      client_id: "",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
        clientEmail
      )}`,
    };
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    console.log(`[Cloud Run] Credentials file created at: ${credentialsPath}`);
  }

  if (!process.env.REMOTION_GCP_SERVICE_NAME) {
    console.warn("REMOTION_GCP_SERVICE_NAME missing, using default from .env");
  }

  if (!process.env.REMOTION_GCP_SERVE_URL) {
     throw new TypeError(
      "The environment variable REMOTION_GCP_SERVE_URL is missing. Deploy a site first using 'npx remotion cloudrun sites create'."
    );
  }
};

/**
 * POST endpoint handler for rendering media using Remotion Cloud Run
 * @description Handles video rendering requests by delegating to Google Cloud Run
 * @throws {Error} If rendering fails or GCP credentials are invalid
 * 
 * NOTE: This endpoint runs synchronously and waits for the render to complete.
 * Cloud Run has a 30-minute timeout, which is sufficient for most videos.
 * For Netlify deployment, ensure the function timeout is configured appropriately.
 */
export const POST = executeApi(RenderRequest, async (req, body) => {
  console.log("[Cloud Run] Received render request:", JSON.stringify(body, null, 2));

  // Validate GCP credentials
  validateGcpCredentials();

  // Generate a render ID for tracking
  const renderId = uuidv4();
  const bucketName = GCS_RENDERED_VIDEOS_BUCKET || "remotion-cloudrun-renders";

  try {
    console.log("[Cloud Run] Starting render on Cloud Run...");
    console.log("[Cloud Run] Render ID:", renderId);
    console.log("[Cloud Run] Bucket:", bucketName);
    console.log("[Cloud Run] Service:", process.env.REMOTION_GCP_SERVICE_NAME);
    console.log("[Cloud Run] Region:", GCP_REGION);

    // Track progress in memory (for logging purposes only)
    let lastProgress = 0;

    const result = await renderMediaOnCloudrun({
      region: GCP_REGION as any,
      serviceName: process.env.REMOTION_GCP_SERVICE_NAME!,
      serveUrl: process.env.REMOTION_GCP_SERVE_URL!,
      composition: body.id,
      inputProps: body.inputProps,
      codec: RENDER_CONFIG.CODEC,
      crf: RENDER_CONFIG.CRF,
      x264Preset: RENDER_CONFIG.X264_PRESET,
      privacy: "public",
      downloadBehavior: {
        type: "download",
        fileName: "video.mp4",
      },
      forceBucketName: bucketName,
      renderIdOverride: renderId,
      // Track progress updates (for logging)
      updateRenderProgress: (progress: number, error?: boolean) => {
        if (progress - lastProgress >= 0.1 || error) {
          console.log(`[Cloud Run] Progress: ${(progress * 100).toFixed(1)}%${error ? ' (ERROR)' : ''}`);
          lastProgress = progress;
        }
      },
    });

    console.log("[Cloud Run] Render result:", JSON.stringify(result, null, 2));

    if (result.type === "crash") {
      console.error("[Cloud Run] Render crashed:", result.message);
      return {
        type: "error" as const,
        message: result.message || "Render crashed",
        renderId,
      };
    }

    // Render completed successfully
    const publicUrl = result.publicUrl || `https://storage.googleapis.com/${result.bucketName}/renders/${renderId}/out.mp4`;
    console.log("[Cloud Run] Render completed successfully:", publicUrl);
    
    return {
      type: "done" as const,
      renderId,
      bucketName: result.bucketName,
      url: publicUrl,
      size: result.size * 1024, // Convert KB to bytes
    };

  } catch (error) {
    const errorMessage = (error as Error).message || String(error);
    console.error("[Cloud Run] Error in renderMediaOnCloudrun:", errorMessage);
    console.error("[Cloud Run] Full error:", error);
    
    return {
      type: "error" as const,
      message: errorMessage,
      renderId,
    };
  }
});
