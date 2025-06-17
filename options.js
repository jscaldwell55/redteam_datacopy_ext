// options.js
document.addEventListener('DOMContentLoaded', () => {
  const configUrlInput = document.getElementById('configUrl');
  const saveBtn = document.getElementById('saveBtn');
  const statusMessage = document.getElementById('statusMessage');

  function displayStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? 'status-error' : 'status-success';
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = '';
    }, 3000);
  }

  chrome.storage.sync.get(['formFillerConfigUrl'], (result) => {
    if (result.formFillerConfigUrl) {
      configUrlInput.value = result.formFillerConfigUrl;
    }
  });

  saveBtn.addEventListener('click', () => {
    const url = configUrlInput.value.trim();
    if (!url) {
      displayStatus('Config URL is required.', true);
      return;
    }
    try {
      new URL(url); // Basic URL validation
    } catch (e) {
      displayStatus('Invalid Config URL format.', true);
      return;
    }

    chrome.storage.sync.set({ formFillerConfigUrl: url }, () => {
      if (chrome.runtime.lastError) {
        displayStatus(`Error saving settings: ${chrome.runtime.lastError.message}`, true);
      } else {
        displayStatus('Settings saved successfully!', false);
      }
    });
  });
});