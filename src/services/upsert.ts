import { withFirestore, serverTimestamp, withRetry } from './firestore.js';
import { COLLECTIONS } from './schema.js';
import { slugify, sanitizeHtml } from '../utils/text.js';

export interface UpsertNewsArgs {
  provider: string;
  name: string;
  version?: string;
  summary: string;
  url: string;
}

export interface UpsertGeneralNewsArgs {
  title: string;
  content: string;
  excerpt: string;
  sourceUrl: string;
  source: string;
}

export async function upsertPostFromRelease(release: UpsertNewsArgs) {
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
    const postsRef = db.collection(COLLECTIONS.posts);
    const existingQuery = await withRetry<any>(() => postsRef.where('slug', '==', slug).limit(1).get());

    const postData = {
      slug,
      title,
      excerpt: release.summary.slice(0, 280),
      content,
      provider: release.provider,
      sourceUrl: release.url,
      linkedinUrn: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (!existingQuery.empty) {
      const existingDoc = existingQuery.docs[0];
      await withRetry(() => existingDoc.ref.update({
        title,
        content,
        provider: release.provider,
        sourceUrl: release.url,
        updatedAt: serverTimestamp()
      }));
      return {
        id: existingDoc.id,
        slug,
        updated: true
      };
    }

    const docRef = await withRetry<any>(() => postsRef.add(postData));
    return {
      id: docRef.id,
      updated: false
    };
  });
}

export async function upsertGeneralNews(args: UpsertGeneralNewsArgs) {
  const slug = slugify(args.title);
  
  return await withFirestore(async (db) => {
    const newsRef = db.collection(COLLECTIONS.news);
    const existingQuery = await withRetry<any>(() => newsRef.where('slug', '==', slug).limit(1).get());

    const newsData = {
      slug,
      title: args.title,
      excerpt: args.excerpt,
      content: args.content,
      sourceUrl: args.sourceUrl,
      source: args.source,
      linkedinUrn: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (!existingQuery.empty) {
      const existingDoc = existingQuery.docs[0];
      await withRetry(() => existingDoc.ref.update({
        title: args.title,
        excerpt: args.excerpt,
        content: args.content,
        sourceUrl: args.sourceUrl,
        source: args.source,
        updatedAt: serverTimestamp()
      }));
      return {
        id: existingDoc.id,
        slug,
        updated: true
      };
    }

    const docRef = await withRetry<any>(() => newsRef.add(newsData));
    return {
      id: docRef.id,
      slug,
      updated: false
    };
  });
}

export async function upsertTutorialForPost(postId: string, args: { title: string; content: string; url: string; }) {
  return await withFirestore(async (db) => {
    const tutorialsRef = db.collection(COLLECTIONS.tutorials);
    const existingQuery = await withRetry<any>(() => tutorialsRef.where('postId', '==', postId).limit(1).get());

    const tutorialData = {
      postId,
      title: args.title,
      content: args.content,
      sourceUrl: args.url,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (!existingQuery.empty) {
      const existingDoc = existingQuery.docs[0];
      await withRetry(() => existingDoc.ref.update({
        title: args.title,
        content: args.content,
        sourceUrl: args.url,
        updatedAt: serverTimestamp()
      }));
      return {
        id: existingDoc.id,
        updated: true
      };
    }

    const docRef = await withRetry<any>(() => tutorialsRef.add(tutorialData));
    return {
      id: docRef.id,
      updated: false
    };
  });
}

