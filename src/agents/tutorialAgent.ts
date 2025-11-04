import axios from 'axios';
import OpenAI from 'openai';
import { sanitizeHtml } from '../utils/text.js';
import type { ProviderRelease } from './providers.js';
import { upsertTutorialForPost } from '../services/upsert.js';

/**
 * Konverterar GitHub HTML URL till API URL
 */
function getGitHubApiUrl(htmlUrl: string): string | null {
  // Exempel: https://github.com/openai/openai-node/releases/tag/v4.0.0
  // Konvertera till: https://api.github.com/repos/openai/openai-node/releases/tags/v4.0.0
  const match = htmlUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/releases\/tag\/(.+)/);
  if (!match) return null;
  
  const [, owner, repo, tag] = match;
  return `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
}

/**
 * Hämta fullständig release notes från GitHub API
 */
export async function fetchReleaseNotes(release: ProviderRelease): Promise<string> {
  try {
    const apiUrl = getGitHubApiUrl(release.url);
    if (!apiUrl) {
      return release.summary || '';
    }

    const { data } = await axios.get(apiUrl, { 
      timeout: 15000,
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    return data.body || release.summary || '';
  } catch (error) {
    console.error(`Failed to fetch release notes for ${release.url}:`, error);
    return release.summary || '';
  }
}

/**
 * Hämta tidigare versioner från GitHub för jämförelse
 */
export async function fetchPreviousVersions(
  provider: ProviderRelease['provider'],
  currentVersion: string | undefined
): Promise<Array<{ version: string; publishedAt: string; summary: string }>> {
  try {
    const repoMap: Record<string, string> = {
      'openai': 'openai/openai-node',
      'google': 'google-gemini/generative-ai-js',
      'anthropic': 'anthropics/anthropic-sdk-typescript'
    };

    const repo = repoMap[provider];
    if (!repo) return [];

    const url = `https://api.github.com/repos/${repo}/releases?per_page=10`;
    const { data } = await axios.get(url, { 
      timeout: 15000,
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    // Filtrera bort nuvarande version och hämta tidigare
    const previousVersions = data
      .filter((r: any) => r.tag_name !== currentVersion)
      .slice(0, 3) // Ta 3 senaste tidigare versioner
      .map((r: any) => ({
        version: r.tag_name,
        publishedAt: r.published_at,
        summary: (r.body || '').slice(0, 500)
      }));

    return previousVersions;
  } catch (error) {
    console.error(`Failed to fetch previous versions for ${provider}:`, error);
    return [];
  }
}

/**
 * Söka efter community-feedback från GitHub issues och discussions
 */
export async function searchCommunityFeedback(
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

    // Sök i GitHub issues med version eller release-namn
    const searchQuery = version ? `${version} OR "${name}"` : `"${name}"`;
    const url = `https://api.github.com/search/issues?q=repo:${repo}+${encodeURIComponent(searchQuery)}+type:issue+state:all&sort=updated&per_page=5`;
    
    const { data } = await axios.get(url, { 
      timeout: 15000,
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!data.items || data.items.length === 0) return '';

    // Samla feedback från issues
    const feedback = data.items
      .map((item: any) => ({
        title: item.title,
        body: (item.body || '').slice(0, 300),
        comments: item.comments,
        reactions: (item.reactions?.total_count || 0)
      }))
      .slice(0, 3);

    // Formatera feedback
    return feedback
      .map((f: any) => `**${f.title}** (${f.reactions} reactions, ${f.comments} comments)\n${f.body}`)
      .join('\n\n');
  } catch (error) {
    console.error(`Failed to search community feedback for ${provider}:`, error);
    return '';
  }
}

/**
 * Schema för tutorial-innehåll som genereras av AI
 */
interface TutorialContent {
  title: string;
  introduction: string;
  whatsNew: string;
  improvements: string[];
  installation: string;
  codeExamples: Array<{
    title: string;
    description: string;
    code: string;
    language: string;
  }>;
  communityReviews: string;
  resources: Array<{
    title: string;
    url: string;
  }>;
}

/**
 * OpenAI JSON schema för structured output
 */
const tutorialSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Engagerande titel på svenska för tutorialen'
    },
    introduction: {
      type: 'string',
      description: 'Underhållande introduktion som förklarar varför uppdateringen är spännande (2-3 meningar)'
    },
    whatsNew: {
      type: 'string',
      description: 'Detaljerad beskrivning av vad som är nytt i denna version jämfört med tidigare (3-5 meningar)'
    },
    improvements: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Lista över konkreta förbättringar (3-7 punkter)'
    },
    installation: {
      type: 'string',
      description: 'Steg-för-steg installationsguide på svenska (inkluderar kommando och förklaringar)'
    },
    codeExamples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Titel på kodexemplet'
          },
          description: {
            type: 'string',
            description: 'Kort beskrivning av vad exemplet gör'
          },
          code: {
            type: 'string',
            description: 'Själva koden (JavaScript/TypeScript för Node.js SDKs)'
          },
          language: {
            type: 'string',
            description: 'Programmeringsspråk (t.ex. "javascript", "typescript")'
          }
        },
        required: ['title', 'description', 'code', 'language'],
        additionalProperties: false
      },
      description: '3-5 kodexempel som visar olika användningsfall'
    },
    communityReviews: {
      type: 'string',
      description: 'Sammanfattning av vad communityn säger om uppdateringen (2-3 meningar, balanserat)'
    },
    resources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Titel på resursen'
          },
          url: {
            type: 'string',
            description: 'URL till resursen'
          }
        },
        required: ['title', 'url'],
        additionalProperties: false
      },
      description: 'Länkar till relevanta resurser (dokumentation, exempel, etc.)'
    }
  },
  required: ['title', 'introduction', 'whatsNew', 'improvements', 'installation', 'codeExamples', 'communityReviews', 'resources'],
  additionalProperties: false
};

/**
 * Genererar omfattande tutorial-innehåll med AI och webbförfrågningar
 */
export async function generateTutorialContent(release: ProviderRelease): Promise<TutorialContent | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const openai = new OpenAI({ apiKey });

  // Hämta data från webben
  console.log(`📡 Fetching data for ${release.name} ${release.version || ''}...`);
  
  const [releaseNotes, previousVersions, communityFeedback] = await Promise.all([
    fetchReleaseNotes(release),
    fetchPreviousVersions(release.provider, release.version),
    searchCommunityFeedback(release.provider, release.name, release.version)
  ]);

  // Bestäm paketnamn baserat på provider
  const packageMap: Record<string, string> = {
    'openai': '@openai/openai',
    'google': '@google/generative-ai',
    'anthropic': '@anthropic-ai/sdk'
  };

  const packageName = packageMap[release.provider] || `${release.provider}-sdk`;

  // Skapa prompt med all insamlad information
  const previousVersionsText = previousVersions.length > 0
    ? `\n\nTidigare versioner för jämförelse:\n${previousVersions.map(v => `- ${v.version} (${v.publishedAt}): ${v.summary}`).join('\n')}`
    : '';

  const communityFeedbackText = communityFeedback
    ? `\n\nCommunity-feedback:\n${communityFeedback}`
    : '';

  const prompt = `Du är en teknisk skribent som skapar omfattande, underhållande tutorials för utvecklare. 

Skapa en engagerande tutorial på svenska för följande API-uppdatering:

**Provider:** ${release.provider}
**Namn:** ${release.name}
**Version:** ${release.version || 'N/A'}
**Publicerad:** ${release.publishedAt}
**Paketnamn:** ${packageName}

**Release notes:**
${releaseNotes || release.summary || 'Ingen information tillgänglig'}${previousVersionsText}${communityFeedbackText}

VIKTIGT: Skriv tutorialen på ett VÄLDIGT underhållande, engagerande sätt med tydlig ironi och humor som gör utvecklare upphetsade över uppdateringen. Fokusera på praktiska exempel och konkreta förbättringar. Inkludera flera kodexempel som visar olika användningsfall.

Tänk på: Tutorialen ska vara LÅNG, UNDERHÅLLANDE och FULLT AV IRONI. Var inte blygsam - gör det riktigt roligt att läsa! Varje sektion ska vara utförlig och engagerande.

Använd JavaScript/TypeScript för kodexemplen (Node.js SDK).`;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du är en teknisk skribent som skapar omfattande, underhållande tutorials för utvecklare. Svara alltid på svenska med strukturerad JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 4000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'tutorial_content',
          strict: true,
          schema: tutorialSchema as any
        }
      }
    });

    const parsedResponse = completion.choices[0]?.message?.parsed as TutorialContent | null;
    
    if (!parsedResponse) {
      console.error('Failed to parse tutorial content from OpenAI');
      return null;
    }

    // Lägg till ursprunglig release-URL i resources om den inte redan finns
    const hasReleaseUrl = parsedResponse.resources.some(r => r.url === release.url);
    if (!hasReleaseUrl) {
      parsedResponse.resources.push({
        title: 'Release notes',
        url: release.url
      });
    }

    return parsedResponse;
  } catch (error) {
    console.error(`Failed to generate tutorial content with AI:`, error);
    return null;
  }
}

/**
 * Konverterar TutorialContent till HTML
 */
function tutorialContentToHtml(content: TutorialContent): string {
  const sections: string[] = [];

  // Titel
  sections.push(`<h2>${sanitizeHtml(content.title)}</h2>`);

  // Introduktion
  sections.push(`<p>${sanitizeHtml(content.introduction)}</p>`);

  // Vad är nytt
  sections.push(`<h3>Vad är nytt?</h3>`);
  sections.push(`<p>${sanitizeHtml(content.whatsNew)}</p>`);

  // Förbättringar
  if (content.improvements.length > 0) {
    sections.push(`<h3>Förbättringar</h3>`);
    sections.push(`<ul>${content.improvements.map(imp => `<li>${sanitizeHtml(imp)}</li>`).join('')}</ul>`);
  }

  // Installation
  sections.push(`<h3>Installation</h3>`);
  sections.push(`<p>${sanitizeHtml(content.installation)}</p>`);

  // Kodexempel
  if (content.codeExamples.length > 0) {
    sections.push(`<h3>Kodexempel</h3>`);
    
    content.codeExamples.forEach((example, index) => {
      sections.push(`<h4>Exempel ${index + 1}: ${sanitizeHtml(example.title)}</h4>`);
      sections.push(`<p>${sanitizeHtml(example.description)}</p>`);
      sections.push(`<pre><code class="language-${sanitizeHtml(example.language)}">${sanitizeHtml(example.code)}</code></pre>`);
    });
  }

  // Community-recensioner
  if (content.communityReviews) {
    sections.push(`<h3>Vad säger communityn?</h3>`);
    sections.push(`<p>${sanitizeHtml(content.communityReviews)}</p>`);
  }

  // Resurser
  if (content.resources.length > 0) {
    sections.push(`<h3>Resurser och länkar</h3>`);
    sections.push(`<ul>${content.resources.map(res => 
      `<li><a href="${sanitizeHtml(res.url)}" rel="noopener" target="_blank">${sanitizeHtml(res.title)}</a></li>`
    ).join('')}</ul>`);
  }

  return sections.join('\n');
}

export async function createOrUpdateTutorial(postId: string, release: ProviderRelease) {
  // Försök generera AI-innehåll
  console.log(`🤖 Generating AI tutorial for ${release.name} ${release.version || ''}...`);
  const tutorialContent = await generateTutorialContent(release);

  let title: string;
  let html: string;

  if (tutorialContent) {
    // Använd AI-genererat innehåll
    title = tutorialContent.title;
    html = tutorialContentToHtml(tutorialContent);
  } else {
    // Fallback till minimalisk beskrivning om AI misslyckas
    console.warn(`⚠️ AI generation failed, using fallback for ${release.name}`);
    title = `Kom igång med ${release.name}${release.version ? ' ' + release.version : ''}`;
    html = sanitizeHtml(
      [
        `<h2>${title}</h2>`,
        `<p>I den här guiden går vi igenom det nya API:et från ${release.provider}.</p>`,
        `<h3>Förutsättningar</h3>`,
        `<ul><li>Konto hos leverantören</li><li>API-nyckel</li><li>Node.js 22+</li></ul>`,
        `<h3>Installation</h3>`,
        `<pre><code>npm i provider-sdk</code></pre>`,
        `<h3>Exempelkod</h3>`,
        `<pre><code>import Client from 'provider-sdk';\nconst client = new Client(process.env.PROVIDER_API_KEY);\nconst resp = await client.doSomething();\nconsole.log(resp);</code></pre>`,
        `<h3>Läs mer</h3>`,
        `<p><a href="${release.url}" rel="noopener" target="_blank">${release.url}</a></p>`
      ].join('\n')
    );
  }

  return await upsertTutorialForPost(postId, {
    title,
    content: html,
    url: release.url
  });
}
