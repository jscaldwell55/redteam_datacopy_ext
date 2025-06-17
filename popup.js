// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const extractBtn = document.getElementById('extractBtn');
  const fillBtn = document.getElementById('fillBtn');
  const optionsBtn = document.getElementById('optionsBtn');
  const statusPopup = document.getElementById('statusPopup');

  function showStatus(message, isError = false) {
    statusPopup.textContent = message;
    statusPopup.className = isError ? 'status-error' : 'status-success';
    setTimeout(() => { statusPopup.textContent = ''; statusPopup.className = ''; }, 4000);
  }

  function sendMessageToContentScript(action, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].id) {
        showStatus('Cannot access current tab.', true);
        return;
      }
      if (tabs[0].url && (tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('about:'))) {
        showStatus('Cannot operate on this type of page.', true);
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: action }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus(`Error: ${chrome.runtime.lastError.message}. Try refreshing.`, true);
          console.error("Popup message error:", chrome.runtime.lastError.message, "Tab URL:", tabs[0].url);
          if (callback) callback({ error: chrome.runtime.lastError.message });
        } else if (response) {
          if (response.status === "ok") {
            if (action === 'extractData') showStatus('Data extraction initiated on page!', false);
            else if (action === 'fillForm') showStatus('Form fill initiated on page!', false);
            else showStatus('Action successful!', false);
          } else {
            showStatus(response.message || `Action failed: ${response.status}`, true);
          }
          if (callback) callback(response);
        } else {
          showStatus('No response from content script. Ensure it is active on this page.', true);
          if (callback) callback({ error: "No response from content script" });
        }
      });
    });
  }

  extractBtn.addEventListener('click', () => {
    sendMessageToContentScript('extractData');
  });

  fillBtn.addEventListener('click', () => {
    sendMessageToContentScript('fillForm');
  });

  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Check for previously extracted data to give context
  chrome.storage.local.get(['formFillerExtractedData'], (result) => {
    if (result.formFillerExtractedData) {
      const data = result.formFillerExtractedData;
      const platform = data._sourcePlatform || 'previously';
      const timeAgo = Math.round((Date.now() - new Date(data._extractionTimestamp).getTime()) / 60000);
      showStatus(`Data extracted from ${platform} ${timeAgo}m ago. Ready to fill.`, false);
    } else {
      showStatus("No data extracted yet.", false);
    }
  });
});