import { runApiNewsManager } from './agents/manager.js';
import { runGeneralNewsManager } from './agents/generalNewsManager.js';
import { isBiweeklyTrigger } from './utils/time.js';
import { authorizeLinkedInHandler, callbackLinkedInHandler } from './handlers/linkedinAuth.js';
import { verifyFirestoreHandler } from './handlers/verify.js';

export async function apiNewsHandler(req: any, res: any) {
  try {
    const force = req.query?.force === '1' || req.body?.force === true;
    if (!force && !isBiweeklyTrigger(new Date())) {
      return res.status(200).json({ skipped: true, reason: 'not biweekly window' });
    }
    const result = await runApiNewsManager({ force });
    return res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
}

export async function generalNewsHandler(req: any, res: any) {
  try {
    const force = req.query?.force === '1' || req.body?.force === true;
    if (!force && !isBiweeklyTrigger(new Date())) {
      return res.status(200).json({ skipped: true, reason: 'not biweekly window' });
    }
    const result = await runGeneralNewsManager({ force });
    return res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
}

// Behåll för bakåtkompatibilitet
export async function managerHandler(req: any, res: any) {
  return apiNewsHandler(req, res);
}

// OAuth endpoints
export async function authLinkedIn(req: any, res: any) {
  return authorizeLinkedInHandler(req, res);
}

export async function authLinkedInCallback(req: any, res: any) {
  return callbackLinkedInHandler(req, res);
}

// Verification endpoint for Firestore
export async function verifyFirestore(req: any, res: any) {
  return verifyFirestoreHandler(req, res);
}
