import { sanitizeHtml } from '../utils/text.js';
import type { ProviderRelease } from './providers.js';
import { upsertTutorialForPost } from '../services/upsert.js';

export async function createOrUpdateTutorial(postId: string, release: ProviderRelease) {
  const title = `Kom igång med ${release.name}${release.version ? ' ' + release.version : ''}`;
  const html = sanitizeHtml(
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

  return await upsertTutorialForPost(postId, {
    title,
    content: html,
    url: release.url
  });
}
