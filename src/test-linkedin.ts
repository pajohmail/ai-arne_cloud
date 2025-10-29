import { exchangeCodeForAccessToken, validateLinkedInToken, listAdminOrganizations } from './services/linkedin.js';

async function main() {
  const cmd = process.argv[2] || 'status';

  if (cmd === 'exchange') {
    const code = process.argv[3];
    if (!code) {
      console.error('Usage: tsx src/test-linkedin.ts exchange <AUTH_CODE>');
      process.exit(1);
    }
    const res = await exchangeCodeForAccessToken({ code });
    console.log('Access token response:', res);
    return;
  }

  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    console.error('LINKEDIN_ACCESS_TOKEN is not set. Provide an access token to validate.');
    process.exit(1);
  }

  if (cmd === 'status') {
    const res = await validateLinkedInToken(token);
    console.log('Token valid. Me:', res.data?.localizedFirstName || res.data);
    return;
  }

  if (cmd === 'orgs') {
    const orgs = await listAdminOrganizations(token);
    console.log('Admin organizations:', orgs);
    return;
  }

  console.error('Unknown command. Use one of: status | orgs | exchange <AUTH_CODE>');
  process.exit(1);
}

main().catch((e) => {
  console.error('Error:', e?.response?.data || e);
  process.exit(1);
});
