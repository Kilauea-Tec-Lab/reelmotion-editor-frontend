import { deployService, deploySite } from "@remotion/cloudrun";
import { readFileSync } from "fs";
import path from "path";

// Load credentials
const credsPath = path.resolve("gcp-credentials.json");
console.log(`Reading credentials from: ${credsPath}`);

const creds = JSON.parse(readFileSync(credsPath, "utf-8"));

// Set environment variables for Remotion/Google Auth
process.env.REMOTION_GCP_PROJECT_ID = creds.project_id;
process.env.REMOTION_GCP_CLIENT_EMAIL = creds.client_email;
process.env.REMOTION_GCP_PRIVATE_KEY = creds.private_key;

// Also for standard google libraries
process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;

const SITE_NAME = "reelmotion-editor";
const REGION = "us-central1";

console.log("🚀 Starting Cloud Run deployment (Optimized)...");
console.log(`Region: ${REGION}`);
console.log(`Project: ${creds.project_id}`);
console.log(`Config: 8Gi RAM, 4 vCPU, 900s Timeout`);

try {
  // 1. Deploy Service
  console.log("\n📦 Deploying Cloud Run Service...");
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
  console.log(`✅ Service deployed: ${serviceResult.shortName}`);

  // 2. Deploy Site
  console.log("\n🌐 Deploying Remotion Site (React Bundle)...");

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
      onBundleProgress: (progress) => {
        console.log(`Bundling: ${progress}%`);
      },
      onUploadProgress: (progress) => {
        console.log(`Uploading: ${progress.percent}%`);
      },
    },
  });
  console.log(`✅ Site deployed: ${siteResult.serveUrl}`);

  console.log("\n------------------------------------------");
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("------------------------------------------");
  console.log("Service Name:", serviceResult.shortName);
  console.log("Serve URL:", siteResult.serveUrl);
  console.log("------------------------------------------");

  console.log(
    "\n⚠️  IMPORTANT: Update your .env.local file with these values:",
  );
  console.log(`REMOTION_GCP_SERVICE_NAME=${serviceResult.shortName}`);
  console.log(`REMOTION_GCP_SERVE_URL=${siteResult.serveUrl}`);
  console.log(`REMOTION_GCP_REGION=${REGION}`);
} catch (err) {
  console.error("❌ Deployment failed:");
  console.error(err);
  process.exit(1);
}
