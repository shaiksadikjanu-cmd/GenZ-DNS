// api/domain.js — public domain info page
// Handles: /domain/:user/:domainname
// Fetches from Firestore, returns a styled HTML page

export default async function handler(req, res) {
  // Parse the path — /domain/shaikjanu/janujulie.com
  const parts      = req.url.split('/').filter(Boolean);
  // parts = ['domain', 'shaikjanu', 'janujulie.com']
  const domainName = parts[parts.length - 1];
  const ownerUser  = parts[parts.length - 2];

  if (!domainName || domainName === 'domain') {
    return res.status(400).send(errorPage('No domain specified.'));
  }

  const PROJECT_ID = "janunet-cloud";
  const fsUrl      = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/janu_domains/${encodeURIComponent(domainName)}`;

  let targetUrl  = null;
  let visits     = 0;
  let ownerName  = ownerUser;
  let createdAt  = null;

  try {
    const fsRes  = await fetch(fsUrl);
    if (!fsRes.ok) return res.status(404).send(errorPage(`Domain not found: ${domainName}`));
    const data   = await fsRes.json();
    targetUrl    = data.fields?.targetUrl?.stringValue;
    visits       = parseInt(data.fields?.visits?.integerValue || '0', 10);
    ownerName    = data.fields?.ownerName?.stringValue || ownerUser;
    createdAt    = data.fields?.createdAt?.integerValue
      ? new Date(parseInt(data.fields.createdAt.integerValue)).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' })
      : null;
  } catch(e) {
    return res.status(500).send(errorPage('Could not reach the JanuNet cloud.'));
  }

  if (!targetUrl) {
    return res.status(404).send(errorPage(`Domain not found: ${domainName}`));
  }

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(domainPage({ domainName, targetUrl, visits, ownerName, createdAt }));
}

function domainPage({ domainName, targetUrl, visits, ownerName, createdAt }) {
  const displayUrl = targetUrl.replace(/^https?:\/\//, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${domainName} — JanuNet</title>
<meta property="og:title" content="${domainName} on JanuNet">
<meta property="og:description" content="A JanuNet domain by ${ownerName}. Click to visit.">
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
  body{
    background:var(--bg);color:var(--text);
    font-family:var(--font-sans);
    min-height:100vh;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:40px 20px;
  }

  /* top nav */
  .nav{
    position:fixed;top:0;left:0;right:0;
    height:48px;
    background:var(--surface);
    border-bottom:1px solid var(--border);
    display:flex;align-items:center;justify-content:space-between;
    padding:0 24px;
  }
  .nav-brand{
    font-family:var(--font-mono);font-size:13px;
    font-weight:700;letter-spacing:2px;
    color:var(--text3);text-transform:uppercase;
    text-decoration:none;
  }
  .nav-brand b{color:var(--accent);}
  .nav-portal{
    font-size:12px;color:var(--text3);
    text-decoration:none;
    padding:6px 12px;
    border:1px solid var(--border);
    border-radius:6px;
    transition:border-color 120ms,color 120ms;
    font-family:var(--font-mono);
  }
  .nav-portal:hover{border-color:var(--accent);color:var(--accent);}

  /* card */
  .card{
    width:100%;max-width:480px;
    background:var(--surface);
    border:1px solid var(--border-strong);
    border-radius:16px;
    padding:40px;
    margin-top:48px;
    box-shadow:0 24px 60px rgba(0,0,0,0.5);
  }

  /* domain header */
  .domain-badge{
    display:inline-flex;align-items:center;gap:8px;
    background:var(--accent-dim);
    border:1px solid rgba(0,255,204,0.2);
    color:var(--accent);
    font-family:var(--font-mono);
    font-size:11px;letter-spacing:1px;
    text-transform:uppercase;
    padding:5px 12px;border-radius:999px;
    margin-bottom:20px;
  }

  .domain-name{
    font-family:var(--font-mono);
    font-size:28px;font-weight:700;
    color:var(--text);
    margin-bottom:8px;
    word-break:break-all;
  }

  .owner-line{
    font-size:13px;color:var(--text3);
    margin-bottom:28px;
  }
  .owner-line b{color:var(--text2);}

  /* target box */
  .target-box{
    background:var(--surface2);
    border:1px solid var(--border);
    border-radius:10px;
    padding:16px;
    margin-bottom:24px;
    display:flex;align-items:center;gap:12px;
  }
  .lock-icon{color:var(--accent);font-size:18px;flex-shrink:0;}
  .target-info{min-width:0;}
  .target-label{font-size:10px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;}
  .target-url{
    font-family:var(--font-mono);font-size:13px;color:var(--text2);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }

  /* stats row */
  .stats{
    display:flex;gap:12px;margin-bottom:28px;
  }
  .stat{
    flex:1;background:var(--surface2);
    border:1px solid var(--border);border-radius:8px;
    padding:12px;text-align:center;
  }
  .stat-val{font-family:var(--font-mono);font-size:20px;font-weight:700;color:var(--text);}
  .stat-label{font-size:10px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-top:3px;}

  /* CTA button */
  .visit-btn{
    display:block;width:100%;
    padding:16px;
    background:var(--accent);color:#000;
    border:none;border-radius:10px;
    font-size:15px;font-weight:700;
    cursor:pointer;text-align:center;
    text-decoration:none;
    letter-spacing:0.3px;
    transition:background 120ms,transform 120ms;
    font-family:var(--font-sans);
    margin-bottom:12px;
  }
  .visit-btn:hover{background:#4cffd9;transform:translateY(-1px);}

  .ext-hint{
    text-align:center;font-size:11px;color:var(--text3);
    font-family:var(--font-mono);line-height:1.6;
  }
  .ext-hint a{color:var(--accent);text-decoration:none;}
  .ext-hint a:hover{text-decoration:underline;}

  /* footer */
  .footer{
    margin-top:32px;
    text-align:center;
    font-size:11px;color:var(--text3);
    font-family:var(--font-mono);
  }
  .footer a{color:var(--text3);text-decoration:none;}
  .footer a:hover{color:var(--accent);}
</style>
</head>
<body>

<nav class="nav">
  <a class="nav-brand" href="/">JANU<b>NET</b></a>
  <a class="nav-portal" href="/">Register your domain →</a>
</nav>

<div class="card">
  <div class="domain-badge">🌐 JanuNet Domain</div>

  <div class="domain-name">${domainName}</div>
  <div class="owner-line">Registered by <b>${ownerName}</b>${createdAt ? ` · ${createdAt}` : ''}</div>

  <div class="target-box">
    <div class="lock-icon">🔒</div>
    <div class="target-info">
      <div class="target-label">Routes to</div>
      <div class="target-url">${displayUrl}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-val">${visits.toLocaleString()}</div>
      <div class="stat-label">Total Views</div>
    </div>
    <div class="stat">
      <div class="stat-val">✓</div>
      <div class="stat-label">AI Verified</div>
    </div>
  </div>

  <a class="visit-btn" href="${targetUrl}" target="_blank" rel="noopener">
    Visit ${domainName} →
  </a>

  <div class="ext-hint">
    JanuNet user? Open this domain directly in the extension.<br>
    New here? <a href="/">Register your own domain free →</a>
  </div>
</div>

<div class="footer">
  <a href="/">gen-z-dns.vercel.app</a> · JanuNet private domain network
</div>

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
</style>
</head>
<body>
  <h1>⚠ ${message}</h1>
  <p>This domain may not exist or was removed.</p>
  <a href="/">← Back to JanuNet Portal</a>
</body>
</html>`;
}
