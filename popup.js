const badge     = document.getElementById('badge');
const toggleBtn = document.getElementById('toggleBtn');
const btnIcon   = document.getElementById('btnIcon');
const btnText   = document.getElementById('btnText');
let isActive = false;

// ── Query current state when popup opens ──────────────────
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) return;
  if (isBadUrl(tabs[0].url || '')) return;
  chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => window.__MC_STATE ? window.__MC_STATE() : false
  }, (results) => {
    if (chrome.runtime.lastError) return;
    setUI(!!(results && results[0] && results[0].result));
  });
});

// ── Listen for state pushed from content script ───────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'MC_STATE') setUI(msg.active);
});

// ── Toggle button ─────────────────────────────────────────
toggleBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const url = tabs[0].url || '';
    if (isBadUrl(url)) { showError('Navigate to a real website first!'); return; }

    chrome.tabs.sendMessage(tabs[0].id, { action: 'MC_TOGGLE' }, () => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }, () => {
          if (chrome.runtime.lastError) { showError('Cannot run on this page.'); return; }
          setTimeout(() => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'MC_ACTIVATE' });
            setUI(true);
          }, 200);
        });
        return;
      }
      setUI(!isActive);
    });
  });
});

function isBadUrl(url) {
  return url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') || url.startsWith('about:');
}

function setUI(active) {
  isActive = active;
  if (active) {
    badge.textContent = 'Active';
    badge.className = 'badge on';
    toggleBtn.className = 'btn deactivate';
    btnIcon.textContent = '⏹';
    btnText.textContent = 'Deactivate';
  } else {
    badge.textContent = 'Inactive';
    badge.className = 'badge off';
    toggleBtn.className = 'btn activate';
    btnIcon.textContent = '✦';
    btnText.textContent = 'Activate';
  }
}

function showError(msg) {
  const hint = document.querySelector('.hint');
  hint.textContent = msg;
  hint.style.color = '#f87171';
  setTimeout(() => {
    hint.textContent = 'Double tap ` to toggle anywhere';
    hint.style.color = '';
  }, 3000);
}
