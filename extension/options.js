document.addEventListener('DOMContentLoaded', () => {
  
  // Load existing domains when the page opens
  loadDomains();

  // Save a new domain
  document.getElementById('save-btn').addEventListener('click', () => {
    let customDomain = document.getElementById('new-domain').value.trim();
    let targetUrl = document.getElementById('target-url').value.trim();
    
    // Auto-add https:// if the user forgot it for the target
    if (targetUrl && !/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    if (customDomain && targetUrl) {
      chrome.storage.local.get(['myDomains'], (data) => {
        const domains = data.myDomains || {};
        domains[customDomain] = targetUrl; // Add to database
        
        chrome.storage.local.set({ myDomains: domains }, () => {
          // Clear the form and reload the list
          document.getElementById('new-domain').value = '';
          document.getElementById('target-url').value = '';
          loadDomains();
        });
      });
    } else {
      alert("Please fill in both fields!");
    }
  });
});

// Function to read database and display it on screen
function loadDomains() {
  chrome.storage.local.get(['myDomains'], (data) => {
    const domains = data.myDomains || {};
    const container = document.getElementById('list-container');
    container.innerHTML = ''; // Clear old list
    
    // Check if empty
    if (Object.keys(domains).length === 0) {
      container.innerHTML = "<p>No domains registered yet.</p>";
      return;
    }

    // Loop through database and create HTML for each domain
    for (const [domainName, url] of Object.entries(domains)) {
      const item = document.createElement('div');
      item.className = 'domain-item';
      
      item.innerHTML = `
        <div>
          <b>${domainName}</b> <br>
          <small>➡️ ${url}</small>
        </div>
        <button class="delete-btn" data-domain="${domainName}">Remove</button>
      `;
      container.appendChild(item);
    }

    // Add delete functionality to the remove buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', function() {
        const domainToDelete = this.getAttribute('data-domain');
        removeDomain(domainToDelete);
      });
    });
  });
}

// Function to delete a domain
function removeDomain(domainName) {
  chrome.storage.local.get(['myDomains'], (data) => {
    const domains = data.myDomains || {};
    delete domains[domainName]; // Remove from object
    
    chrome.storage.local.set({ myDomains: domains }, () => {
      loadDomains(); // Refresh the list
    });
  });
}
