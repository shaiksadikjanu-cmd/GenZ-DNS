// StorageAdapter — the contract every storage backend must fulfill.
// Implementations: FirestoreAdapter (today), SupabaseAdapter (later), etc.
//
// All methods return Promises. All return shapes are normalized so calling
// code never sees backend-specific quirks (Firestore's typed values,
// Supabase's PostgREST envelopes, etc.).
//
// Normalized domain shape:
// {
//   name:       "janujulie.com",
//   targetUrl:  "https://...",
//   ownerEmail: "user@x.com",
//   ownerName:  "Shaik Janu",
//   ownerUid:   "abc123" | null,
//   visits:     42,
//   createdAt:  1716400000000 | null
// }
//
// Normalized user shape:
// { uid, email, username }

export class StorageAdapter {
  // ── Domains ──
  async getDomain(name)              { throw new Error('not implemented'); }
  async listAllDomains()             { throw new Error('not implemented'); }
  async listDomainsByOwner(email)    { throw new Error('not implemented'); }
  async createDomain(data)           { throw new Error('not implemented'); }
  async deleteDomain(name)           { throw new Error('not implemented'); }
  async incrementVisits(name)        { throw new Error('not implemented'); }

  // ── Users ──
  async getUser(uid)                 { throw new Error('not implemented'); }
  async createUser(uid, profile)     { throw new Error('not implemented'); }

  // ── Identity ──
  get backendName() { return 'unknown'; }
}
