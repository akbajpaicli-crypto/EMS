import { initializeApp, getApps, cert, getApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

export function getFirebaseEnvStatus() {
  const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'e-m-s-14a96').trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const rawKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  return {
    projectId,
    hasClientEmail: Boolean(clientEmail),
    hasPrivateKey: Boolean(rawKey),
    clientEmailPreview: clientEmail ? `${clientEmail.slice(0, 12)}...` : 'MISSING',
  };
}

function getOrInitAdminApp(): App {
  if (getApps().length > 0) return getApp();

  const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'e-m-s-14a96').trim();
  let clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim().replace(/^["']|["']$/g, '');
  let rawKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim().replace(/^["']|["']$/g, '');

  // If user pasted entire serviceAccountKey.json into FIREBASE_PRIVATE_KEY, extract fields automatically
  if (rawKey.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawKey);
      if (parsed.private_key) rawKey = parsed.private_key;
      if (parsed.client_email && !clientEmail) clientEmail = parsed.client_email;
    } catch {
      // Continue with raw string
    }
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error(
      `Firebase Admin Credentials Missing on Server (FIREBASE_CLIENT_EMAIL=${clientEmail ? 'OK' : 'MISSING'}, FIREBASE_PRIVATE_KEY=${privateKey ? 'OK' : 'MISSING'}). Add them in Vercel -> Settings -> Environment Variables and Redeploy.`
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'e-m-s-14a96.firebasestorage.app').trim(),
  });
}

function createLazyProxy<T extends object>(getter: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const instance = getter();
      const val = (instance as any)[prop];
      return typeof val === 'function' ? val.bind(instance) : val;
    },
  });
}

export const adminAuth: Auth = createLazyProxy(() => getAuth(getOrInitAdminApp()));
export const adminDb: Firestore = createLazyProxy(() => getFirestore(getOrInitAdminApp()));
export const adminStorage: Storage = createLazyProxy(() => getStorage(getOrInitAdminApp()));