// background.js — relay MC_STATE messages from content to popup
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'MC_STATE') {
    // Broadcast to all extension views (popup)
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
});
