// background.js — JanuNet service worker v2.0
// Handles: sidepanel, onboarding, omnibox, version check, portal messaging

const PROJECT_ID    = "janunet-cloud";
const FIRESTORE     = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const PORTAL_BASE   = "https://gen-z-dns.vercel.app";
const VERSION_URL   = `${PORTAL_BASE}/version.json`;
const CHECK_HOURS   = 6; // check for updates every 6 hours

// ── Sidepanel opens on icon click ──
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(e => console.error(e));

// ── First-install onboarding ──
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
  // Set up periodic version check
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

// ── Version check core ──
async function checkVersion() {
  try {
    const res  = await fetch(VERSION_URL + '?t=' + Date.now()); // cache-bust
    if (!res.ok) return;
    const data = await res.json();
    const installed = chrome.runtime.getManifest().version;
    const latest    = data.latest;

    // Save latest to storage so panel can read it
    chrome.storage.local.set({
      janu_versionInfo: {
        installed,
        latest,
        downloadUrl: data.downloadUrl,
        releaseNotes: data.releaseNotes,
        checkedAt: Date.now()
      }
    });

    if (isOutdated(installed, latest)) {
      // Check if we've already notified about THIS version
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
  // Simple semantic compare: split by '.' and compare ints
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
    type: 'basic',
    iconUrl: chrome.runtime.getURL('rules.json'), // placeholder until you add a 128x128 icon
    title: '🔄 JanuNet update available',
    message: `Version ${latest} is out (you have ${current}). Click to update.`,
    priority: 2
  }, () => {
    if (chrome.runtime.lastError) console.warn('notif:', chrome.runtime.lastError.message);
  });
}

// User clicks the notification → open update page
chrome.notifications?.onClicked.addListener(id => {
  if (id === 'janunet-update') {
    chrome.storage.local.get(['janu_versionInfo'], data => {
      const v = data.janu_versionInfo?.installed || '';
      chrome.tabs.create({ url: `${PORTAL_BASE}/update.html?current=${v}` });
    });
    chrome.notifications.clear(id);
  }
});

// ── PORTAL ↔ EXTENSION messaging ──
// Portal asks "are you installed? what version?" — extension answers
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  // Only trusted origins (defined in manifest.externally_connectable.matches)
  if (msg?.action === 'ping') {
    sendResponse({
      installed: true,
      version: chrome.runtime.getManifest().version,
      name: chrome.runtime.getManifest().name
    });
  } else if (msg?.action === 'forceCheck') {
    checkVersion();
    sendResponse({ ok: true });
  }
  return true; // keep channel open for async
});

// ── Omnibox ──
chrome.omnibox.onInputEntered.addListener(async (text) => {
  const query = text.trim().toLowerCase();
  if (!query) return;
  try {
    const res = await fetch(`${FIRESTORE}/janu_domains/${encodeURIComponent(query)}`);
    if (res.ok) {
      const data      = await res.json();
      const targetUrl = data.fields?.targetUrl?.stringValue;
      const owner     = data.fields?.ownerName?.stringValue || 'unknown';
      if (targetUrl) {
        const viewerUrl = chrome.runtime.getURL(
          `viewer.html?domain=${encodeURIComponent(query)}&url=${encodeURIComponent(targetUrl)}&user=${encodeURIComponent(owner)}`
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
