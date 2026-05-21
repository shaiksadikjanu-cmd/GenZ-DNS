let current = 0;
const total = 3;

function updateDots() {
  for (let i = 0; i < total; i++) {
    const dot = document.getElementById(`dot-${i}`);
    dot.className = 'dot' + (i === current ? ' active' : i < current ? ' done' : '');
  }
}

function showStep(n) {
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.toggle('active', i === n);
  });
  updateDots();
}

function nextStep() {
  if (current < total - 1) { current++; showStep(current); }
}
function prevStep() {
  if (current > 0) { current--; showStep(current); }
}
function finish() {
  chrome.storage.local.set({ onboardingDone: true });
  window.close();
}
