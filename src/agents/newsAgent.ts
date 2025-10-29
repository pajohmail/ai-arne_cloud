import { ProviderRelease } from './providers.js';
import { upsertPostFromRelease } from '../services/upsert.js';

export async function upsertNews(release: ProviderRelease) {
  return await upsertPostFromRelease({
    provider: release.provider,
    name: release.name,
    version: release.version,
    summary: release.summary,
    url: release.url
  });
}
