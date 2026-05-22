// panel.js — JanuNet sidepanel
// Handles: search, autocomplete, recents, favorites, navigation

const PROJECT_ID  = "janunet-cloud";
const FIRESTORE   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const MAX_RECENTS = 8;

// ── State ──
let allDomains  = [];  // fetched from Firestore for autocomplete
let favorites   = [];  // from chrome.storage
let recents     = [];  // from chrome.storage

// ── DOM refs ──
const searchInput  = document.getElementById('search-input');
const goBtn        = document.getElementById('go-btn');
const autocomplete = document.getElementById('autocomplete');
const favList      = document.getElementById('fav-list');
const recList      = document.getElementById('rec-list');
const clearBtn     = document.getElementById('clear-recents');

// ── Boot ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadStorage();
  renderFavorites();
  renderRecents();
  fetchAllDomains(); // background fetch for autocomplete
});

// ── Storage helpers ──
async function loadStorage() {
  return new Promise(resolve => {
    chrome.storage.local.get(['janufavs', 'janurecents'], data => {
      favorites = data.janufavs    || [];
      recents   = data.janurecents || [];
      resolve();
    });
  });
}
function saveStorage() {
  chrome.storage.local.set({ janufavs: favorites, janurecents: recents });
}

// ── Fetch all domains from Firestore (for autocomplete) ──
async function fetchAllDomains() {
  try {
    const res  = await fetch(`${FIRESTORE}/janu_domains`);
    const data = await res.json();
    if (data.documents) {
      allDomains = data.documents.map(d => ({
        name:      d.name.split('/').pop(),
        targetUrl: d.fields?.targetUrl?.stringValue || '',
        owner:     d.fields?.ownerName?.stringValue || '',
        visits:    parseInt(d.fields?.visits?.integerValue || '0', 10)
      }));
    }
  } catch(e) {
    console.error('autocomplete fetch failed', e);
  }
}

// ── Search / Navigation ──
goBtn.addEventListener('click', navigate);
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') navigate();
});

async function navigate(domainOverride) {
  const query = (domainOverride || searchInput.value).trim().toLowerCase();
  if (!query) return;

  autocomplete.classList.remove('open');
  searchInput.value = '';

  // Check Firestore
  try {
    const res = await fetch(`${FIRESTORE}/janu_domains/${encodeURIComponent(query)}`);
    if (res.ok) {
      const data      = await res.json();
      const targetUrl = data.fields?.targetUrl?.stringValue;
      const owner     = data.fields?.ownerName?.stringValue || 'unknown';
      if (targetUrl) {
        addRecent(query, targetUrl);
        openViewer(query, targetUrl, owner);
        return;
      }
    }
  } catch(e) { /* fall through */ }

  showToast(`⚠️ not found: ${query}`);
}

function openViewer(domain, url, owner) {
  const viewerUrl = chrome.runtime.getURL(
    `viewer.html?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(url)}&user=${encodeURIComponent(owner)}`
  );
  chrome.tabs.create({ url: viewerUrl });
}

// ── Autocomplete ──
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q || allDomains.length === 0) {
    autocomplete.classList.remove('open');
    return;
  }
  const matches = allDomains
    .filter(d => d.name.includes(q))
    .slice(0, 6);

  if (matches.length === 0) {
    autocomplete.classList.remove('open');
    return;
  }

  autocomplete.innerHTML = matches.map(d => `
    <div class="ac-item" data-domain="${d.name}">
      ${favorites.includes(d.name) ? '<span class="ac-star">⭐</span>' : ''}
      <span>${d.name}</span>
    </div>
  `).join('');

  autocomplete.querySelectorAll('.ac-item').forEach(item => {
    item.addEventListener('click', () => {
      navigate(item.getAttribute('data-domain'));
    });
  });

  autocomplete.classList.add('open');
});

// Close autocomplete on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    autocomplete.classList.remove('open');
  }
});

// ── Recents ──
function addRecent(domain, url) {
  recents = recents.filter(r => r.domain !== domain); // remove duplicate
  recents.unshift({ domain, url, time: Date.now() });
  if (recents.length > MAX_RECENTS) recents = recents.slice(0, MAX_RECENTS);
  saveStorage();
  renderRecents();
}

function renderRecents() {
  if (recents.length === 0) {
    recList.innerHTML = '<div class="empty">no recent visits</div>';
    return;
  }
  recList.innerHTML = recents.map(r => `
    <div class="domain-row" data-domain="${r.domain}" data-url="${r.url}">
      <div style="flex:1;min-width:0;">
        <div class="name">${r.domain}</div>
        <div class="sub">${r.url}</div>
      </div>
      <button class="star-btn ${favorites.includes(r.domain) ? 'active' : ''}"
        data-fav="${r.domain}" data-url="${r.url}" title="Favorite">
        ${favorites.includes(r.domain) ? '⭐' : '☆'}
      </button>
    </div>
  `).join('');
  attachRowListeners(recList);
}

clearBtn.addEventListener('click', () => {
  recents = [];
  saveStorage();
  renderRecents();
  showToast('recents cleared');
});

// ── Favorites ──
function toggleFav(domain, url) {
  if (favorites.includes(domain)) {
    favorites = favorites.filter(f => f !== domain);
    showToast(`removed from favorites`);
  } else {
    favorites.unshift(domain);
    showToast(`⭐ added to favorites`);
  }
  saveStorage();
  renderFavorites();
  renderRecents();
}

function renderFavorites() {
  if (favorites.length === 0) {
    favList.innerHTML = '<div class="empty">no favorites yet — hit ☆ on any domain</div>';
    return;
  }
  // Find full data from recents or allDomains
  favList.innerHTML = favorites.map(domain => {
    const rec = recents.find(r => r.domain === domain);
    const acd = allDomains.find(d => d.name === domain);
    const url = rec?.url || acd?.targetUrl || '';
    return `
      <div class="domain-row" data-domain="${domain}" data-url="${url}">
        <div style="flex:1;min-width:0;">
          <div class="name">${domain}</div>
          <div class="sub">${url || 'tap to open'}</div>
        </div>
        <button class="star-btn active" data-fav="${domain}" data-url="${url}" title="Unfavorite">⭐</button>
      </div>
    `;
  }).join('');
  attachRowListeners(favList);
}

function attachRowListeners(container) {
  // Row click → navigate
  container.querySelectorAll('.domain-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.star-btn')) return; // handled below
      const domain = row.getAttribute('data-domain');
      const url    = row.getAttribute('data-url');
      if (domain && url) {
        addRecent(domain, url);
        openViewer(domain, url, 'unknown');
      } else if (domain) {
        navigate(domain);
      }
    });
  });
  // Star click → toggle favorite
  container.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFav(btn.getAttribute('data-fav'), btn.getAttribute('data-url'));
    });
  });
}

// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}


// ═══════════════════════════════════════════════════════════
// UPDATE BANNER — checks chrome.storage for version info
// ═══════════════════════════════════════════════════════════
const PORTAL_BASE_PANEL = "https://gen-z-dns.vercel.app";

function isOutdatedPanel(installed, latest) {
  const a = installed.split('.').map(Number);
  const b = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] || 0, bi = b[i] || 0;
    if (bi > ai) return true;
    if (ai > bi) return false;
  }
  return false;
}

function initUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (!banner) return;

  chrome.storage.local.get(['janu_versionInfo', 'janu_dismissedVersion'], data => {
    const info = data.janu_versionInfo;
    if (!info) return;
    if (data.janu_dismissedVersion === info.latest) return; // user dismissed this version
    if (!isOutdatedPanel(info.installed, info.latest)) return;

    document.getElementById('banner-version').innerText = 'v' + info.latest;
    banner.style.display = 'flex';
  });

  document.getElementById('banner-update')?.addEventListener('click', e => {
    e.stopPropagation();
    chrome.storage.local.get(['janu_versionInfo'], d => {
      const v = d.janu_versionInfo?.installed || '';
      chrome.tabs.create({ url: `${PORTAL_BASE_PANEL}/update.html?current=${v}` });
    });
  });

  document.getElementById('banner-dismiss')?.addEventListener('click', e => {
    e.stopPropagation();
    chrome.storage.local.get(['janu_versionInfo'], d => {
      if (d.janu_versionInfo) {
        chrome.storage.local.set({ janu_dismissedVersion: d.janu_versionInfo.latest });
      }
    });
    document.getElementById('update-banner').style.display = 'none';
  });

  // Clicking the banner area (not buttons) → open update
  document.getElementById('update-banner')?.addEventListener('click', () => {
    chrome.storage.local.get(['janu_versionInfo'], d => {
      const v = d.janu_versionInfo?.installed || '';
      chrome.tabs.create({ url: `${PORTAL_BASE_PANEL}/update.html?current=${v}` });
    });
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUpdateBanner);
} else {
  initUpdateBanner();
}
