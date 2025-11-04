import { buildLinkedInAuthUrl, exchangeCodeForTokens, storeTokens } from '../services/linkedinAuth.js';

export async function authorizeLinkedInHandler(_req: any, res: any) {
  const url = buildLinkedInAuthUrl();
  res.redirect(url);
}

export async function callbackLinkedInHandler(req: any, res: any) {
  try {
    const code = req.query?.code || req.body?.code;
    if (!code) return res.status(400).json({ ok: false, error: 'missing code' });
    const tokens = await exchangeCodeForTokens(String(code));
    await storeTokens(tokens);
    return res.status(200).json({ ok: true, stored: true, expires_at: tokens.expires_at, has_refresh: Boolean(tokens.refresh_token) });
  } catch (err: any) {
    console.error('linkedin oauth callback error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'oauth error' });
  }
}


