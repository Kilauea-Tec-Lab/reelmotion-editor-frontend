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
 * ⚡ MAXIMUM SPEED OPTIMIZATIONS:
 * - preset "ultrafast": fastest possible encoding
 * - CRF 30: máxima velocidad con calidad aceptable
 * - concurrency: 24 (máxima utilización de 4 vCPUs + 8GB RAM)
 * - JPEG at 75%: frames ultra rápidos
 * - scale: 0.8 - renderizar a 80% para mayor velocidad
 */
const RENDER_CONFIG = {
  CODEC: "h264" as const,
  CRF: 30, // Higher = faster & smaller file. Range 18-28. 30 = super rápido
  X264_PRESET: "ultrafast" as const, // Fastest possible!
  FRAMES_CONCURRENCY: 24, // Optimizado para 4 vCPUs
  IMAGE_FORMAT: "jpeg" as const,
  JPEG_QUALITY: 75, // Reducir calidad para máxima velocidad
} as const;

/**
 * Validates Google Cloud credentials are present in environment variables
 * Creates a temporary credentials JSON file for Google Cloud SDK
 * @throws {TypeError} If GCP credentials are missing
 */
const validateGcpCredentials = () => {
  console.log("[Cloud Run] Validating GCP credentials...");

  // 1. Check Standard Env Vars
  if (
    process.env.REMOTION_GCP_CLIENT_EMAIL &&
    process.env.REMOTION_GCP_PRIVATE_KEY &&
    process.env.REMOTION_GCP_PROJECT_ID
  ) {
    return;
  }

  // 2. Check NEXT_PUBLIC_ prefixed Env Vars (User Compatibility)
  // Sometimes users prefix everything with NEXT_PUBLIC_ in Netlify/Vercel
  const prefixedClientEmail =
    process.env.NEXT_PUBLIC_REMOTION_GCP_CLIENT_EMAIL ||
    process.env.NEXT_PUBLIC_GCP_CLIENT_EMAIL;
  const prefixedPrivateKey =
    process.env.NEXT_PUBLIC_REMOTION_GCP_PRIVATE_KEY ||
    process.env.NEXT_PUBLIC_GCP_PRIVATE_KEY;

  if (prefixedClientEmail && prefixedPrivateKey) {
    process.env.REMOTION_GCP_CLIENT_EMAIL = prefixedClientEmail;
    process.env.REMOTION_GCP_PRIVATE_KEY = prefixedPrivateKey.replace(
      /\\n/g,
      "\n"
    );
    process.env.REMOTION_GCP_PROJECT_ID =
      process.env.NEXT_PUBLIC_REMOTION_GCP_PROJECT_ID ||
      process.env.NEXT_PUBLIC_GCP_PROJECT_ID ||
      GCP_PROJECT_ID;

    console.log(
      `[Cloud Run] Credentials loaded from NEXT_PUBLIC_ prefixed variables.`
    );
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
    (fromEnvPath ? tryReadJson(fromEnvPath) : null) ??
    tryReadJson(fromRepoPath);

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
      // Create a detailed error message about what was checked
      const checkedVars = [
        "REMOTION_GCP_CLIENT_EMAIL",
        "NEXT_PUBLIC_REMOTION_GCP_CLIENT_EMAIL",
        "NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL",
        "GOOGLE_APPLICATION_CREDENTIALS",
      ];
      console.error(
        "[Cloud Run] Failed to find credentials. Checked:",
        checkedVars
      );
      throw new TypeError(
        "Missing GCP credentials. Please check your environment variables."
      );
    }
    clientEmail = fallbackClientEmail;
    try {
      privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf-8");
    } catch {
      throw new TypeError(
        "Failed to decode NEXT_PUBLIC_GOOGLE_PRIVATE_KEY_BASE64"
      );
    }
    const projectIdMatch = clientEmail.match(
      /@(.*)\.iam\.gserviceaccount\.com/
    );
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
    // Try NEXT_PUBLIC_ version
    const serviceName =
      process.env.NEXT_PUBLIC_REMOTION_GCP_SERVICE_NAME ||
      process.env.NEXT_PUBLIC_GCP_SERVICE_NAME;
    if (serviceName) {
      process.env.REMOTION_GCP_SERVICE_NAME = serviceName;
    } else {
      console.warn(
        "REMOTION_GCP_SERVICE_NAME missing, using default from .env"
      );
    }
  }

  if (!process.env.REMOTION_GCP_SERVE_URL) {
    // Try NEXT_PUBLIC_ version
    const serveUrl =
      process.env.NEXT_PUBLIC_REMOTION_GCP_SERVE_URL ||
      process.env.NEXT_PUBLIC_GCP_SERVE_URL;
    if (serveUrl) {
      process.env.REMOTION_GCP_SERVE_URL = serveUrl;
      console.log(`[Cloud Run] Using Serve URL: ${serveUrl}`);
    } else {
      throw new TypeError(
        "The environment variable REMOTION_GCP_SERVE_URL is missing. Deploy a site first using 'npx remotion cloudrun sites create'. You can also set NEXT_PUBLIC_REMOTION_GCP_SERVE_URL in your environment."
      );
    }
  }
};

/**
 * POST endpoint handler for rendering media using Remotion Cloud Run
 * @description Handles video rendering requests by delegating to Google Cloud Run
 * 
 * IMPORTANT: Due to Netlify's function timeout limits (10-26s), this endpoint
 * initiates the render and returns immediately. The actual rendering happens
 * asynchronously in Cloud Run. The client should poll /progress to check status.
 * 
 * The render is started using a "fire and forget" pattern - we don't await
 * the result. Cloud Run will continue processing even after we respond.
 * 
 * @throws {Error} If GCP credentials are invalid or missing
 */
export const POST = executeApi(RenderRequest, async (req, body) => {
  console.log("[Cloud Run] Received render request:", JSON.stringify(body, null, 2));

  // Validate GCP credentials first (this can throw)
  validateGcpCredentials();

  // Generate a render ID for tracking
  const renderId = uuidv4();
  const bucketName = GCS_RENDERED_VIDEOS_BUCKET || "remotion-cloudrun-renders";

  console.log("[Cloud Run] Starting render...");
  console.log("[Cloud Run] Render ID:", renderId);
  console.log("[Cloud Run] Bucket:", bucketName);
  console.log("[Cloud Run] Service:", process.env.REMOTION_GCP_SERVICE_NAME);
  console.log("[Cloud Run] Region:", GCP_REGION);
  console.log("[Cloud Run] Serve URL:", process.env.REMOTION_GCP_SERVE_URL);

  // Start render WITHOUT awaiting - this is the key for Netlify compatibility
  // The promise will be abandoned when the function returns, but Cloud Run
  // will continue processing the request independently
  // 
  // ⚡ MAXIMUM SPEED OPTIMIZATIONS:
  // - concurrency: 16 frames in parallel
  // - x264Preset "ultrafast": fastest encoding
  // - JPEG frames: faster than PNG
  // - CRF 28: fast encoding with acceptable quality
  // Use Remotion's scale parameter for resolution upscaling
  // scale=1 (default) = original resolution, scale=1.5 = 1080p, scale=3 = 4K
  const renderScale = body.renderScale && body.renderScale > 0 ? body.renderScale : undefined;
  console.log("[Cloud Run] Render scale:", renderScale || "1 (default)");

  const renderPromise = renderMediaOnCloudrun({
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
    // ⚡ SPEED SETTINGS - MÁXIMA VELOCIDAD
    concurrency: RENDER_CONFIG.FRAMES_CONCURRENCY,
    imageFormat: RENDER_CONFIG.IMAGE_FORMAT, 
    jpegQuality: RENDER_CONFIG.JPEG_QUALITY,
    // Cache video frames in memory for faster rendering
    offthreadVideoCacheSizeInBytes: 3000000000, // 3GB cache (máximo)
    enforceAudioTrack: false, // No forzar audio si no hay
    // Resolution upscaling via Remotion's built-in scale
    ...(renderScale ? { scale: renderScale } : {}),
  });

  // Log result when it completes (if the function is still running)
  renderPromise
    .then((result) => {
      console.log("[Cloud Run] Render completed:", JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error("[Cloud Run] Render failed:", error);
    });

  // Return immediately with the render ID
  // Client should poll /api/latest/cloudrun/progress for updates
  return {
    type: "progress" as const,
    renderId,
    bucketName,
    message: "Render started. Poll /api/latest/cloudrun/progress for updates.",
  };
});
