// FirestoreAdapter — uses Firestore REST API.
// Works in both Vercel serverless (Node) and the browser (no SDK needed).
//
// For authenticated writes (from the browser portal), pass a getAuthToken()
// function via the config — it should return a fresh Firebase ID token.
// Server-side usage (Vercel APIs) can skip it; reads work without auth.

import { StorageAdapter } from './StorageAdapter.js';

const DEFAULT_PROJECT_ID = 'janunet-cloud';

export class FirestoreAdapter extends StorageAdapter {
  constructor({ projectId = DEFAULT_PROJECT_ID, getAuthToken = null } = {}) {
    super();
    this.projectId    = projectId;
    this.getAuthToken = getAuthToken; // async function returning a token, or null
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  }

  get backendName() { return 'firestore'; }

  // ── Internal: build headers, with auth if available ──
  async _headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (this.getAuthToken) {
      try {
        const tok = await this.getAuthToken();
        if (tok) h['Authorization'] = 'Bearer ' + tok;
      } catch (e) { /* token unavailable — proceed without */ }
    }
    return h;
  }

  // ── Domains ──

  async getDomain(name) {
    const safe = String(name).toLowerCase();
    const res  = await fetch(`${this.base}/janu_domains/${encodeURIComponent(safe)}`, {
      headers: await this._headers()
    });
    if (!res.ok) return null;
    const doc  = await res.json();
    return this._unpackDomain(safe, doc);
  }

  async listAllDomains() {
    const res = await fetch(`${this.base}/janu_domains`, {
      headers: await this._headers()
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.documents) return [];
    return data.documents.map(d => {
      const name = d.name.split('/').pop();
      return this._unpackDomain(name, d);
    });
  }

  async listDomainsByOwner(email) {
    const q = {
      structuredQuery: {
        from:  [{ collectionId: 'janu_domains' }],
        where: {
          fieldFilter: {
            field:  { fieldPath: 'ownerEmail' },
            op:     'EQUAL',
            value:  { stringValue: email }
          }
        }
      }
    };
    const res = await fetch(`${this.base}:runQuery`, {
      method:  'POST',
      headers: await this._headers(),
      body:    JSON.stringify(q)
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return rows
      .filter(r => r.document)
      .map(r => {
        const name = r.document.name.split('/').pop();
        return this._unpackDomain(name, r.document);
      });
  }

  async createDomain(data) {
    const name   = String(data.name).toLowerCase();
    const exists = await this.getDomain(name);
    if (exists) throw new Error('Domain already taken');

    const body = {
      fields: {
        targetUrl:      { stringValue:  data.targetUrl },
        ownerEmail:     { stringValue:  data.ownerEmail },
        ownerName:      { stringValue:  data.ownerName      || '' },
        ownerUid:       { stringValue:  data.ownerUid       || '' },
        storageBackend: { stringValue:  data.storageBackend || 'janunet' },
        storageRef:     { stringValue:  data.storageRef     || '' },
        storageProject: { stringValue:  data.storageProject || '' },
        visits:         { integerValue: '0' },
        createdAt:      { integerValue: String(data.createdAt || Date.now()) }
      }
    };

    const res = await fetch(
      `${this.base}/janu_domains?documentId=${encodeURIComponent(name)}`,
      {
        method:  'POST',
        headers: await this._headers(),
        body:    JSON.stringify(body)
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error('createDomain failed: ' + err);
    }
    return await this.getDomain(name);
  }

  async deleteDomain(name) {
    const safe = String(name).toLowerCase();
    const res  = await fetch(`${this.base}/janu_domains/${encodeURIComponent(safe)}`, {
      method:  'DELETE',
      headers: await this._headers()
    });
    return res.ok;
  }

  async incrementVisits(name) {
    const safe    = String(name).toLowerCase();
    const current = await this.getDomain(safe);
    if (!current) return null;
    const next    = (current.visits || 0) + 1;

    const url = `${this.base}/janu_domains/${encodeURIComponent(safe)}?updateMask.fieldPaths=visits`;
    await fetch(url, {
      method:  'PATCH',
      headers: await this._headers(),
      body:    JSON.stringify({ fields: { visits: { integerValue: String(next) } } })
    });
    return next;
  }

  // ── Users ──

  async getUser(uid) {
    const res = await fetch(`${this.base}/janu_users/${encodeURIComponent(uid)}`, {
      headers: await this._headers()
    });
    if (!res.ok) return null;
    const doc = await res.json();
    return {
      uid,
      email:    doc.fields?.email?.stringValue    || '',
      username: doc.fields?.username?.stringValue || ''
    };
  }

  async createUser(uid, profile) {
    const body = {
      fields: {
        email:    { stringValue: profile.email    || '' },
        username: { stringValue: profile.username || '' }
      }
    };
    const res = await fetch(
      `${this.base}/janu_users?documentId=${encodeURIComponent(uid)}`,
      {
        method:  'POST',
        headers: await this._headers(),
        body:    JSON.stringify(body)
      }
    );
    return res.ok;
  }

  // ── Internal: Firestore doc → normalized shape ──

  _unpackDomain(name, doc) {
    const f = doc.fields || {};
    return {
      name,
      targetUrl:  f.targetUrl?.stringValue   || '',
      ownerEmail: f.ownerEmail?.stringValue  || '',
      ownerName:  f.ownerName?.stringValue   || '',
      ownerUid:   f.ownerUid?.stringValue    || null,
      visits:     parseInt(f.visits?.integerValue    || '0', 10),
      createdAt:  f.createdAt?.integerValue ? parseInt(f.createdAt.integerValue, 10) : null
    };
  }
}
