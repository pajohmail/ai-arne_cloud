import axios from 'axios';
import Parser from 'rss-parser';
import OpenAI from 'openai';
import { sanitizeHtml } from '../utils/text.js';
import { upsertGeneralNews } from '../services/upsert.js';

const parser = new Parser();

export interface RSSFeedItem {
  title: string;
  link: string;
  contentSnippet?: string;
  content?: string;
  pubDate?: string;
  isoDate?: string;
}

export interface ProcessedNewsItem {
  title: string;
  content: string;
  excerpt: string;
  sourceUrl: string;
  source: string;
}

interface NewsSummaryResponse {
  skip: boolean;
  title: string;
  excerpt: string;
  content: string;
}

// Nyckelord att exkludera (bildgenerering, video, etc.)
const EXCLUDE_KEYWORDS = [
  'dall-e',
  'dalle',
  'midjourney',
  'stable diffusion',
  'sora',
  'image generation',
  'bildgenerering',
  'video generation',
  'videogenerering',
  'text-to-image',
  'text-to-video',
  'image-to-image',
  'img2img',
  'diffusion model',
  'paint',
  'sketch',
  'art generator',
  'konstgenerator',
  'visual ai',
  'computer vision',
  'image recognition',
  'bildigenkänning'
];

/**
 * Hämtar nyheter från RSS-feeds
 */
export async function fetchRSSFeeds(feedUrls: string[]): Promise<RSSFeedItem[]> {
  const allItems: RSSFeedItem[] = [];

  for (const url of feedUrls) {
    try {
      const feed = await parser.parseURL(url);
      const items = feed.items.map(item => ({
        title: item.title || '',
        link: item.link || '',
        contentSnippet: item.contentSnippet || '',
        content: item.content || '',
        pubDate: item.pubDate,
        isoDate: item.isoDate
      }));
      allItems.push(...items);
    } catch (error) {
      console.error(`Failed to fetch RSS feed ${url}:`, error);
      // Fortsätt med nästa feed
    }
  }

  return allItems;
}

/**
 * Filtrerar nyheter med nyckelord för att exkludera bild/video-generering
 */
export function filterForDevelopmentFocus(item: RSSFeedItem): boolean {
  const searchText = `${item.title} ${item.contentSnippet || ''} ${item.content || ''}`.toLowerCase();
  
  // Exkludera om något av nyckelorden finns
  const hasExcludeKeyword = EXCLUDE_KEYWORDS.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );

  return !hasExcludeKeyword;
}

/**
 * Söka efter relaterade artiklar och diskussioner om nyheten
 */
async function searchRelatedArticles(item: RSSFeedItem): Promise<string> {
  try {
    // Extrahera nyckelord från nyheten
    const keywords = item.title.split(' ').slice(0, 3).join(' ');
    
    // Sök i GitHub discussions/issues (om det är en teknisk nyhet)
    // För RSS-nyheter kan vi söka efter relaterade artiklar via GitHub API
    const searchQuery = encodeURIComponent(keywords);
    const url = `https://api.github.com/search/repositories?q=${searchQuery}&sort=updated&per_page=3`;
    
    try {
      const { data } = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (data.items && data.items.length > 0) {
        const related = data.items
          .slice(0, 2)
          .map((repo: any) => `- ${repo.full_name}: ${repo.description || ''}`)
          .join('\n');
        return related;
      }
    } catch (error) {
      // Ignorera om sökningen misslyckas
    }

    return '';
  } catch (error) {
    console.error(`Failed to search related articles:`, error);
    return '';
  }
}

/**
 * Hämta mer kontext och semantik om nyheten
 */
async function fetchSemanticContext(item: RSSFeedItem): Promise<string> {
  try {
    // Försök hämta mer information från artikeln direkt (om det är en URL)
    if (item.link) {
      try {
        // För RSS-nyheter kan vi inte alltid hämta hela artikeln direkt
        // Men vi kan använda informationen vi redan har
        const fullContent = (item.content || item.contentSnippet || '').slice(0, 2000);
        return fullContent;
      } catch (error) {
        // Ignorera om hämtning misslyckas
      }
    }

    return '';
  } catch (error) {
    console.error(`Failed to fetch semantic context:`, error);
    return '';
  }
}

/**
 * Använder OpenAI Responses API med structured outputs för att sammanfatta och verifiera utvecklingsfokus
 */
export async function summarizeWithAI(item: RSSFeedItem, source: string): Promise<ProcessedNewsItem | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const openai = new OpenAI({ apiKey });

  const content = item.contentSnippet || item.content || '';
  
  // Hämta kontext från webben
  console.log(`📡 Fetching context for news: ${item.title}...`);
  const [relatedArticles, semanticContext] = await Promise.all([
    searchRelatedArticles(item),
    fetchSemanticContext(item)
  ]);

  // JSON schema för structured output
  const responseSchema = {
    type: 'object',
    properties: {
      skip: {
        type: 'boolean',
        description: 'true om nyheten ska hoppas över (bildgenerering, videogenerering, etc.)'
      },
      title: {
        type: 'string',
        description: 'Ironisk, engagerande artikelns titel på svenska'
      },
      excerpt: {
        type: 'string',
        description: 'Kort sammanfattning på svenska med ironi (2-3 meningar, max 200 ord)'
      },
      content: {
        type: 'string',
        description: 'Utförligt huvudinnehåll på svenska med semantisk rikedom, ironi och humor (5-8 meningar)'
      }
    },
    required: ['skip', 'title', 'excerpt', 'content'],
    additionalProperties: false
  };

  const relatedArticlesText = relatedArticles
    ? `\n\nRelaterade artiklar/diskussioner:\n${relatedArticles}`
    : '';

  const semanticContextText = semanticContext && semanticContext.length > content.length
    ? `\n\nYtterligare kontext:\n${semanticContext}`
    : '';

  const prompt = `Du är en teknisk nyhetsredigerare med en förkärlek för ironi och underhållande skrivande. 

Kontrollera följande nyhet och skapa en engagerande, ironisk artikel på svenska som fokuserar på utvecklingsaspekter.

Om nyheten handlar om bildgenerering, videogenerering, eller visuella AI-tjänster som inte är relevanta för utveckling, sätt "skip" till true.

Nyhetstitel: ${item.title}
Innehåll: ${content.substring(0, 2000)}${relatedArticlesText}${semanticContextText}

VIKTIGT: Skriv artikeln på ett VÄLDIGT underhållande sätt med ett tydligt stänk ironi och humor. Var teknisk korrekt men gör det roligt att läsa. Sök efter semantiska kopplingar och förklarar varför nyheten är relevant för utvecklare. Använd ironi på ett smart sätt - inte för att håna, utan för att göra artikeln mer engagerande.

Skapa en artikel på svenska med (ALLT SKA VARA LÅNGT OCH UTFÖRLIGT):
- En ironisk, engagerande titel (minst 10-15 ord)
- En kort sammanfattning med ironi (3-4 meningar, 100-150 ord)
- Utförligt huvudinnehåll med semantisk rikedom och kontext (minst 10-15 meningar, 400-600 ord)

Tänk på: Innehållet ska vara LÅNGT, UNDERHÅLLANDE och FULLT AV IRONI. Var inte blygsam - gör det riktigt roligt att läsa!`;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du är en teknisk nyhetsredigerare med en förkärlek för ironi och underhållande skrivande. Skriv alltid på svenska med ett stänk ironi och humor, men behåll teknisk korrekthet. Använd webbförfrågningar för att hitta mer kontext och perspektiv. Svara med strukturerad JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 3000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'news_summary',
          strict: true,
          schema: responseSchema as any
        }
      }
    });

    const parsedResponse = completion.choices[0]?.message?.parsed as NewsSummaryResponse | null;
    
    // Om LLM säger att vi ska hoppa över nyheten
    if (!parsedResponse || parsedResponse.skip === true) {
      return null;
    }

    const title = parsedResponse.title?.trim() || item.title;
    const excerpt = parsedResponse.excerpt?.trim().slice(0, 280) || (item.contentSnippet || '').slice(0, 280);
    const contentText = parsedResponse.content?.trim().slice(0, 500) || (item.contentSnippet || '').slice(0, 500);

    // Skapa HTML-innehåll (sanitize textdelar men behåll HTML-struktur)
    const htmlContent = [
      `<p><strong>${sanitizeHtml(title)}</strong></p>`,
      `<p>${sanitizeHtml(excerpt)}</p>`,
      `<p>${sanitizeHtml(contentText)}</p>`,
      `<p>Källa: <a href="${sanitizeHtml(item.link)}" rel="noopener" target="_blank">${sanitizeHtml(item.link)}</a></p>`
    ].join('');

    return {
      title: sanitizeHtml(title),
      content: htmlContent,
      excerpt: sanitizeHtml(excerpt),
      sourceUrl: item.link,
      source
    };
  } catch (error) {
    console.error(`Failed to summarize with AI:`, error);
    // Fallback till enkel sammanfattning utan LLM
    const fallbackContent = item.contentSnippet || item.content || '';
    const fallbackHtml = [
      `<p>${sanitizeHtml(fallbackContent)}</p>`,
      `<p>Källa: <a href="${sanitizeHtml(item.link)}" rel="noopener" target="_blank">${sanitizeHtml(item.link)}</a></p>`
    ].join('');
    
    return {
      title: sanitizeHtml(item.title),
      content: fallbackHtml,
      excerpt: sanitizeHtml(fallbackContent.slice(0, 280)),
      sourceUrl: item.link,
      source
    };
  }
}

/**
 * Bearbetar och sparar allmänna nyheter
 */
export async function processAndUpsertNews(items: RSSFeedItem[], source: string): Promise<number> {
  let processed = 0;

  for (const item of items) {
    // Första filtreringen med nyckelord
    if (!filterForDevelopmentFocus(item)) {
      continue;
    }

    // LLM-baserad sammanfattning och filtrering
    const processedItem = await summarizeWithAI(item, source);
    if (!processedItem) {
      continue; // LLM sa SKIP
    }

    // Spara i databas
    await upsertGeneralNews(processedItem);
    processed++;
  }

  return processed;
}

