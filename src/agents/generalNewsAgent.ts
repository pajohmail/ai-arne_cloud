import Parser from 'rss-parser';
import Anthropic from '@anthropic-ai/sdk';
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
 * Använder LLM för att sammanfatta och verifiera utvecklingsfokus
 * Fallback till enkel sammanfattning om API-nyckel saknas
 */
export async function summarizeWithAI(item: RSSFeedItem, source: string): Promise<ProcessedNewsItem | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  // Om ingen API-nyckel finns, använd enkel sammanfattning
  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY not set, using simple summarization');
    const fallbackContent = item.contentSnippet || item.content || '';
    const fallbackHtml = [
      `<p><strong>${sanitizeHtml(item.title)}</strong></p>`,
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

  const anthropic = new Anthropic({ apiKey });

  const content = item.contentSnippet || item.content || '';
  const prompt = `Du är en AI-nyhetsredigerare som fokuserar på AI-utveckling och programmering. 
Kontrollera följande nyhet och skapa en kort sammanfattning på svenska (max 300 ord) som fokuserar på utvecklingsaspekter.

Om nyheten handlar om bildgenerering, videogenerering, eller visuella AI-tjänster som inte är relevanta för utveckling, returnera enbart "SKIP".

Nyhetstitel: ${item.title}
Innehåll: ${content.substring(0, 2000)}

Skapa en kort artikel på svenska med:
- Titel (behåll originaltiteln om den är relevant)
- En kort sammanfattning (2-3 meningar, max 200 ord)
- Huvudinnehåll (3-5 meningar, max 300 ord)

Format:
TITEL: [titel]
SAMMANFATTNING: [kort sammanfattning]
INNEHÅLL: [huvudinnehåll]`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Om LLM säger SKIP, hoppa över denna nyhet
    if (responseText.includes('SKIP') || responseText.trim().length === 0) {
      return null;
    }

    // Parsa LLM-svaret
    const titleMatch = responseText.match(/TITEL:\s*(.+?)(?:\n|$)/i);
    const excerptMatch = responseText.match(/SAMMANFATTNING:\s*(.+?)(?:\n|$)/is);
    const contentMatch = responseText.match(/INNEHÅLL:\s*(.+?)(?:\n|$)/is);

    const title = titleMatch ? titleMatch[1].trim() : item.title;
    const excerpt = excerptMatch ? excerptMatch[1].trim().slice(0, 280) : (item.contentSnippet || '').slice(0, 280);
    const content = contentMatch ? contentMatch[1].trim() : (item.contentSnippet || '').slice(0, 500);

    // Skapa HTML-innehåll (sanitize textdelar men behåll HTML-struktur)
    const htmlContent = [
      `<p><strong>${sanitizeHtml(title)}</strong></p>`,
      `<p>${sanitizeHtml(excerpt)}</p>`,
      `<p>${sanitizeHtml(content)}</p>`,
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

