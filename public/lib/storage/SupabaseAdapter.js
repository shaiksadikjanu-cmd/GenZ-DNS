import { StorageAdapter } from './StorageAdapter.js';

export class SupabaseAdapter extends StorageAdapter {
  constructor({ url, anonKey, getAuthToken = null } = {}) {
    super();
    if (!url || !anonKey) throw new Error('SupabaseAdapter requires { url, anonKey }');
    this.url          = url.replace(/\/$/, '');
    this.anonKey      = anonKey;
    this.getAuthToken = getAuthToken;
    this.base         = `${this.url}/rest/v1`;
  }

  get backendName() { return 'supabase'; }

  async _headers(extra = {}) {
    const h = {
      'apikey':        this.anonKey,
      'Authorization': `Bearer ${this.anonKey}`,
      'Content-Type':  'application/json',
      ...extra
    };
    if (this.getAuthToken) {
      try {
        const tok = await this.getAuthToken();
        if (tok) h['Authorization'] = `Bearer ${tok}`;
      } catch(e) {}
    }
    return h;
  }

  async getDomain(name) {
    const safe = String(name).toLowerCase();
    const res  = await fetch(
      `${this.base}/janu_domains?name=eq.${encodeURIComponent(safe)}&select=*`,
      { headers: await this._headers() }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.length ? this._unpack(rows[0]) : null;
  }

  async listAllDomains() {
    const res = await fetch(
      `${this.base}/janu_domains?select=*&order=created_at.desc`,
      { headers: await this._headers() }
    );
    if (!res.ok) return [];
    return (await res.json()).map(r => this._unpack(r));
  }

  async listDomainsByOwner(email) {
    const res = await fetch(
      `${this.base}/janu_domains?owner_email=eq.${encodeURIComponent(email)}&select=*`,
      { headers: await this._headers() }
    );
    if (!res.ok) return [];
    return (await res.json()).map(r => this._unpack(r));
  }

  async createDomain(data) {
    const name   = String(data.name).toLowerCase();
    const exists = await this.getDomain(name);
    if (exists) throw new Error('Domain already taken');

    const res = await fetch(`${this.base}/janu_domains`, {
      method:  'POST',
      headers: await this._headers({ 'Prefer': 'return=representation' }),
      body:    JSON.stringify({
        name,
        target_url:      data.targetUrl,
        owner_email:     data.ownerEmail,
        owner_name:      data.ownerName      || '',
        owner_uid:       data.ownerUid       || '',
        storage_backend: data.storageBackend || 'supabase',
        storage_ref:     data.storageRef     || '',
        storage_project: data.storageProject || '',
        visits:          0,
        created_at:      data.createdAt || Date.now()
      })
    });
    if (!res.ok) throw new Error('createDomain failed: ' + await res.text());
    return this._unpack((await res.json())[0]);
  }

  async deleteDomain(name) {
    const safe = String(name).toLowerCase();
    const res  = await fetch(
      `${this.base}/janu_domains?name=eq.${encodeURIComponent(safe)}`,
      { method: 'DELETE', headers: await this._headers() }
    );
    return res.ok;
  }

  async incrementVisits(name) {
    const safe    = String(name).toLowerCase();
    const current = await this.getDomain(safe);
    if (!current) return null;
    const next    = (current.visits || 0) + 1;
    const res     = await fetch(
      `${this.base}/janu_domains?name=eq.${encodeURIComponent(safe)}`,
      {
        method:  'PATCH',
        headers: await this._headers(),
        body:    JSON.stringify({ visits: next })
      }
    );
    return res.ok ? next : null;
  }

  async getUser(uid) {
    const res = await fetch(
      `${this.base}/janu_users?uid=eq.${encodeURIComponent(uid)}&select=*`,
      { headers: await this._headers() }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.length ? { uid: rows[0].uid, email: rows[0].email, username: rows[0].username } : null;
  }

  async createUser(uid, profile) {
    const res = await fetch(`${this.base}/janu_users`, {
      method:  'POST',
      headers: await this._headers(),
      body:    JSON.stringify({ uid, email: profile.email || '', username: profile.username || '' })
    });
    return res.ok;
  }

  _unpack(row) {
    return {
      name:           row.name,
      targetUrl:      row.target_url      || '',
      ownerEmail:     row.owner_email     || '',
      ownerName:      row.owner_name      || '',
      ownerUid:       row.owner_uid       || null,
      storageBackend: row.storage_backend || 'supabase',
      storageRef:     row.storage_ref     || null,
      storageProject: row.storage_project || null,
      visits:         parseInt(row.visits || 0, 10),
      createdAt:      row.created_at      ? parseInt(row.created_at, 10) : null
    };
  }
}
