// api/workspace.js — save and load encrypted workspace config
//
// WHY SERVER-SIDE:
// We need to verify the user's Firebase token before allowing them to
// save/load config. We do this by calling Firebase's token verification API.
// This can only be done safely on the server — never trust the browser to
// verify its own tokens.
//
// ROUTES:
//   POST /api/workspace  { token, encryptedConfig }  → save config
//   GET  /api/workspace?token=xxx                    → load config

const PROJECT_ID = 'janunet-cloud';
const FIRESTORE  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Verify Firebase ID token and return UID
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
  return data.users[0].localId; // this is the Firebase UID
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      // Save encrypted config
      const { token, encryptedConfig } = req.body;
      if (!token || !encryptedConfig) {
        return res.status(400).json({ error: 'Missing token or encryptedConfig' });
      }

      const uid = await verifyToken(token);

      // Store encrypted config in Firestore under the user's document
      const url  = `${FIRESTORE}/janu_users/${uid}?updateMask.fieldPaths=workspaceConfig`;
      const body = JSON.stringify({
        fields: {
          workspaceConfig: { stringValue: encryptedConfig }
        }
      });

      const fsRes = await fetch(url, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      if (!fsRes.ok) throw new Error('Failed to save config');
      return res.status(200).json({ ok: true });

    } else if (req.method === 'GET') {
      // Load encrypted config
      const token = req.query.token;
      if (!token) return res.status(400).json({ error: 'Missing token' });

      const uid   = await verifyToken(token);
      const fsRes = await fetch(`${FIRESTORE}/janu_users/${uid}`);

      if (!fsRes.ok) return res.status(404).json({ error: 'User not found' });
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
