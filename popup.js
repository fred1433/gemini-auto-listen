const toggle = document.getElementById('toggle');
const status = document.getElementById('status');

chrome.storage.local.get(['autoListenEnabled'], (result) => {
  const enabled = result.autoListenEnabled !== false;
  toggle.checked = enabled;
  updateStatus(enabled);
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ autoListenEnabled: enabled }, () => {
    updateStatus(enabled);
  });
});

function updateStatus(enabled) {
  status.textContent = enabled ? 'Auto-listen enabled' : 'Auto-listen disabled';
  status.style.color = enabled ? '#4CAF50' : '#f44336';
}
