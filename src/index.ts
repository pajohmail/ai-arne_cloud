import { runApiNewsManager } from './agents/manager.js';
import { runGeneralNewsManager } from './agents/generalNewsManager.js';

export async function apiNewsHandler(req: any, res: any) {
  try {
    const force = req.query?.force === '1' || req.body?.force === true;
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
    const result = await runGeneralNewsManager({ force });
    return res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
}

// Behåll för bakåtkompatibilitet - kör både API-nyheter och generella nyheter
export async function managerHandler(req: any, res: any) {
  try {
    const force = req.query?.force === '1' || req.body?.force === true;
    
    // Kör både API-nyheter och generella nyheter
    const [apiResult, generalResult] = await Promise.allSettled([
      runApiNewsManager({ force }),
      runGeneralNewsManager({ force })
    ]);
    
    const apiNews = apiResult.status === 'fulfilled' ? apiResult.value : { processed: 0, error: apiResult.reason?.message };
    const generalNews = generalResult.status === 'fulfilled' ? generalResult.value : { processed: 0, error: generalResult.reason?.message };
    
    return res.status(200).json({ 
      ok: true, 
      apiNews: apiNews,
      generalNews: generalNews,
      totalProcessed: (apiNews.processed || 0) + (generalNews.processed || 0)
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
}
