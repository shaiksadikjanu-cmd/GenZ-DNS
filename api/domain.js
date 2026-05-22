// api/domain.js — public domain viewer page
// Handles: /domains/:user/:domain  (rewritten via vercel.json to /api/domain)
// Storage access goes through the adapter — backend-agnostic.

import { getStorage } from '../public/lib/storage/index.js';

export default async function handler(req, res) {
  const domainName = req.query.domain;
  const ownerUser  = req.query.user;
  const backend   = req.query.backend   || 'janunet';
  const uid       = req.query.uid       || null;
  const projectId = req.query.projectId || null;

  if (!domainName) {
    return res.status(400).send(errorPage('No domain specified.'));
  }

  let storage;
  if (backend === 'supabase' && uid) {
    // Look up user's Supabase credentials by UID
    storage = await getUserSupabase(uid);
    if (!storage) {
      return res.status(404).send(errorPage('No Supabase workspace found for this user.'));
    }
  } else if (backend === 'firebase' && projectId) {
    // Firebase project IDs are public — direct connect
    const { FirestoreAdapter } = await import('../public/lib/storage/FirestoreAdapter.js');
    storage = new FirestoreAdapter({ projectId });
  } else {
    storage = getStorage();
  }
  let domain;
  try {
    domain = await storage.getDomain(domainName);
  } catch (e) {
    console.error('storage error:', e);
    return res.status(500).send(errorPage('Could not reach the JanuNet cloud.'));
  }

  if (!domain) {
    return res.status(404).send(errorPage(`Domain not found: ${domainName}`));
  }

  // Increment visit count (fire-and-forget — we don't block the page on it)
  storage.incrementVisits(domainName).catch(() => {});

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(viewerPage({
    domainName: domain.name,
    targetUrl:  domain.targetUrl,
    visits:     domain.visits + 1, // optimistic: show the visit we just incremented
    ownerName:  domain.ownerName || ownerUser || 'unknown'
  }));
}

// Look up user's custom backend config from our Firestore
// Look up a user's Supabase credentials from our Firestore
// (publicBackend fields are public — anon key is public by design)
async function getUserSupabase(uid) {
  const PROJECT_ID = 'janunet-cloud';
  const FIRESTORE  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

  const res = await fetch(`${FIRESTORE}/janu_users/${uid}`);
  if (!res.ok) return null;

  const doc = await res.json();
  const f   = doc.fields || {};

  const backend = f.publicBackend?.stringValue;
  if (backend !== 'supabase') return null;

  const url     = f.publicSupabaseUrl?.stringValue;
  const anonKey = f.publicSupabaseAnonKey?.stringValue;
  if (!url || !anonKey) return null;

  const { SupabaseAdapter } = await import('../public/lib/storage/SupabaseAdapter.js');
  return new SupabaseAdapter({ url, anonKey });
}

  if (backend === 'firestore-custom') {
    const projectId = f.publicFirestoreProjectId?.stringValue;
    if (!projectId) return null;
    const { FirestoreAdapter } = await import('../public/lib/storage/FirestoreAdapter.js');
    return new FirestoreAdapter({ projectId });
  }

  return null;
}
function viewerPage({ domainName, targetUrl, visits, ownerName }) {
  const displayTarget = targetUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${domainName} — JanuNet</title>
<style>
  :root {
    --bg:#0a0a0a; --surface:#121212; --surface2:#1a1a1a;
    --border:#262626; --border-strong:#3a3a3a;
    --text:#ededed; --text2:#9a9a9a; --text3:#5e5e5e;
    --accent:#00ffcc; --accent-dim:rgba(0,255,204,0.08);
    --font-mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
    --font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font-sans);overflow:hidden;}
  .topbar{
    height:44px;background:var(--surface);border-bottom:1px solid var(--border);
    display:grid;grid-template-columns:auto 1fr auto;align-items:center;
    gap:8px;padding:0 10px;user-select:none;
  }
  .nav-group{display:flex;gap:2px;}
  .nav-btn{
    width:28px;height:28px;border:none;background:transparent;
    color:var(--text2);cursor:pointer;border-radius:6px;
    display:inline-flex;align-items:center;justify-content:center;
    transition:background 120ms,color 120ms;
  }
  .nav-btn:hover{background:var(--surface2);color:var(--text);}
  .nav-btn svg{width:16px;height:16px;stroke-width:2;}
  .urlbar{
    height:30px;background:var(--surface2);border:1px solid var(--border);
    border-radius:999px;display:flex;align-items:center;
    padding:0 14px 0 12px;gap:8px;min-width:0;transition:border-color 150ms;
  }
  .urlbar:hover{border-color:var(--border-strong);}
  .lock{width:14px;height:14px;flex-shrink:0;color:var(--accent);}
  .url-text{
    flex:1;min-width:0;display:flex;align-items:baseline;gap:8px;
    font-family:var(--font-mono);font-size:13px;overflow:hidden;
  }
  .url-domain{color:var(--text);font-weight:500;}
  .url-arrow{color:var(--text3);font-size:10px;flex-shrink:0;}
  .url-target{
    color:var(--text2);font-size:11px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;
  }
  .right-group{display:flex;align-items:center;gap:8px;padding-right:4px;flex-shrink:0;}
  .visits{font-family:var(--font-mono);font-size:11px;color:var(--text3);display:flex;align-items:center;gap:4px;}
  .visits b{color:var(--text2);}
  .open-btn{
    height:28px;padding:0 12px;background:var(--accent-dim);
    border:1px solid transparent;color:var(--accent);border-radius:6px;
    cursor:pointer;font-size:12px;font-weight:600;
    display:inline-flex;align-items:center;gap:6px;
    transition:background 120ms,border-color 120ms;
    text-decoration:none;white-space:nowrap;
  }
  .open-btn:hover{background:rgba(0,255,204,0.14);border-color:rgba(0,255,204,0.3);}
  .brand{font-family:var(--font-mono);font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;}
  .brand b{color:var(--accent);}
  .frame-wrap{height:calc(100% - 44px);position:relative;background:#fff;}
  iframe{width:100%;height:100%;border:none;background:#fff;}
  .loading-bar{
    position:absolute;top:0;left:0;height:2px;background:var(--accent);
    width:0%;box-shadow:0 0 6px var(--accent);z-index:5;
    transition:width 300ms;
  }
  .loading-bar.active{width:80%;transition:width 4s cubic-bezier(0.1,0.7,0.3,0.99);}
  .loading-bar.done{width:100%;opacity:0;transition:width 200ms,opacity 400ms 200ms;}
  .blocked{
    position:absolute;inset:0;background:var(--bg);display:none;
    flex-direction:column;align-items:center;justify-content:center;
    gap:16px;padding:40px;text-align:center;
  }
  .blocked.show{display:flex;}
  .blocked h2{font-size:16px;font-weight:600;color:var(--text);}
  .blocked p{font-size:13px;color:var(--text2);max-width:360px;line-height:1.6;}
  .blocked a{
    display:inline-block;padding:12px 24px;background:var(--accent);color:#000;
    border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;
  }
  .blocked small{font-size:11px;color:var(--text3);font-family:var(--font-mono);}
</style>
</head>
<body>
<div class="topbar">
  <div class="nav-group">
    <button class="nav-btn" id="back-btn" title="Back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <button class="nav-btn" id="fwd-btn" title="Forward">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <button class="nav-btn" id="ref-btn" title="Refresh">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
    </button>
  </div>
  <div class="urlbar">
    <span class="lock">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </span>
    <div class="url-text">
      <span class="url-domain">${domainName}</span>
      <span class="url-arrow">→</span>
      <span class="url-target">${displayTarget}</span>
    </div>
  </div>
  <div class="right-group">
    <span class="visits"><b>${visits.toLocaleString()}</b>&nbsp;views</span>
    <a class="open-btn" href="${targetUrl}" target="_blank" rel="noopener" title="Open in new tab">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="13" height="13">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
      Open
    </a>
    <span class="brand">JANU<b>NET</b></span>
  </div>
</div>
<div class="frame-wrap">
  <div class="loading-bar" id="lb"></div>
  <iframe id="frame" src="${targetUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-navigation"></iframe>
  <div class="blocked" id="blocked">
    <h2>This site can't be embedded</h2>
    <p>${domainName} routes to <b>${displayTarget}</b>, but this site blocks embedding. Open it directly instead.</p>
    <a href="${targetUrl}" target="_blank" rel="noopener">Open ${displayTarget} →</a>
    <small>janunet · ${domainName}</small>
  </div>
</div>
<script>
  const frame = document.getElementById('frame');
  const lb    = document.getElementById('lb');
  const blocked = document.getElementById('blocked');
  lb.classList.add('active');
  let didLoad = false;
  frame.addEventListener('load', () => {
    didLoad = true;
    lb.classList.remove('active');
    lb.classList.add('done');
    setTimeout(() => { lb.style.width = '0'; lb.classList.remove('done'); }, 700);
  });
  setTimeout(() => { if (!didLoad) blocked.classList.add('show'); }, 6000);
  document.getElementById('back-btn').addEventListener('click', () => {
    try { frame.contentWindow.history.back(); } catch(e) {}
  });
  document.getElementById('fwd-btn').addEventListener('click', () => {
    try { frame.contentWindow.history.forward(); } catch(e) {}
  });
  document.getElementById('ref-btn').addEventListener('click', () => {
    lb.classList.add('active');
    didLoad = false;
    frame.src = frame.src;
    setTimeout(() => { if (!didLoad) blocked.classList.add('show'); }, 6000);
  });
</script>
</body>
</html>`;
}

function errorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Not Found — JanuNet</title>
<style>
  body{background:#0a0a0a;color:#ededed;font-family:monospace;
  display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:100vh;gap:16px;text-align:center;padding:40px;}
  h1{font-size:20px;color:#ff5b5b;}
  p{color:#5e5e5e;font-size:13px;}
  a{color:#00ffcc;text-decoration:none;}
  a:hover{text-decoration:underline;}
</style>
</head>
<body>
  <h1>⚠ ${message}</h1>
  <p>This domain may not exist or was removed from the network.</p>
  <a href="/">← Back to JanuNet Portal</a>
</body>
</html>`;
}
