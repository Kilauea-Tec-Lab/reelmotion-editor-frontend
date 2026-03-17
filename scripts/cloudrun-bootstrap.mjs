import fs from "fs";
import path from "path";
import {
  deployService,
  deploySite,
  getOrCreateBucket,
  testPermissions,
} from "@remotion/cloudrun";

const loadServiceAccountJson = () => {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(process.cwd(), "gcp-credentials.json"),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) {
        continue;
      }
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  return null;
};

const ensureRemotionEnvFromCredentials = () => {
  if (
    process.env.REMOTION_GCP_CLIENT_EMAIL &&
    process.env.REMOTION_GCP_PRIVATE_KEY &&
    process.env.REMOTION_GCP_PROJECT_ID
  ) {
    return;
  }

  const creds = loadServiceAccountJson();
  if (!creds) {
    throw new Error(
      "Could not load service account JSON. Set GOOGLE_APPLICATION_CREDENTIALS or add gcp-credentials.json in the repo root.",
    );
  }

  if (!creds.client_email || !creds.private_key) {
    throw new Error(
      "Service account JSON is missing client_email/private_key. Ensure it is a service account key (type: service_account).",
    );
  }

  process.env.REMOTION_GCP_CLIENT_EMAIL = String(creds.client_email);
  process.env.REMOTION_GCP_PRIVATE_KEY = String(creds.private_key).replace(
    /\\n/g,
    "\n",
  );
  process.env.REMOTION_GCP_PROJECT_ID =
    process.env.REMOTION_GCP_PROJECT_ID ??
    String(
      creds.project_id ??
        process.env.GCP_PROJECT_ID ??
        process.env.GOOGLE_CLOUD_PROJECT ??
        "",
    );

  if (!process.env.REMOTION_GCP_PROJECT_ID) {
    throw new Error(
      "Could not determine project ID (REMOTION_GCP_PROJECT_ID).",
    );
  }
};

ensureRemotionEnvFromCredentials();

const projectID = process.env.REMOTION_GCP_PROJECT_ID;

const region =
  process.env.REMOTION_GCP_REGION ?? process.env.GOOGLE_REGION ?? "us-central1";

const entryPoint = path.resolve(
  process.cwd(),
  "components/editor/version-7.0.0/remotion/index.ts",
);

const siteName = process.env.REMOTION_SITE_NAME ?? "reelmotion-editor";

const skipPermissionsTest = process.argv.includes("--skip-permissions");

const main = async () => {

  if (skipPermissionsTest) {
  } else {
    try {
      const { results } = await testPermissions({
        onTest: (r) => {
          if (!r.decision) {
          }
        },
      });
      const missing = results.filter((r) => !r.decision);
      if (missing.length) {
        console.warn(
          `[cloudrun-bootstrap] ⚠️  Missing ${missing.length} permissions. Proceeding anyway...`,
        );
      } else {
      }
    } catch (err) {
      console.warn(
        "[cloudrun-bootstrap] ⚠️  Permissions test failed:",
        err.message,
      );
      console.warn("[cloudrun-bootstrap] Proceeding anyway...");
    }
  }

  const { bucketName } = await getOrCreateBucket({
    region,
  });

  const service = await deployService({
    projectID,
    region,
    memoryLimit: "8Gi", // Máximo que permite tu quota con 2 instancias
    cpuLimit: "4.0", // Máximo que permite tu quota con 2 instancias
    timeoutSeconds: 1200, // 20 minutos
    minInstances: 0,
    maxInstances: 2, // Máximo permitido por tu quota (20 vCPUs / 4 = 5, pero con 8GB solo permite 2)
  });

  const site = await deploySite({
    entryPoint,
    bucketName,
    siteName,
    options: {
      onUploadProgress: ({ totalFiles, filesUploaded }) => {},
    },
  });

};

main().catch((err) => {
  console.error("[cloudrun-bootstrap] ERROR:", err?.message ?? err);
  process.exit(1);
});
