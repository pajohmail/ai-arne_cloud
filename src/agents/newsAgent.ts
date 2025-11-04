import axios from 'axios';
import OpenAI from 'openai';
import { sanitizeHtml } from '../utils/text.js';
import type { ProviderRelease } from './providers.js';
import { upsertPostFromRelease } from '../services/upsert.js';
import { fetchReleaseNotes, searchCommunityFeedback } from './tutorialAgent.js';

/**
 * Konverterar GitHub HTML URL till API URL
 */
function getGitHubApiUrl(htmlUrl: string): string | null {
  const match = htmlUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/releases\/tag\/(.+)/);
  if (!match) return null;
  
  const [, owner, repo, tag] = match;
  return `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
}

/**
 * Söka efter relaterade nyheter och diskussioner om release
 */
export async function searchRelatedNews(
  provider: ProviderRelease['provider'],
  name: string,
  version: string | undefined
): Promise<string> {
  try {
    const repoMap: Record<string, string> = {
      'openai': 'openai/openai-node',
      'google': 'google-gemini/generative-ai-js',
      'anthropic': 'anthropics/anthropic-sdk-typescript'
    };

    const repo = repoMap[provider];
    if (!repo) return '';

    // Sök i GitHub discussions och issues
    const searchQuery = version ? `${version} OR "${name}"` : `"${name}"`;
    const url = `https://api.github.com/search/issues?q=repo:${repo}+${encodeURIComponent(searchQuery)}+type:issue+state:all&sort=updated&per_page=5`;
    
    const { data } = await axios.get(url, { 
      timeout: 15000,
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!data.items || data.items.length === 0) return '';

    const related = data.items
      .slice(0, 3)
      .map((item: any) => `- ${item.title}: ${(item.body || '').slice(0, 200)}`)
      .join('\n');

    return related;
  } catch (error) {
    console.error(`Failed to search related news for ${provider}:`, error);
    return '';
  }
}

/**
 * Hämta kontext om API:et och dess betydelse
 */
export async function fetchApiContext(
  provider: ProviderRelease['provider'],
  name: string
): Promise<string> {
  try {
    // Sök efter dokumentation eller officiella källor
    const repoMap: Record<string, string> = {
      'openai': 'openai/openai-node',
      'google': 'google-gemini/generative-ai-js',
      'anthropic': 'anthropics/anthropic-sdk-typescript'
    };

    const repo = repoMap[provider];
    if (!repo) return '';

    // Hämta README eller dokumentation
    const readmeUrl = `https://api.github.com/repos/${repo}/readme`;
    try {
      const { data } = await axios.get(readmeUrl, { 
        timeout: 15000,
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      // Dekodera base64 content (om det finns)
      if (data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return content.slice(0, 1000); // Ta första 1000 tecken
      }
    } catch (error) {
      // README kan saknas, fortsätt
    }

    return '';
  } catch (error) {
    console.error(`Failed to fetch API context for ${provider}:`, error);
    return '';
  }
}

/**
 * Schema för nyhetsinnehåll som genereras av AI
 */
interface NewsContent {
  title: string;
  introduction: string;
  content: string;
  excerpt: string;
}

/**
 * OpenAI JSON schema för structured output
 */
const newsContentSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Engagerande, ironisk titel på svenska för nyheten'
    },
    introduction: {
      type: 'string',
      description: 'Underhållande introduktion med ironi som förklarar varför nyheten är relevant (2-3 meningar)'
    },
    content: {
      type: 'string',
      description: 'Utförligt huvudinnehåll på svenska med semantisk rikedom, ironi och humor (5-8 meningar)'
    },
    excerpt: {
      type: 'string',
      description: 'Kort sammanfattning på svenska för excerpt (1-2 meningar, max 280 tecken)'
    }
  },
  required: ['title', 'introduction', 'content', 'excerpt'],
  additionalProperties: false
};

/**
 * Genererar omfattande nyhetsinnehåll med AI och webbförfrågningar
 */
export async function generateNewsContent(release: ProviderRelease): Promise<NewsContent | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const openai = new OpenAI({ apiKey });

  // Hämta data från webben
  console.log(`📡 Fetching context for ${release.name} ${release.version || ''}...`);
  
  const [releaseNotes, communityFeedback, relatedNews, apiContext] = await Promise.all([
    fetchReleaseNotes(release),
    searchCommunityFeedback(release.provider, release.name, release.version),
    searchRelatedNews(release.provider, release.name, release.version),
    fetchApiContext(release.provider, release.name)
  ]);

  // Skapa prompt med all insamlad information
  const communityFeedbackText = communityFeedback
    ? `\n\nCommunity-feedback:\n${communityFeedback}`
    : '';

  const relatedNewsText = relatedNews
    ? `\n\nRelaterade diskussioner:\n${relatedNews}`
    : '';

  const apiContextText = apiContext
    ? `\n\nAPI-kontext:\n${apiContext}`
    : '';

  const prompt = `Du är en teknisk nyhetsredigerare med en förkärlek för ironi och underhållande skrivande. 

Skapa en ENGAGERANDE, IRONISK och LÅNG nyhetsartikel på svenska för följande API-uppdatering:

**Provider:** ${release.provider}
**Namn:** ${release.name}
**Version:** ${release.version || 'N/A'}
**Publicerad:** ${release.publishedAt}

**Release notes:**
${releaseNotes || release.summary || 'Ingen information tillgänglig'}${communityFeedbackText}${relatedNewsText}${apiContextText}

VIKTIGT: Skriv artikeln på ett VÄLDIGT underhållande sätt med ett tydligt stänk ironi och humor. Var teknisk korrekt men gör det roligt att läsa. Sök efter semantiska kopplingar och förklarar varför uppdateringen är relevant för utvecklare. Använd ironi på ett smart sätt - inte för att håna, utan för att göra artikeln mer engagerande.

Artikelns struktur (ALLT SKA VARA LÅNGT OCH UTFÖRLIGT):
- En ironisk, engagerande titel (minst 10-15 ord)
- En introduktion som fångar läsarens uppmärksamhet med ironi (minst 3-4 meningar, 100-150 ord)
- Utförligt huvudinnehåll med semantisk rikedom och kontext (minst 8-12 meningar, 300-500 ord)
- En kort sammanfattning för excerpt (2-3 meningar, 50-80 ord)

Tänk på: Innehållet ska vara LÅNGT, UNDERHÅLLANDE och FULLT AV IRONI. Var inte blygsam - gör det riktigt roligt att läsa!`;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du är en teknisk nyhetsredigerare med en förkärlek för ironi och underhållande skrivande. Skriv alltid på svenska med ett stänk ironi och humor, men behåll teknisk korrekthet. Använd webbförfrågningar för att hitta mer kontext och perspektiv.'
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
          name: 'news_content',
          strict: true,
          schema: newsContentSchema as any
        }
      }
    });

    const parsedResponse = completion.choices[0]?.message?.parsed as NewsContent | null;
    
    if (!parsedResponse) {
      console.error('Failed to parse news content from OpenAI');
      return null;
    }

    return parsedResponse;
  } catch (error) {
    console.error(`Failed to generate news content with AI:`, error);
    return null;
  }
}

/**
 * Konverterar NewsContent till HTML
 */
function newsContentToHtml(content: NewsContent): string {
  return [
    `<p><strong>${sanitizeHtml(content.title)}</strong></p>`,
    `<p>${sanitizeHtml(content.introduction)}</p>`,
    `<p>${sanitizeHtml(content.content)}</p>`
  ].join('');
}

export async function upsertNews(release: ProviderRelease) {
  // Försök generera AI-innehåll
  console.log(`🤖 Generating AI news for ${release.name} ${release.version || ''}...`);
  const newsContent = await generateNewsContent(release);

  if (newsContent) {
    // Använd AI-genererat innehåll
    const content = newsContentToHtml(newsContent);
    const excerpt = newsContent.excerpt.slice(0, 280);
    
    // Skapa en anpassad version av upsertPostFromRelease med AI-innehåll
    // Vi behöver uppdatera upsertPostFromRelease för att acceptera custom content
    // eller skapa en ny funktion
    return await upsertPostFromRelease({
      provider: release.provider,
      name: release.name,
      version: release.version,
      summary: newsContent.content,
      url: release.url,
      title: newsContent.title,
      excerpt: excerpt,
      content: content
    });
  } else {
    // Fallback till minimalisk beskrivning om AI misslyckas
    console.warn(`⚠️ AI generation failed, using fallback for ${release.name}`);
    return await upsertPostFromRelease({
      provider: release.provider,
      name: release.name,
      version: release.version,
      summary: release.summary,
      url: release.url
    });
  }
}
