import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let cachedAuth: Auth | null = null;

export function getFirebaseAdminAuth(): Auth | null {
  if (cachedAuth) return cachedAuth;

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('[FIREBASE ADMIN] Credentials not configured. Skipping initialization.');
      return null;
    }

    if (privateKey) {
      // Strip surrounding quotes if added by Vercel environment UI
      privateKey = privateKey.trim();
      if (
        (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))
      ) {
        privateKey = privateKey.slice(1, -1);
      }
      // Replace escaped newlines \n or \\n with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    cachedAuth = getAuth();
    return cachedAuth;
  } catch (err: any) {
    console.error('[FIREBASE ADMIN INIT ERROR]', err?.message || err);
    return null;
  }
}
