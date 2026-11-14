// Firebase Admin SDK diagnostic
// Run: node --env-file=.env scripts/test-firebase-admin.mjs
import fs from 'fs';

console.log('\n=== Firebase Admin SDK Diagnostic ===');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.log('NOTICE: FIREBASE_SERVICE_ACCOUNT_PATH is not configured in environment.');
  process.exit(0);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`ERROR: Service account file does not exist at path: ${serviceAccountPath}`);
  process.exit(1);
}

try {
  const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(fileContent);
  const projectId = serviceAccount.project_id;
  const clientEmail = serviceAccount.client_email;
  const privateKey = serviceAccount.private_key;

  const missing = [];
  if (!projectId) missing.push('project_id');
  if (!clientEmail) missing.push('client_email');
  if (!privateKey) missing.push('private_key');

  if (missing.length) {
    console.error('MISSING fields in service account JSON:', missing.join(', '));
    process.exit(1);
  }

  console.log('PRESENT: Service account credentials loaded from FIREBASE_SERVICE_ACCOUNT_PATH');

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  const adminAuth = getAuth();
  console.log('INIT_RESULT: SUCCESS —', adminAuth.constructor.name, 'object created');
  console.log('\n OK — Firebase Admin SDK is ready.');
} catch (err) {
  console.error('INIT_RESULT: FAILED —', err.message);
  process.exit(1);
}
