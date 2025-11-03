import { fetchRSSFeeds, processAndUpsertNews } from './generalNewsAgent.js';
import { postToLinkedIn } from '../services/linkedin.js';
import { withFirestore } from '../services/firestore.js';
import { COLLECTIONS } from '../services/schema.js';

/**
 * Huvudfunktion som kör hela flödet för allmänna AI-nyheter
 */
export async function runGeneralNewsManager({ force = false }: { force?: boolean } = {}) {
  const feedUrlsStr = process.env.RSS_FEEDS;
  if (!feedUrlsStr) {
    console.warn('RSS_FEEDS environment variable not set');
    return { processed: 0, error: 'RSS_FEEDS not configured' };
  }

  const feedUrls = feedUrlsStr.split(',').map(url => url.trim()).filter(Boolean);
  if (feedUrls.length === 0) {
    return { processed: 0, error: 'No RSS feeds configured' };
  }

  // Bearbeta max 5 nyheter per körning
  let processed = 0;
  const processedNews: Array<{ id: string; slug: string; title: string; sourceUrl: string }> = [];

  // Processera varje feed individuellt för att få rätt källa
  for (let i = 0; i < feedUrls.length && processedNews.length < 5; i++) {
    const feedUrl = feedUrls[i];
    const source = `RSS Feed ${i + 1}`;
    
    // Hämta items från denna specifika feed
    const feedItems = await fetchRSSFeeds([feedUrl]);
    const itemsToProcessFromFeed = feedItems.slice(0, 1); // Ta första från varje feed

    if (itemsToProcessFromFeed.length === 0) continue;
    
    // Bearbeta och spara nyheter
    const count = await processAndUpsertNews(itemsToProcessFromFeed, source);
    
    if (count > 0) {
      // Hämta sparade nyheter från databasen för att få ID och slug
      const savedNews = await withFirestore(async (db) => {
        const newsRef = db.collection(COLLECTIONS.news);
        const query = await newsRef.orderBy('createdAt', 'desc').limit(count).get();
        return query.docs.map(doc => ({
          id: doc.id,
          slug: doc.data().slug,
          title: doc.data().title,
          sourceUrl: doc.data().sourceUrl
        }));
      });

      processedNews.push(...savedNews);
      processed += count;
    }
  }

  // Publicera på LinkedIn (hoppa över om credentials är placeholders)
  const linkedinToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const linkedinUrn = process.env.LINKEDIN_ORG_URN;
  
  if (linkedinToken && linkedinUrn && 
      linkedinToken !== 'placeholder' && 
      linkedinUrn !== 'urn:li:organization:0' &&
      !linkedinUrn.includes('123456789')) {
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://ai-arne.se';
    
    for (const news of processedNews.slice(0, 3)) {
      const newsUrl = `${baseUrl}/news/${news.slug}`;
      
      const text = [
        `AI-nyhet: ${news.title}`,
        '',
        `Läs mer: ${newsUrl}`
      ].join('\n');

      try {
        await postToLinkedIn(
          {
            organizationUrn: linkedinUrn,
            text,
            title: news.title,
            link: newsUrl
          },
          linkedinToken
        );
      } catch (error) {
        console.error(`Failed to post to LinkedIn:`, error);
        // Fortsätt med nästa nyhet även om LinkedIn-posten misslyckas
      }
    }
  } else {
    console.log(`Skipping LinkedIn posts (credentials not configured)`);
  }

  return { processed };
}

