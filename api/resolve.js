// api/resolve.js — unified domain resolution across all backends
//
// WHY THIS EXISTS:
// The extension doesn't know which storage backend a domain lives in.
// This endpoint abstracts that — it checks all registered backends
// and returns the domain data wherever it finds it.
//
// For now: checks JanuNet Firestore only (phase 1).
// Phase 2: checks BYOS backends registered by users.
//
// GET /api/resolve?domain=julie.ai

import { getStorage } from '../public/lib/storage/index.js';

export default async function handler(req, res) {
  const { domain } = req.query;

  if (!domain) {
    return res.status(400).json({ error: 'Missing domain parameter' });
  }

  const storage = getStorage();

  try {
    const result = await storage.getDomain(domain);
    if (!result) {
      return res.status(404).json({ error: 'Domain not found' });
    }
    return res.status(200).json({
      name:      result.name,
      targetUrl: result.targetUrl,
      ownerName: result.ownerName,
      visits:    result.visits
    });
  } catch(e) {
    console.error('resolve error:', e);
    return res.status(500).json({ error: 'Resolution failed' });
  }
}
