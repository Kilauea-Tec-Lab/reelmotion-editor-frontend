/* Debug script: figure out what JSON object google-gax's google-auth-library receives. */

process.env.GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "gcp-credentials.json";
process.env.GOOGLE_CLOUD_PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCP_PROJECT_ID ||
  "deft-processor-465219-e0";

const jwtPath = require.resolve(
  "google-gax/node_modules/google-auth-library/build/src/auth/jwtclient.js"
);
const jwtMod = require(jwtPath);
const JWT = jwtMod.JWT;

const originalFromJSON = JWT.prototype.fromJSON;
JWT.prototype.fromJSON = function patchedFromJSON(json) {
  const keys = json && typeof json === "object" ? Object.keys(json) : null;
  if (json && typeof json === "object") {
  }
  return originalFromJSON.call(this, json);
};

(async () => {
  const { testPermissions } = require("@remotion/cloudrun");
  await testPermissions({
    region: process.env.GCP_REGION || "us-central1",
    projectID: process.env.GOOGLE_CLOUD_PROJECT,
  });
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
