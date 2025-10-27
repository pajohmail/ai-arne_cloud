import { withFirestore, timestampToISO } from '../services/firestore.js';
import { slugify, sanitizeHtml } from '../utils/text.js';
import { ProviderRelease } from './providers.js';

export async function upsertNews(release: ProviderRelease) {
  const slug = slugify(`${release.provider}-${release.name}-${release.version || ''}`);
  const title = `[${release.provider.toUpperCase()}] ${release.name}${release.version ? ' ' + release.version : ''}`;
  const content = sanitizeHtml(
    [
      `<p><strong>${title}</strong></p>`,
      `<p>${release.summary}</p>`,
      `<p>Källa: <a href="${release.url}" rel="noopener" target="_blank">${release.url}</a></p>`
    ].join('')
  );

  return await withFirestore(async (db) => {
    // Kolla om posten redan finns (via slug)
    const postsRef = db.collection('posts');
    const existingQuery = await postsRef.where('slug', '==', slug).limit(1).get();
    
    const postData = {
      slug,
      title,
      excerpt: release.summary.slice(0, 280),
      content,
      provider: release.provider,
      sourceUrl: release.url,
      linkedinUrn: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!existingQuery.empty) {
      // Uppdatera befintlig post
      const existingDoc = existingQuery.docs[0];
      await existingDoc.ref.update({
        title,
        content,
        provider: release.provider,
        sourceUrl: release.url,
        updatedAt: new Date()
      });
      return { 
        id: existingDoc.id, 
        slug, 
        updated: true 
      };
    } else {
      // Skapa ny post
      const docRef = await postsRef.add(postData);
      return { 
        id: docRef.id, 
        slug, 
        updated: false 
      };
    }
  });
}
