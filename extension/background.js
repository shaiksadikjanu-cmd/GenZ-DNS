// background.js — JanuNet service worker v2

// Open sidepanel when icon clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(e => console.error(e));

// Show onboarding on first install
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

// ── Omnibox ──
const PROJECT_ID = "janunet-cloud";
const FIRESTORE  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
  chrome.tabs.update({ url: `https://gen-z-dns.vercel.app?q=${encodeURIComponent(query)}` });
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
