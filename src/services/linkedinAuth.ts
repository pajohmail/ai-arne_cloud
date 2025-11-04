import axios from 'axios';
import { getSecret, setSecret, SECRET_IDS } from './secrets.js';

const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';

export function buildLinkedInAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    scope: 'w_organization_social offline_access'
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!
  });
  const { data } = await axios.post(
    TOKEN_URL,
    body.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
  );
  // data: { access_token, expires_in, refresh_token? }
  const expiresAt = Date.now() + (Number(data.expires_in || 0) * 1000);
  return { access_token: data.access_token as string, refresh_token: data.refresh_token as string | undefined, expires_at: expiresAt };
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!
  });
  const { data } = await axios.post(
    TOKEN_URL,
    body.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
  );
  const expiresAt = Date.now() + (Number(data.expires_in || 0) * 1000);
  return { access_token: data.access_token as string, refresh_token: data.refresh_token as string | undefined, expires_at: expiresAt };
}

export async function storeTokens({ access_token, refresh_token, expires_at }: { access_token: string; refresh_token?: string; expires_at: number; }) {
  await setSecret(SECRET_IDS.linkedinAccessToken, access_token);
  if (refresh_token) await setSecret(SECRET_IDS.linkedinRefreshToken, refresh_token);
  await setSecret(SECRET_IDS.linkedinTokenMeta, JSON.stringify({ expires_at }));
}

export async function getLinkedInAccessToken(): Promise<string | undefined> {
  // Prefer Secret Manager
  const access = await getSecret(SECRET_IDS.linkedinAccessToken);
  const metaRaw = await getSecret(SECRET_IDS.linkedinTokenMeta);
  const refresh = await getSecret(SECRET_IDS.linkedinRefreshToken);

  if (!access) return process.env.LINKEDIN_ACCESS_TOKEN; // fallback to env

  // If expiring within 2 minutes, try refresh
  try {
    const meta = metaRaw ? JSON.parse(metaRaw) : {};
    const expiresAt = Number(meta?.expires_at || 0);
    const aboutToExpire = expiresAt && Date.now() > (expiresAt - 2 * 60 * 1000);
    if (aboutToExpire && refresh) {
      const tokens = await refreshAccessToken(refresh);
      await storeTokens(tokens);
      return tokens.access_token;
    }
  } catch {
    // ignore parsing errors
  }

  return access;
}


