import { deployService, deploySite } from "@remotion/cloudrun";
import { readFileSync } from "fs";
import path from "path";

// Load credentials
const credsPath = path.resolve("gcp-credentials.json");

const creds = JSON.parse(readFileSync(credsPath, "utf-8"));

// Set environment variables for Remotion/Google Auth
process.env.REMOTION_GCP_PROJECT_ID = creds.project_id;
process.env.REMOTION_GCP_CLIENT_EMAIL = creds.client_email;
process.env.REMOTION_GCP_PRIVATE_KEY = creds.private_key;

// Also for standard google libraries
process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;

const SITE_NAME = "reelmotion-editor";
const REGION = "us-central1";


try {
  // 1. Deploy Service
  const serviceResult = await deployService({
    region: REGION,
    projectID: creds.project_id,
    memoryLimit: "8Gi",
    cpuLimit: "4",
    timeoutSeconds: 900,
    minInstances: 0,
    maxInstances: 5,
    onlyAllocateCpuDuringRequestProcessing: true,
  });

  // 2. Deploy Site

  // Use the bucket from env or fallback to the one seen in logs
  const bucketName =
    process.env.GCS_RENDERED_VIDEOS_BUCKET || "remotioncloudrun-buaw10zfzk";

  const siteEntry = path.resolve(
    "components/editor/version-7.0.0/remotion/index.ts",
  );
  const siteResult = await deploySite({
    entryPoint: siteEntry,
    siteName: SITE_NAME,
    region: REGION,
    projectID: creds.project_id,
    bucketName: bucketName, // Explicitly provide bucket name
    options: {
      onBundleProgress: (progress) => {},
      onUploadProgress: (progress) => {},
    },
  });


} catch (err) {
  console.error("❌ Deployment failed:");
  console.error(err);
  process.exit(1);
}
