import {
  deployFunction,
  deploySite,
  getOrCreateBucket,
} from "@remotion/lambda";
import dotenv from "dotenv";
import path from "path";
import { RAM, REGION, SITE_NAME, TIMEOUT, DISK } from "./config.mjs";

/**
 * This script deploys the Remotion video rendering infrastructure to AWS Lambda.
 * It sets up three main components:
 * 1. Lambda Function - For serverless video rendering
 * 2. S3 Bucket - For storing rendered videos and assets
 * 3. Remotion Site - The video template that will be rendered
 */

dotenv.config();

if (!process.env.AWS_ACCESS_KEY_ID && !process.env.REMOTION_AWS_ACCESS_KEY_ID) {
  process.exit(0);
}
if (
  !process.env.AWS_SECRET_ACCESS_KEY &&
  !process.env.REMOTION_AWS_SECRET_ACCESS_KEY
) {
  process.exit(0);
}

process.stdout.write("Deploying Lambda function... ");

const { functionName, alreadyExisted: functionAlreadyExisted } =
  await deployFunction({
    createCloudWatchLogGroup: true,
    memorySizeInMb: RAM,
    region: REGION,
    timeoutInSeconds: TIMEOUT,
    diskSizeInMb: DISK,
  });

process.stdout.write("Ensuring bucket... ");
const { bucketName, alreadyExisted: bucketAlreadyExisted } =
  await getOrCreateBucket({
    region: REGION,
  });

process.stdout.write("Deploying site... ");
const { siteName } = await deploySite({
  bucketName,
  entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
  siteName: SITE_NAME,
  region: REGION,
});



/**
 * After running this script:
 * - A Lambda function will be created/updated for rendering videos
 * - An S3 bucket will be created/verified for storage
 * - The Remotion site (video template) will be deployed
 *
 * The script should be re-run when:
 * 1. The video template code is modified
 * 2. Configuration in config.mjs changes
 * 3. Remotion is upgraded to a new version
 */
