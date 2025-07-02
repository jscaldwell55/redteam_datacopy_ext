OVERVIEW

This is a functional prototype of a Chrome extension that automates data transfer between two browser tabs. It is designed to support rapid adaptation to new platforms via remote configuration.

Core Functionality

Extract: Scrapes data from a source webpage using CSS selectors defined in a remote config. Extracted key-value data is stored in chrome.storage.local.
Fill: Retrieves stored data and populates input fields on a target webpage (e.g., Google Form) by mapping data keys to form fields.

QUICK START

Load the Extension:
Go to chrome://extensions
Click "Load unpacked" and select this project folder

Configure:
Click the extension icon, then the ⚙️ Settings button.
Enter the published Google Sheet URL containing your JSON config.

Usage:
On a supported source page, click "Extract Data".
On a target form page, click "Fill Form".

ARCHITECTURE

manifest.json: Defines permissions, popup, options page, and content scripts.
content.js: Main logic (platform detection, UI, extraction, filling).
remoteConfigParser.js: Fetches and parses remote configuration.
background.js: Service worker for remote config fetch (CORS workaround).
popup.js/popup.html: Popup UI for user actions.
options.js/options.html: Options page for config URL.
styles.css: Styles for UI elements.

IMPLEMENTATION

Remote Configuration

Hosting: Config is a raw JSON string in a single cell of a Google Sheet, published as CSV.
Fetching: Background script fetches the config to avoid CORS issues.
Parsing: Handles CSV de-quoting, parses JSON, caches in memory.

Platform Detection

Uses detectHostnames and detectPathnames arrays in the config.
Supports "*" wildcard for local files or any domain.

Data Flow

Extract:
User clicks "Extract" on a source page.
extractDataFromSource() uses config selectors to scrape data.
Data is saved to chrome.storage.local as formFillerExtractedData.

Fill:
User clicks "Fill" on a target page.
fillGoogleForm() retrieves stored data.
Maps data keys to form fields using selectors or label keywords.
fillElement() sets values and dispatches events for compatibility.



Example Config Structure used for Demo

{
  "platforms": {
    "LocalTestTarget": {
      "detectHostnames": ["*"],
      "detectPathnames": ["mock_gform.html"]
    },
    "LocalTestSource": {
      "detectHostnames": ["*"],
      "detectPathnames": ["mock_feather.html"],
      "fields": [
        { "key": "firstPrompt", "selectors": ["div.user-prompt-selector-example"] },
        { "key": "finalResponse", "selectors": ["div.model-response-selector-example"] }
      ]
    },
    "Gemini": {
      "detectHostnames": [
        "gemini.google.com"
        
      ],
      "fields": [
        { "key": "firstPrompt", "selectors": [".query-text", ".user-query", ".user-prompt"], "required": true },
        { "key": "finalResponse", "selectors": [".response-content", ".model-response-text", ".output-content"], "required": true }
      ]
    }
  },
  "googleForms": {
    "fieldMappings": [
      { "dataKey": "firstPrompt", "labelKeywords": ["prompt"], "selectors": ["#the_prompt", "textarea[aria-label*='prompt'i]"] },
      { "dataKey": "finalResponse", "labelKeywords": ["response"], "selectors": ["#the_response", "textarea[aria-label*='response'i]"] }
    ]
  }
}

