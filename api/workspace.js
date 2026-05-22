// api/workspace.js — save and load encrypted workspace config
// SECURITY: We verify the Firebase token first, then use it to
// authenticate our Firestore write. This satisfies the Firestore
// rule: allow write: if request.auth != null

const PROJECT_ID = 'janunet-cloud';
const FIRESTORE  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function verifyToken(token) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken: token })
    }
  );
  if (!res.ok) throw new Error('Token verification failed');
  const data = await res.json();
  if (!data.users?.length) throw new Error('User not found');
  return data.users[0].localId;
}

export default async function handler(req, res) {
  try {

    if (req.method === 'POST') {
      const { token, encryptedConfig, publicConfig } = req.body;
      if (!token || !encryptedConfig) {
        return res.status(400).json({ error: 'Missing token or encryptedConfig' });
      }

      const uid = await verifyToken(token);

      const authHeaders = {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      };

      // ── Step 1: Save encrypted config ──
      let fsRes = await fetch(
        `${FIRESTORE}/janu_users/${uid}?updateMask.fieldPaths=workspaceConfig`,
        {
          method:  'PATCH',
          headers: authHeaders,
          body:    JSON.stringify({
            fields: { workspaceConfig: { stringValue: encryptedConfig } }
          })
        }
      );

      // If doc doesn't exist yet, create it
      if (fsRes.status === 404 || fsRes.status === 400) {
        fsRes = await fetch(
          `${FIRESTORE}/janu_users?documentId=${uid}`,
          {
            method:  'POST',
            headers: authHeaders,
            body:    JSON.stringify({
              fields: { workspaceConfig: { stringValue: encryptedConfig } }
            })
          }
        );
      }

      if (!fsRes.ok) {
        const errText = await fsRes.text();
        console.error('Firestore write error:', fsRes.status, errText);
        return res.status(500).json({ error: 'Failed to save config: ' + fsRes.status });
      }

      // ── Step 2: Save public backend config into janu_users/{uid} ──
      // anon key is public by design — secured by Supabase RLS policies
      // We store it here so /d/{uid}/{domain} public URLs can resolve the backend
      if (publicConfig) {
        const pubFields = {
          publicBackend: { stringValue: publicConfig.backend }
        };
        if (publicConfig.url)       pubFields.publicSupabaseUrl          = { stringValue: publicConfig.url };
        if (publicConfig.anonKey)   pubFields.publicSupabaseAnonKey      = { stringValue: publicConfig.anonKey };
        if (publicConfig.projectId) pubFields.publicFirestoreProjectId   = { stringValue: publicConfig.projectId };
        // Extract project ref from URL: https://REF.supabase.co → REF
        if (publicConfig.url) {
          const supaRef = publicConfig.url.replace('https://', '').split('.')[0];
          pubFields.publicSupabaseRef = { stringValue: supaRef };
        }

        const mask = Object.keys(pubFields)
          .map(k => `updateMask.fieldPaths=${k}`)
          .join('&');

        const pubRes = await fetch(`${FIRESTORE}/janu_users/${uid}?${mask}`, {
          method:  'PATCH',
          headers: authHeaders,
          body:    JSON.stringify({ fields: pubFields })
        });

        if (!pubRes.ok) {
          // Log but don't fail the whole request — encrypted config already saved
          console.warn('publicBackend save failed:', pubRes.status, await pubRes.text().catch(() => ''));
        } else {
          console.log('publicBackend saved for uid:', uid, 'backend:', publicConfig.backend);
        }
      }

      return res.status(200).json({ ok: true });

    } else if (req.method === 'GET') {
      const token = req.query.token;
      if (!token) return res.status(400).json({ error: 'Missing token' });

      const uid   = await verifyToken(token);
      const fsRes = await fetch(`${FIRESTORE}/janu_users/${uid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!fsRes.ok) return res.status(200).json({ encryptedConfig: null });
      const doc = await fsRes.json();
      const cfg = doc.fields?.workspaceConfig?.stringValue || null;

      return res.status(200).json({ encryptedConfig: cfg });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch(e) {
    console.error('workspace error:', e);
    return res.status(500).json({ error: e.message });
  }
}
