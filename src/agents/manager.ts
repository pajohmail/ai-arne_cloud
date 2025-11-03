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

    // Hoppa över LinkedIn om credentials är placeholders eller saknas
    const linkedinToken = process.env.LINKEDIN_ACCESS_TOKEN;
    const linkedinUrn = process.env.LINKEDIN_ORG_URN;
    
    if (linkedinToken && linkedinUrn && 
        linkedinToken !== 'placeholder' && 
        linkedinUrn !== 'urn:li:organization:0' &&
        !linkedinUrn.includes('123456789')) {
      try {
        const text = [
          `${rel.provider.toUpperCase()} nyhet: ${rel.name}${rel.version ? ' ' + rel.version : ''}`,
          '',
          rel.summary,
          '',
          `Läs mer: ${postUrl}`
        ].join('\n');

        await postToLinkedIn(
          {
            organizationUrn: linkedinUrn,
            text,
            title: `Nyhet: ${rel.name}`,
            link: postUrl
          },
          linkedinToken
        );
      } catch (error) {
        console.error(`Failed to post to LinkedIn for ${rel.provider}:`, error);
        // Fortsätt ändå, inte kritiskt
      }
    } else {
      console.log(`Skipping LinkedIn post for ${rel.provider} (credentials not configured)`);
    }

    processed++;
  }

  return { processed };
}
