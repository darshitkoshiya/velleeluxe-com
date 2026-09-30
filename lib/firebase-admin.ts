/**
 * Firebase ADMIN SDK (server-only — never import this from a client component).
 *
 * Initialised lazily on first use so the site can build without secrets.
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let firestoreInstance: Firestore | null = null;

/** Turns a key pasted into an env var (with literal "\n" and optional quotes) into PEM format. */
function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return key.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
}

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY.',
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function getAdminDb(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(getAdminApp());
    // Optional fields (e.g. address line 2) may be undefined — skip them instead of erroring.
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
  }
  return firestoreInstance;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
