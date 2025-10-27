import axios from 'axios';

type LinkedInPostArgs = {
  organizationUrn: string;
  text: string;
  title?: string;
  link?: string;
};

export async function postToLinkedIn(args: LinkedInPostArgs, accessToken = process.env.LINKEDIN_ACCESS_TOKEN!) {
  const { organizationUrn, text, title, link } = args;

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
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  return data;
}
