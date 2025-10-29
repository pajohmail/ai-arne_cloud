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
 * Använder OpenAI Responses API med structured outputs för att sammanfatta och verifiera utvecklingsfokus
 */
export async function summarizeWithAI(item: RSSFeedItem, source: string): Promise<ProcessedNewsItem | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const openai = new OpenAI({ apiKey });

  const content = item.contentSnippet || item.content || '';
  
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
        description: 'Artikelns titel på svenska'
      },
      excerpt: {
        type: 'string',
        description: 'Kort sammanfattning på svenska (2-3 meningar, max 200 ord)'
      },
      content: {
        type: 'string',
        description: 'Huvudinnehåll på svenska (3-5 meningar, max 300 ord)'
      }
    },
    required: ['skip', 'title', 'excerpt', 'content'],
    additionalProperties: false
  };

  const prompt = `Du är en AI-nyhetsredigerare som fokuserar på AI-utveckling och programmering. 
Kontrollera följande nyhet och skapa en kort sammanfattning på svenska som fokuserar på utvecklingsaspekter.

Om nyheten handlar om bildgenerering, videogenerering, eller visuella AI-tjänster som inte är relevanta för utveckling, sätt "skip" till true.

Nyhetstitel: ${item.title}
Innehåll: ${content.substring(0, 2000)}

Skapa en kort artikel på svenska med:
- Titel (behåll originaltiteln om den är relevant)
- En kort sammanfattning (2-3 meningar, max 200 ord)
- Huvudinnehåll (3-5 meningar, max 300 ord)`;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'Du är en AI-nyhetsredigerare som fokuserar på AI-utveckling och programmering. Svara alltid på svenska med strukturerad JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 1000,
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

