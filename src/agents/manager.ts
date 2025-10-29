import { checkProviders } from './providers.js';
import { upsertNews } from './newsAgent.js';
import { createOrUpdateTutorial } from './tutorialAgent.js';
import { postToLinkedIn } from '../services/linkedin.js';

export async function runApiNewsManager({ force = false }: { force?: boolean } = {}) {
  const releases = await checkProviders();
  if (!releases.length) return { processed: 0 };

  let processed = 0;
  for (const rel of releases.slice(0, 3)) {
    const news = await upsertNews(rel);
    await createOrUpdateTutorial(news.id, rel);

    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://ai-arne.se';
    const postUrl = `${baseUrl}/post/${news.slug}`;

    const text = [
      `${rel.provider.toUpperCase()} nyhet: ${rel.name}${rel.version ? ' ' + rel.version : ''}`,
      '',
      rel.summary,
      '',
      `Läs mer: ${postUrl}`
    ].join('\n');

    await postToLinkedIn(
      {
        organizationUrn: process.env.LINKEDIN_ORG_URN!,
        text,
        title: `Nyhet: ${rel.name}`,
        link: postUrl
      },
      process.env.LINKEDIN_ACCESS_TOKEN!
    );

    processed++;
  }

  return { processed };
}
