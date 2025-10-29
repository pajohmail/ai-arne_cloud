import { fetchRSSFeeds, processAndUpsertNews } from './generalNewsAgent.js';
import { postToLinkedIn } from '../services/linkedin.js';
import { withFirestore } from '../services/firestore.js';
import { COLLECTIONS } from '../services/schema.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface RSSFeedConfig {
  name: string;
  url: string;
  category: string;
}

interface RSSFeedsConfig {
  feeds: RSSFeedConfig[];
}

/**
 * Läser RSS-feeds från JSON-filen
 */
function loadRSSFeeds(): RSSFeedConfig[] {
  try {
    // Försök läsa från projektets root (runt dist/ vid deployment)
    const feedsPath = join(process.cwd(), 'rss-feeds.json');
    const content = readFileSync(feedsPath, 'utf-8');
    const config: RSSFeedsConfig = JSON.parse(content);
    return config.feeds;
  } catch (error) {
    console.warn('Failed to load rss-feeds.json, falling back to env variable:', error);
    
    // Fallback till miljövariabel om JSON-filen saknas
    const feedUrlsStr = process.env.RSS_FEEDS;
    if (feedUrlsStr) {
      return feedUrlsStr.split(',').map((url, index) => ({
        name: `RSS Feed ${index + 1}`,
        url: url.trim(),
        category: 'General AI News'
      })).filter(feed => feed.url);
    }
    
    return [];
  }
}

/**
 * Huvudfunktion som kör hela flödet för allmänna AI-nyheter
 */
export async function runGeneralNewsManager({ force = false }: { force?: boolean } = {}) {
  const feeds = loadRSSFeeds();
  
  if (feeds.length === 0) {
    console.warn('No RSS feeds configured');
    return { processed: 0, error: 'No RSS feeds configured' };
  }

  console.log(`📡 Loaded ${feeds.length} RSS feeds from configuration`);

  // Bearbeta max 5 nyheter per körning
  let processed = 0;
  const processedNews: Array<{ id: string; slug: string; title: string; sourceUrl: string }> = [];

  // Processera varje feed individuellt för att få rätt källa
  for (let i = 0; i < feeds.length && processedNews.length < 5; i++) {
    const feed = feeds[i];
    const source = feed.name; // Använd feed-namnet som källa
    
    // Hämta items från denna specifika feed
    const feedItems = await fetchRSSFeeds([feed.url]);
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

  // Publicera på LinkedIn
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
          organizationUrn: process.env.LINKEDIN_ORG_URN!,
          text,
          title: news.title,
          link: newsUrl
        },
        process.env.LINKEDIN_ACCESS_TOKEN!
      );
    } catch (error) {
      console.error(`Failed to post to LinkedIn:`, error);
      // Fortsätt med nästa nyhet även om LinkedIn-posten misslyckas
    }
  }

  return { processed };
}

