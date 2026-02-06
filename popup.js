// Popup pour toggle on/off
const toggle = document.getElementById('toggle');
const status = document.getElementById('status');

// Charger l'état actuel
chrome.storage.local.get(['autoListenEnabled'], (result) => {
  // Par défaut activé si pas encore défini
  const enabled = result.autoListenEnabled !== false;
  toggle.checked = enabled;
  updateStatus(enabled);
});

// Sauvegarder quand on change
toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ autoListenEnabled: enabled }, () => {
    updateStatus(enabled);
  });
});

function updateStatus(enabled) {
  status.textContent = enabled ? 'Lecture auto activee' : 'Lecture auto desactivee';
  status.style.color = enabled ? '#4CAF50' : '#f44336';
}
