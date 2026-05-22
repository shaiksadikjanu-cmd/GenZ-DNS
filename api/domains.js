// api/domains.js — returns all domains for autocomplete in the extension
// GET /api/domains

import { getStorage } from '../public/lib/storage/index.js';

export default async function handler(req, res) {
  try {
    const storage = getStorage();
    const domains = await storage.listAllDomains();
    return res.status(200).json(domains.map(d => ({
      name:      d.name,
      targetUrl: d.targetUrl,
      ownerName: d.ownerName,
      visits:    d.visits
    })));
  } catch(e) {
    console.error('domains list error:', e);
    return res.status(500).json({ error: 'Failed to list domains' });
  }
}
