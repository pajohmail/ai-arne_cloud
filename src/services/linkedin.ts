import axios from 'axios';
import { getLinkedInAccessToken } from './linkedinAuth.js';

type LinkedInPostArgs = {
  organizationUrn: string;
  text: string;
  title?: string;
  link?: string;
};

export async function postToLinkedIn(args: LinkedInPostArgs, accessToken?: string) {
  const { organizationUrn, text, title, link } = args;
  const token = accessToken || (await getLinkedInAccessToken()) || process.env.LINKEDIN_ACCESS_TOKEN!;

  const payload = {
    author: organizationUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: link ? 'ARTICLE' : 'NONE',
        media: link
          ? [
              {
                status: 'READY',
                originalUrl: link,
                title: title ? { text: title } : undefined
              }
            ]
          : undefined
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };

  const { data } = await axios.post('https://api.linkedin.com/v2/ugcPosts', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  return data;
}

/**
 * Byter OAuth authorization code mot access token
 */
export async function exchangeCodeForAccessToken(params: {
  code: string;
  redirectUri?: string;
  clientId?: string;
  clientSecret?: string;
}) {
  const redirectUri = params.redirectUri || process.env.LINKEDIN_REDIRECT_URI!;
  const clientId = params.clientId || process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = params.clientSecret || process.env.LINKEDIN_CLIENT_SECRET!;

  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', params.code);
  body.set('redirect_uri', redirectUri);
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);

  const { data } = await axios.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    body.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
  );

  return data as { access_token: string; expires_in: number; refresh_token?: string };
}

/**
 * Validerar access token mot LinkedIn API
 */
export async function validateLinkedInToken(accessToken = process.env.LINKEDIN_ACCESS_TOKEN!) {
  const { status, data } = await axios.get('https://api.linkedin.com/v2/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0'
    },
    timeout: 10000
  });
  return { status, data };
}

/**
 * Hämtar organisationer där användaren är administratör, för att få ORN ID
 */
export async function listAdminOrganizations(accessToken = process.env.LINKEDIN_ACCESS_TOKEN!) {
  const url = 'https://api.linkedin.com/v2/organizationalEntityAcls';
  const { data } = await axios.get(url, {
    params: {
      q: 'roleAssignee',
      role: 'ADMINISTRATOR',
      projection: '(elements*(*,organization~(id,localizedName)))'
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0'
    },
    timeout: 15000
  });

  // Returnera lista av { urn, id, name }
  const elements = (data?.elements || []).map((el: any) => {
    const org = el['organization~'] || {};
    return {
      urn: el?.organization || (org?.id ? `urn:li:organization:${org.id}` : undefined),
      id: org?.id,
      name: org?.localizedName
    };
  });

  return elements;
}
