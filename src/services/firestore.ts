import { Firestore } from '@google-cloud/firestore';

let firestore: Firestore | null = null;

export function getFirestore() {
  if (!firestore) {
    firestore = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT!,
      // I Cloud Functions använder vi default credentials
      // Lokalt behöver du sätta GOOGLE_APPLICATION_CREDENTIALS
    });
  }
  return firestore;
}

export async function withFirestore<T>(fn: (db: Firestore) => Promise<T>) {
  const db = getFirestore();
  return await fn(db);
}

// Helper för att konvertera Firestore timestamp till ISO string
export function timestampToISO(timestamp: any): string {
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  return new Date().toISOString();
}

// Helper för att skapa Firestore timestamp från ISO string
export function isoToTimestamp(isoString: string) {
  return new Date(isoString);
}
