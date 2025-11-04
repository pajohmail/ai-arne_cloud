import { withFirestore } from '../services/firestore.js';
import { COLLECTIONS } from '../services/schema.js';

export async function verifyFirestoreHandler(_req: any, res: any) {
  try {
    const result = await withFirestore(async (db) => {
      const readCollection = async (name: string) => {
        const ref = db.collection(name);
        const snap = await ref.orderBy('createdAt', 'desc').limit(5).get();
        const docs = snap.docs.map((d) => ({ id: d.id, slug: d.data().slug, createdAt: d.data().createdAt }));
        return { count: snap.size, latest: docs };
      };

      const posts = await readCollection(COLLECTIONS.posts);
      const tutorials = await readCollection(COLLECTIONS.tutorials);
      const news = await readCollection(COLLECTIONS.news);

      return { posts, tutorials, news };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    console.error('verifyFirestoreHandler error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
}


