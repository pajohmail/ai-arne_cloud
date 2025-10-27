import { withConn } from '../services/db.js';
import { sanitizeHtml } from '../utils/text.js';
import type { ProviderRelease } from './providers.js';

export async function createOrUpdateTutorial(postId: number, release: ProviderRelease) {
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

  return await withConn(async (conn) => {
    const [rows] = await conn.query('SELECT id FROM tutorials WHERE post_id = ?', [postId]);
    if ((rows as any[]).length > 0) {
      const id = (rows as any[])[0].id;
      await conn.query('UPDATE tutorials SET title=?, content=?, source_url=? WHERE id=?', [
        title,
        html,
        release.url,
        id
      ]);
      return { id, updated: true };
    } else {
      const [res] = await conn.query(
        'INSERT INTO tutorials (post_id, title, content, source_url) VALUES (?, ?, ?, ?)',
        [postId, title, html, release.url]
      );
      return { id: (res as any).insertId as number, updated: false };
    }
  });
}
