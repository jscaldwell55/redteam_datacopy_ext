// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('Red Team Form Filler extension installed/updated.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchRemoteConfig") {
    if (!request.url) {
      sendResponse({ error: "No URL provided for fetching config." });
      return true; // Keep channel open for async response
    }

    fetch(request.url)
      .then(response => {
        if (!response.ok) {
          // Send back status and statusText for better debugging in content script
          throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
        }
        return response.text(); // Send the raw HTML text back
      })
      .then(text => {
        sendResponse({ data: text });
      })
      .catch(error => {
        // Ensure the error message is a string
        sendResponse({ error: String(error.message || error) });
      });
    return true; // Indicates you wish to send a response asynchronously
  }
});