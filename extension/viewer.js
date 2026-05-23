// viewer.js — JanuNet browser shell logic
// Handles: topbar display, nav (back/fwd/refresh), visit counter, share modal, QR generation

const PROJECT_ID = "janunet-cloud";
const PORTAL_BASE = "https://gen-z-dns.vercel.app";


document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const customDomain = params.get('domain');
  const targetUrl = params.get('url');
  const ownerUser = params.get('user') || 'unknown';
const ownerUid  = params.get('uid')  || null;

  const iframe   = document.getElementById('content-frame');
  const urlDom   = document.getElementById('url-domain');
  const urlTgt   = document.getElementById('url-target');
  const visitEl  = document.getElementById('visit-count');
  const loadBar  = document.getElementById('loading-bar');
  const errBox   = document.getElementById('error-overlay');

  if (!customDomain || !targetUrl) {
    urlDom.innerText = "Error: invalid route";
    return;
  }

  // === Topbar display ===
  urlDom.innerText = customDomain;
  urlTgt.innerText = targetUrl;
  document.title = customDomain + " — JanuNet";

  // === Loading bar ===
  loadBar.classList.add('active');
  iframe.src = targetUrl;
  iframe.addEventListener('load', () => {
    loadBar.classList.remove('active');
    loadBar.classList.add('done');
    setTimeout(() => loadBar.classList.remove('done'), 600);
    setTimeout(() => loadBar.style.width = '0%', 700);
  });

  // Detect iframe block (heuristic — 4s timeout)
  let loaded = false;
  iframe.addEventListener('load', () => { loaded = true; });
  setTimeout(() => {
    try {
      // Same-origin check will throw for cross-origin — that's normal
      // We only show error if iframe is visually empty
      if (!loaded && iframe.contentWindow.length === 0) {
        // still loading or blocked — leave it
      }
    } catch(e) { /* cross-origin, expected */ }
  }, 4000);

  // === Nav buttons ===
  document.getElementById('back-btn').addEventListener('click', () => {
    try { iframe.contentWindow.history.back(); } catch(e) { /* cross-origin */ }
  });
  document.getElementById('forward-btn').addEventListener('click', () => {
    try { iframe.contentWindow.history.forward(); } catch(e) { /* cross-origin */ }
  });
  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadBar.classList.add('active');
    iframe.src = iframe.src;
  });

  document.getElementById('open-direct').addEventListener('click', () => {
    chrome.tabs.create({ url: targetUrl });
  });

  // === Visit counter (Firestore increment) ===
  incrementVisits(customDomain).then(count => {
    if (count !== null) visitEl.innerText = count.toLocaleString();
    else visitEl.innerText = '—';
  });

  // === Share modal ===
  const modal = document.getElementById('share-modal');
  const extUrl = `janunet://${customDomain}`;
  // Use UID-based URL for BYOS domains, name-based for JanuNet default
// Read workspace from chrome.storage to get the right UID
const wsData = await new Promise(resolve => {
  chrome.storage.local.get(['janunet_workspace'], d => resolve(d.janunet_workspace || {}));
});

// URL format depends on user's active workspace backend
// Architecture: /u/{username}/{domain} | /s/{supabase-ref}/{domain} | /f/{project-id}/{domain}
let publicUrl;
if (wsData.backend === 'supabase' && wsData.supabaseRef) {
  publicUrl = `${PORTAL_BASE}/s/${encodeURIComponent(wsData.supabaseRef)}/${encodeURIComponent(customDomain)}`;
} else if (wsData.backend === 'firestore-custom' && wsData.projectId) {
  publicUrl = `${PORTAL_BASE}/f/${encodeURIComponent(wsData.projectId)}/${encodeURIComponent(customDomain)}`;
} else {
  publicUrl = `${PORTAL_BASE}/u/${encodeURIComponent(ownerUser)}/${encodeURIComponent(customDomain)}`;
}
  document.getElementById('ext-url').innerText = extUrl;
  document.getElementById('public-url').innerText = publicUrl;

  document.getElementById('share-btn').addEventListener('click', () => {
    modal.classList.add('open');
    loadQR(publicUrl);
  });
  document.getElementById('modal-close').addEventListener('click', () => {
    modal.classList.remove('open');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const which = btn.getAttribute('data-copy');
      const text = which === 'ext' ? extUrl : publicUrl;
      navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.innerText = '✓ Copied';
        showToast(`${which === 'ext' ? 'Extension' : 'Public'} URL copied`);
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerText = 'Copy';
        }, 1800);
      });
    });
  });

  // ESC closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal.classList.remove('open');
  });
});

// === Helpers ===

function loadQR(text) {
  const img = document.getElementById('qr-img');
  const loading = document.getElementById('qr-loading');
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(text)}`;
  img.onload = () => {
    loading.style.display = 'none';
    img.style.display = 'block';
  };
  img.onerror = () => {
    loading.innerText = 'qr unavailable';
  };
  img.src = url;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

async function incrementVisits(domain) {
  // Visit counter is now handled server-side by api/domain.js
  // when users access via the public URL. For extension visits,
  // we call the resolve API which returns current count.
  try {
    const res = await fetch(`https://gen-z-dns.vercel.app/api/resolve?domain=${encodeURIComponent(domain)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.visits || null;
  } catch(e) {
    console.error('visit counter failed', e);
    return null;
  }
}
