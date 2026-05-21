// --- THE CLOUD BRIDGE (Replace with your Project ID from image_0.png) ---
const PROJECT_ID = "janunet-cloud";

document.addEventListener('DOMContentLoaded', () => {
  // --- Standard Naming Registry Logic ---
  const searchInput = document.getElementById('search-input');
  const actionBtn = document.getElementById('search-btn');

  // Trigger search on "Enter"
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleNamingAction();
  });

  // Handle Button Click (Either Search or Register)
  actionBtn.addEventListener('click', handleNamingAction);

  async function handleNamingAction() {
    let query = searchInput.value.trim().toLowerCase();
    if (!query) return;

    // Detect if they are searching (e.g. janu.student) or registering (typing text)
    if (query.includes('.')) {
      // It looks like a search: janu.student
      searchInput.value = `Accessing ${query}...`;
      await executeSearch(query);
    } else {
      // It looks like text: janu.
      // This is a registration intent. For security, this needs a login context.
      actionBtn.innerText = "Deployment Server Syncing...";
      alert(`⚠️ Registration Protocol Initiated: Secure Deployment for .student or .januos TLD requires Cloud Vault Authentication (Login). Please use the main Dashboard.`);
      actionBtn.innerText = "Register .student, .januos";
      searchInput.value = '';
    }
  }

  // --- Continuous Search Logic (from previous conversation) ---
  async function executeSearch(query) {
    const sanitizedQuery = query.replace(/^https?:\/\//i, '');
    actionBtn.innerText = "Querying Firebase Cloud...";

    try {
      const apiUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/janu_domains/${sanitizedQuery}`;

      const response = await fetch(apiUrl);
      if (response.ok) {
        // Domain found! Routing through secure Viewer.
        const data = await response.json();
        const targetUrl = data.fields.targetUrl.stringValue;
        const ownerUser = data.fields.user?.stringValue || data.fields.owner?.stringValue || 'unknown';
const viewerUrl = chrome.runtime.getURL(`viewer.html?domain=${sanitizedQuery}&url=${encodeURIComponent(targetUrl)}&user=${encodeURIComponent(ownerUser)}`);

        // This is a continuous side panel, so we keep browsing in a new tab
        chrome.tabs.create({ url: viewerUrl });

      } else if (response.status === 404) {
        // Not Found
        alert(`⚠️ JanuNet Route Not Found in Global Cloud: ${query}`);
      } else {
        alert("⚠️ Cloud Connection Error.");
      }
    } catch (error) {
      console.error(error);
      alert("⚠️ Network Error. Connection required.");
    } finally {
      // Reset Registry UI state
      searchInput.value = '';
      actionBtn.innerText = "Access Network";
    }
  }
});
