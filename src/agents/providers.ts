import axios from 'axios';

export type ProviderRelease = {
  provider: 'openai' | 'google' | 'anthropic' | 'mistral' | 'perplexity' | 'other';
  name: string;
  version?: string;
  kind: 'api' | 'model' | 'sdk';
  publishedAt: string;
  url: string;
  summary: string;
};

async function fetchOpenAI(): Promise<ProviderRelease[]> {
  const url = 'https://api.github.com/repos/openai/openai-node/releases?per_page=5';
  const { data } = await axios.get(url, { timeout: 15000 });
  return data.map((r: any) => ({
    provider: 'openai',
    name: r.name || 'OpenAI API update',
    kind: 'sdk',
    version: r.tag_name,
    publishedAt: r.published_at,
    url: r.html_url,
    summary: r.body?.slice(0, 300) || 'Update'
  }));
}

async function fetchGoogle(): Promise<ProviderRelease[]> {
  const url = 'https://api.github.com/repos/google-gemini/generative-ai-js/releases?per_page=5';
  const { data } = await axios.get(url, { timeout: 15000 });
  return data.map((r: any) => ({
    provider: 'google',
    name: r.name || 'Gemini API update',
    kind: 'sdk',
    version: r.tag_name,
    publishedAt: r.published_at,
    url: r.html_url,
    summary: r.body?.slice(0, 300) || 'Update'
  }));
}


async function fetchAnthropic(): Promise<ProviderRelease[]> {
  const url = 'https://api.github.com/repos/anthropics/anthropic-sdk-typescript/releases?per_page=5';
  const { data } = await axios.get(url, { timeout: 15000 });
  return data.map((r: any) => ({
    provider: 'anthropic',
    name: r.name || 'Anthropic SDK update',
    kind: 'sdk',
    version: r.tag_name,
    publishedAt: r.published_at,
    url: r.html_url,
    summary: r.body?.slice(0, 300) || 'Update'
  }));
}

export async function checkProviders(): Promise<ProviderRelease[]> {
  const results = await Promise.allSettled([fetchOpenAI(), fetchGoogle(), fetchAnthropic()]);
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap((r: PromiseFulfilledResult<ProviderRelease[]>) => r.value)
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
}
