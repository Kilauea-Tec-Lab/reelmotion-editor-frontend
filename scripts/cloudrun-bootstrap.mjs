import fs from 'fs';
import path from 'path';
import {deployService, deploySite, getOrCreateBucket, testPermissions} from '@remotion/cloudrun';

const loadServiceAccountJson = () => {
	const candidates = [
		process.env.GOOGLE_APPLICATION_CREDENTIALS,
		path.resolve(process.cwd(), 'gcp-credentials.json'),
	].filter(Boolean);

	for (const p of candidates) {
		try {
			if (!fs.existsSync(p)) {
				continue;
			}
			const raw = fs.readFileSync(p, 'utf-8');
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === 'object') {
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
			'Could not load service account JSON. Set GOOGLE_APPLICATION_CREDENTIALS or add gcp-credentials.json in the repo root.'
		);
	}

	if (!creds.client_email || !creds.private_key) {
		throw new Error(
			'Service account JSON is missing client_email/private_key. Ensure it is a service account key (type: service_account).'
		);
	}

	process.env.REMOTION_GCP_CLIENT_EMAIL = String(creds.client_email);
	process.env.REMOTION_GCP_PRIVATE_KEY = String(creds.private_key).replace(/\\n/g, '\n');
	process.env.REMOTION_GCP_PROJECT_ID =
		process.env.REMOTION_GCP_PROJECT_ID ??
		String(creds.project_id ?? process.env.GCP_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? '');

	if (!process.env.REMOTION_GCP_PROJECT_ID) {
		throw new Error('Could not determine project ID (REMOTION_GCP_PROJECT_ID).');
	}
};

ensureRemotionEnvFromCredentials();

const projectID = process.env.REMOTION_GCP_PROJECT_ID;

const region = process.env.REMOTION_GCP_REGION ?? process.env.GOOGLE_REGION ?? 'us-central1';

const entryPoint = path.resolve(
	process.cwd(),
	'components/editor/version-7.0.0/remotion/index.ts'
);

const siteName = process.env.REMOTION_SITE_NAME ?? 'reelmotion-editor';

const main = async () => {
	console.log('[cloudrun-bootstrap] Project:', projectID);
	console.log('[cloudrun-bootstrap] Region:', region);
	console.log('[cloudrun-bootstrap] Entry point:', entryPoint);

	console.log('[cloudrun-bootstrap] Testing permissions...');
	const {results} = await testPermissions({
		onTest: (r) => {
			if (!r.decision) {
				console.log(`  ❌ ${r.permissionName}`);
			}
		},
	});
	const missing = results.filter((r) => !r.decision);
	if (missing.length) {
		throw new Error(
			`Missing ${missing.length} permissions on the service account. Run 'npx remotion cloudrun permissions' to see the required list.`
		);
	}
	console.log('[cloudrun-bootstrap] ✅ Permissions OK');

	console.log('[cloudrun-bootstrap] Ensuring bucket exists...');
	const {bucketName} = await getOrCreateBucket({
		region,
		updateBucketState: (s) => console.log('  -', s),
	});
	console.log('[cloudrun-bootstrap] Bucket:', bucketName);

	console.log('[cloudrun-bootstrap] Deploying service...');
	const service = await deployService({
		projectID,
		region,
		memoryLimit: '2Gi',
		cpuLimit: '2.0',
		timeoutSeconds: 900,
	});
	console.log('[cloudrun-bootstrap] Service:', service.shortName);
	console.log('[cloudrun-bootstrap] URL:', service.uri);

	console.log('[cloudrun-bootstrap] Deploying site...');
	const site = await deploySite({
		entryPoint,
		bucketName,
		siteName,
		options: {
			onBundleProgress: (p) => console.log(`  - bundle ${p}%`),
			onUploadProgress: ({totalFiles, filesUploaded}) =>
				console.log(`  - upload ${filesUploaded}/${totalFiles}`),
		},
	});
	console.log('[cloudrun-bootstrap] Serve URL:', site.serveUrl);

	console.log('\nPaste these into your .env (server-side):');
	console.log(`GCP_PROJECT_ID=${projectID}`);
	console.log(`REMOTION_GCP_REGION=${region}`);
	console.log(`REMOTION_GCP_SERVICE_NAME=${service.shortName}`);
	console.log(`REMOTION_GCP_SERVE_URL=${site.serveUrl}`);
	console.log(`GCS_RENDERED_VIDEOS_BUCKET=${bucketName}`);
};

main().catch((err) => {
	console.error('[cloudrun-bootstrap] ERROR:', err?.message ?? err);
	process.exit(1);
});
