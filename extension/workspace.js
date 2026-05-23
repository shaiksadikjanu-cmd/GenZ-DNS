// workspace.js — extension workspace settings
// Saves backend config to chrome.storage.local (stays on device, never sent to server)

const BACKENDS = {
  janunet:           'JanuNet Default',
  supabase:          'My Supabase',
  'firestore-custom':'My Firebase'
};

document.addEventListener('DOMContentLoaded', () => {
  loadSaved();
  wireRadios();
  wireButtons();
});

// ── Load saved config and populate form ──
function loadSaved() {
  chrome.storage.local.get(['janunet_workspace'], data => {
    const cfg = data.janunet_workspace || { backend: 'janunet' };
    updateCurrentBadge(cfg.backend);

    // Select the right radio
    const radio = document.querySelector(`input[name=backend][value="${cfg.backend}"]`);
    if (radio) {
      radio.checked = true;
      updateOptionStyles(cfg.backend);
      showForm(cfg.backend);
    }

    // Populate fields
    if (cfg.backend === 'supabase') {
      document.getElementById('supa-url').value = cfg.url     || '';
      document.getElementById('supa-key').value = cfg.anonKey || '';
    } else if (cfg.backend === 'firestore-custom') {
      document.getElementById('fs-project').value = cfg.projectId || '';
    }
  });
}

// ── Wire radio buttons ──
function wireRadios() {
  document.querySelectorAll('input[name=backend]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateOptionStyles(radio.value);
      showForm(radio.value);
      const testBtn = document.getElementById('test-btn');
      testBtn.style.display = radio.value !== 'janunet' ? '' : 'none';
    });
  });
}

// ── Wire action buttons ──
function wireButtons() {
  document.getElementById('back-btn').addEventListener('click', () => window.close());
  document.getElementById('test-btn').addEventListener('click', testConnection);
  document.getElementById('save-btn').addEventListener('click', saveWorkspace);
}

// ── Show/hide credential forms ──
function showForm(backend) {
  document.getElementById('form-supabase').classList.toggle('show', backend === 'supabase');
  document.getElementById('form-firestore').classList.toggle('show', backend === 'firestore-custom');
}

// ── Update radio option border styles ──
function updateOptionStyles(active) {
  document.querySelectorAll('.backend-option').forEach(el => el.classList.remove('active'));
  const map = { janunet: 'opt-janunet', supabase: 'opt-supabase', 'firestore-custom': 'opt-firestore' };
  if (map[active]) document.getElementById(map[active]).classList.add('active');
}

// ── Update current backend badge ──
function updateCurrentBadge(backend) {
  document.getElementById('current-backend-label').innerText = BACKENDS[backend] || backend;
}

// ── Test connection ──
async function testConnection() {
  const backend = document.querySelector('input[name=backend]:checked')?.value;
  const status  = document.getElementById('status');
  status.className = 'status';
  status.innerText = 'Testing connection...';

  try {
    if (backend === 'supabase') {
      const url = document.getElementById('supa-url').value.trim();
      const key = document.getElementById('supa-key').value.trim();
      if (!url || !key) { status.className = 'status err'; status.innerText = 'Fill in both Supabase fields.'; return; }

      // Test by listing domains
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/janu_domains?select=name&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = await res.json();
      status.className = 'status ok';
      status.innerText  = `✓ Connected (${rows.length} domains found)`;

    } else if (backend === 'firestore-custom') {
      const pid = document.getElementById('fs-project').value.trim();
      if (!pid) { status.className = 'status err'; status.innerText = 'Enter the Firebase Project ID.'; return; }

      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/janu_domains`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const count = data.documents?.length || 0;
      status.className = 'status ok';
      status.innerText  = `✓ Connected (${count} domains found)`;
    }
  } catch(e) {
    status.className = 'status err';
    status.innerText  = '✗ Connection failed: ' + e.message;
  }
}

// ── Save workspace config to chrome.storage.local ──
function saveWorkspace() {
  const backend = document.querySelector('input[name=backend]:checked')?.value;
  const status  = document.getElementById('status');

  let config = { backend };

  if (backend === 'supabase') {
    const url = document.getElementById('supa-url').value.trim();
    const key = document.getElementById('supa-key').value.trim();
    if (!url || !key) {
      status.className = 'status err';
      status.innerText  = 'Fill in both Supabase fields before saving.';
      return;
    }
    config.url     = url;
    config.anonKey = key;
    // Extract Supabase project ref from URL — needed for /s/{ref}/{domain} share URLs
    config.supabaseRef = url.replace('https://', '').split('.')[0];

  } else if (backend === 'firestore-custom') {
    const pid = document.getElementById('fs-project').value.trim();
    if (!pid) {
      status.className = 'status err';
      status.innerText  = 'Enter the Firebase Project ID before saving.';
      return;
    }
    config.projectId = pid;
  }

  chrome.storage.local.set({ janunet_workspace: config }, () => {
    updateCurrentBadge(backend);
    status.className = 'status ok';
    status.innerText  = '✓ Workspace saved. Reload any open JanuNet pages.';

    // Notify panel to reload with new backend
    chrome.runtime.sendMessage({ action: 'workspaceChanged', config });
  });
}
