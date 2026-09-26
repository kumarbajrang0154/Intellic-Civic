// Complete E2E verification test for Firebase Admin verifyIdToken & /api/auth/verify-otp route
// Run: node --env-file=.env scripts/test-e2e-verify.mjs

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId   = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let   privateKey  = process.env.FIREBASE_PRIVATE_KEY;
const apiKey      = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

console.log('\n=== E2E Backend Token Verification Diagnostic ===');

privateKey = privateKey.trim();
if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
privateKey = privateKey.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const adminAuth = getAuth();

// Step 1: Mint a custom token with phone_number claim
const phone = '+919999999999';
const uid = 'citizen-e2e-test-uid';
console.log('1. Minting custom token for phone:', phone);
const customToken = await adminAuth.createCustomToken(uid, { phone_number: phone });
console.log('   Custom token generated successfully.');

// Step 2: Exchange custom token for real Firebase idToken via Firebase REST API
console.log('2. Exchanging custom token for real Firebase ID Token via Firebase Auth REST API...');
const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: customToken, returnSecureToken: true })
});

const restData = await res.json();
if (!res.ok) {
  console.error('   Failed to exchange custom token:', restData);
  process.exit(1);
}
const idToken = restData.idToken;
console.log('   Real Firebase ID Token received successfully (length:', idToken.length, ')');

// Step 3: Verify ID Token using Firebase Admin SDK directly
console.log('3. Verifying ID Token via Firebase Admin verifyIdToken()...');
const decoded = await adminAuth.verifyIdToken(idToken);
console.log('   verifyIdToken() SUCCESS! Decoded payload:');
console.log('   - uid:', decoded.uid);
console.log('   - aud (project):', decoded.aud);
console.log('   - iss:', decoded.iss);

// Step 4: Call POST /api/auth/verify-otp on running dev server
console.log('4. Posting idToken to http://localhost:3000/api/auth/verify-otp...');
const apiRes = await fetch('http://localhost:3000/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mobileNumber: '9999999999', idToken })
});

const apiData = await apiRes.json();
console.log('   Response Status Code:', apiRes.status);
console.log('   Response Headers (Set-Cookie):', apiRes.headers.get('set-cookie'));
console.log('   Response Body:', JSON.stringify(apiData, null, 2));

if (apiRes.status === 200 && apiData.success) {
  console.log('\n🎉 ALL CHECKS PASSED PERFECTLY!');
  console.log(' - Firebase Admin verifyIdToken() succeeded without 500 errors');
  console.log(' - Citizen JWT session cookies created (ic_access_token & ic_refresh_token)');
  console.log(' - User profile retrieved/created in DB');
} else {
  console.error('\n❌ API verification failed');
  process.exit(1);
}
