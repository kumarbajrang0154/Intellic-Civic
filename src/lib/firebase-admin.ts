import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let cachedAuth: Auth | null = null;

export function getFirebaseAdminAuth(): Auth | null {
  if (cachedAuth) return cachedAuth;

  try {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (privateKey) {
        // Unescape newlines if stored as string literal
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      if (projectId && clientEmail && privateKey) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        initializeApp();
      }
    }

    cachedAuth = getAuth();
    return cachedAuth;
  } catch (err: any) {
    console.error('[FIREBASE ADMIN INIT ERROR]', err?.message || err);
    return null;
  }
}
