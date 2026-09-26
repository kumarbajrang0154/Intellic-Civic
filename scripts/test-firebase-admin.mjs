// Firebase Admin SDK diagnostic
// Run: node --env-file=.env scripts/test-firebase-admin.mjs

const projectId   = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let   privateKey  = process.env.FIREBASE_PRIVATE_KEY;

console.log('\n=== Firebase Admin SDK Diagnostic ===');

const missing = [];
if (!projectId)   missing.push('FIREBASE_PROJECT_ID');
if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
if (!privateKey)  missing.push('FIREBASE_PRIVATE_KEY');
if (missing.length) {
  console.error('MISSING:', missing.join(', '));
  process.exit(1);
}
console.log('PRESENT: All three vars found');

if (privateKey.includes('PASTE_YOUR_PRIVATE_KEY_HERE')) {
  console.error('PLACEHOLDER: FIREBASE_PRIVATE_KEY is still a placeholder');
  process.exit(1);
}

privateKey = privateKey.trim();
if ((privateKey.startsWith('"') && privateKey.endsWith('"'))) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

const hasHeader = privateKey.includes('-----BEGIN PRIVATE KEY-----');
const hasFooter = privateKey.includes('-----END PRIVATE KEY-----');
console.log('PEM_HEADER:', hasHeader ? 'OK' : 'MISSING');
console.log('PEM_FOOTER:', hasFooter ? 'OK' : 'MISSING');

const keyBody = privateKey
  .replace(/-----BEGIN PRIVATE KEY-----/g, '')
  .replace(/-----END PRIVATE KEY-----/g, '')
  .replace(/\n/g, '').replace(/\r/g, '')
  .trim();
const invalidChars = keyBody.replace(/[A-Za-z0-9+/=]/g, '');
if (invalidChars.length > 0) {
  const unique = [...new Set(invalidChars)].map(c => '\\x' + c.charCodeAt(0).toString(16));
  console.error(`INVALID_CHARS: ${invalidChars.length} found: ${unique.join(' ')} — key is CORRUPTED`);
  console.error('ACTION: Re-download the JSON key from Firebase Console → Project Settings → Service Accounts → Generate new private key, then paste the "private_key" field value into .env FIREBASE_PRIVATE_KEY');
  process.exit(1);
}
console.log('PEM_BODY: Valid base64 characters only (no corruption)');

if (!clientEmail.includes(projectId)) {
  console.warn('EMAIL_PROJECT_MISMATCH: clientEmail domain does not contain projectId — service account must belong to project', projectId);
}
console.log('PROJECT_ID:', projectId);
console.log('CLIENT_EMAIL:', clientEmail);

try {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  const adminAuth = getAuth();
  console.log('INIT_RESULT: SUCCESS —', adminAuth.constructor.name, 'object created');
  console.log('\n OK — Firebase Admin SDK is ready. verifyIdToken() will work from the backend.');
} catch (err) {
  console.error('INIT_RESULT: FAILED —', err.message);
  process.exit(1);
}
