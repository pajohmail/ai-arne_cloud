import { withConn } from '../services/db.js';
import { slugify, sanitizeHtml } from '../utils/text.js';
import { ProviderRelease } from './providers.js';

export async function upsertNews(release: ProviderRelease) {
  const slug = slugify(`${release.provider}-${release.name}-${release.version || ''}`);
  const title = `[${release.provider.toUpperCase()}] ${release.name}${release.version ? ' ' + release.version : ''}`;
  const content = sanitizeHtml(
    [
      `<p><strong>${title}</strong></p>`,
      `<p>${release.summary}</p>`,
      `<p>Källa: <a href="${release.url}" rel="noopener" target="_blank">${release.url}</a></p>`
    ].join('')
  );

  return await withConn(async (conn) => {
    const [rows] = await conn.query('SELECT id FROM posts WHERE slug = ?', [slug]);
    if ((rows as any[]).length > 0) {
      const id = (rows as any[])[0].id;
      await conn.query('UPDATE posts SET title=?, content=?, provider=?, source_url=? WHERE id=?', [
        title,
        content,
        release.provider,
        release.url,
        id
      ]);
      return { id, slug, updated: true };
    } else {
      const [res] = await conn.query(
        'INSERT INTO posts (slug, title, excerpt, content, provider, source_url) VALUES (?, ?, ?, ?, ?, ?)',
        [slug, title, release.summary.slice(0, 280), content, release.provider, release.url]
      );
      return { id: (res as any).insertId as number, slug, updated: false };
    }
  });
}
