/**
 * Standalone firebase-admin initialization for a plain Vercel serverless
 * function (not a Firebase Cloud Function, so there's no ambient project
 * context — everything has to be supplied explicitly via a service account).
 *
 * Getting a service account key is free and requires no billing plan:
 * Firebase Console -> Project Settings -> Service Accounts -> Generate new
 * private key. That JSON file's contents go into the FIREBASE_SERVICE_ACCOUNT
 * env var on Vercel (Project Settings -> Environment Variables) as a single-
 * line JSON string — never committed to the repo.
 */
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';

let app: App;

export function getFirebaseAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set.');
  }
  const serviceAccount = JSON.parse(raw);
  app = initializeApp({ credential: cert(serviceAccount) });
  return app;
}
