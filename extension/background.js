// background.js — JanuNet service worker v2.0
// Handles: sidepanel, onboarding, omnibox, version check, portal messaging

const RESOLVE_API = "https://gen-z-dns.vercel.app/api/resolve";
const PORTAL_BASE = "https://gen-z-dns.vercel.app";
const FIRESTORE   = `https://firestore.googleapis.com/v1/projects/janunet-cloud/databases/(default)/documents`;
const VERSION_URL = `${PORTAL_BASE}/version.json`;
const CHECK_HOURS = 6;

// ── Sidepanel opens on icon click ──
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(e => console.error(e));

// ── First-install onboarding ──
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
  chrome.alarms.create('version-check', { periodInMinutes: CHECK_HOURS * 60 });
  checkVersion();
});

chrome.runtime.onStartup.addListener(() => {
  checkVersion();
});

// ── Periodic check via alarm ──
chrome.alarms?.onAlarm.addListener(alarm => {
  if (alarm.name === 'version-check') checkVersion();
});

// ── Version check ──
async function checkVersion() {
  try {
    const res  = await fetch(VERSION_URL + '?t=' + Date.now());
    if (!res.ok) return;
    const data = await res.json();
    const installed = chrome.runtime.getManifest().version;
    const latest    = data.latest;

    chrome.storage.local.set({
      janu_versionInfo: {
        installed,
        latest,
        downloadUrl:  data.downloadUrl,
        releaseNotes: data.releaseNotes,
        checkedAt:    Date.now()
      }
    });

    if (isOutdated(installed, latest)) {
      chrome.storage.local.get(['janu_notifiedVersion'], stored => {
        if (stored.janu_notifiedVersion !== latest) {
          showUpdateNotification(installed, latest);
          chrome.storage.local.set({ janu_notifiedVersion: latest });
        }
      });
    }
  } catch(e) {
    console.error('version check failed', e);
  }
}

function isOutdated(installed, latest) {
  const a = installed.split('.').map(Number);
  const b = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] || 0, bi = b[i] || 0;
    if (bi > ai) return true;
    if (ai > bi) return false;
  }
  return false;
}

function showUpdateNotification(current, latest) {
  chrome.notifications.create('janunet-update', {
    type:     'basic',
    iconUrl:  chrome.runtime.getURL('icons/icon-128.png'),
    title:    'JanuNet update available',
    message:  `Version ${latest} is out (you have ${current}). Click to update.`,
    priority: 2
  }, () => {
    if (chrome.runtime.lastError) console.warn('notif:', chrome.runtime.lastError.message);
  });
}

chrome.notifications?.onClicked.addListener(id => {
  if (id === 'janunet-update') {
    chrome.storage.local.get(['janu_versionInfo'], data => {
      const v = data.janu_versionInfo?.installed || '';
      chrome.tabs.create({ url: `${PORTAL_BASE}/update.html?current=${v}` });
    });
    chrome.notifications.clear(id);
  }
});

// ── Portal ↔ Extension messaging ──
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {

  if (msg?.action === 'ping') {
    // Portal checking if extension is installed
    sendResponse({
      installed: true,
      version:   chrome.runtime.getManifest().version,
      name:      chrome.runtime.getManifest().name
    });

  } else if (msg?.action === 'openViewer') {
    // Portal asked us to open a domain in the viewer
    const { domain, targetUrl, owner } = msg;
    if (domain && targetUrl) {
      const viewerUrl = chrome.runtime.getURL(
        `viewer.html?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(targetUrl)}&user=${encodeURIComponent(owner || 'unknown')}`
      );
      chrome.tabs.create({ url: viewerUrl });
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: 'Missing domain or targetUrl' });
    }

  } else if (msg?.action === 'workspaceUpdated') {
    // Portal saved workspace — store ownerUid so viewer can build correct share URLs
    // WHY: BYOS share URLs need /d/{uid}/{domain} format
    // The uid comes from Firebase Auth on the portal side
    const { backend, ownerUid } = msg;
    chrome.storage.local.get(['janunet_workspace'], data => {
      const current    = data.janunet_workspace || {};
      current.ownerUid = ownerUid;
      chrome.storage.local.set({ janunet_workspace: current }, () => {
        console.log('workspace ownerUid stored:', ownerUid, 'backend:', backend);
      });
    });
    sendResponse({ ok: true });

  } else if (msg?.action === 'forceCheck') {
    checkVersion();
    sendResponse({ ok: true });
  }

  return true; // keep channel open for async sendResponse
});

// ── Omnibox ──
chrome.omnibox.onInputEntered.addListener(async (text) => {
  const query = text.trim().toLowerCase();
  if (!query) return;
  try {
    const res = await fetch(`${RESOLVE_API}?domain=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data      = await res.json();
      const targetUrl = data.targetUrl;
      const owner     = data.ownerName || 'unknown';
      const uid       = data.ownerUid  || null;
      if (targetUrl) {
        const uidParam  = uid ? `&uid=${encodeURIComponent(uid)}` : '';
        const viewerUrl = chrome.runtime.getURL(
          `viewer.html?domain=${encodeURIComponent(query)}&url=${encodeURIComponent(targetUrl)}&user=${encodeURIComponent(owner)}${uidParam}`
        );
        chrome.tabs.update({ url: viewerUrl });
        return;
      }
    }
  } catch(e) {}
  chrome.tabs.update({ url: `${PORTAL_BASE}?q=${encodeURIComponent(query)}` });
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  if (!text || text.length < 2) return;
  try {
    const res  = await fetch(`${FIRESTORE}/janu_domains`);
    const data = await res.json();
    if (!data.documents) return;
    const matches = data.documents
      .map(d => d.name.split('/').pop())
      .filter(name => name.includes(text.toLowerCase()))
      .slice(0, 5)
      .map(name => ({ content: name, description: `JanuNet → ${name}` }));
    suggest(matches);
  } catch(e) {}
});
