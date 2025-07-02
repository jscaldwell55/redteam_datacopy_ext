**Overview**

Prototype for Chrome extension that automates data transfer between two browser tabs. Designed to support rapid adaptation to new platforms via remote configuration.

Core Functionality

Extract: Scrapes data from a source webpage using CSS selectors defined in a remote config. Extracted key-value data is stored in chrome.storage.local. <br>

Fill: Retrieves stored data and populates input fields on a target webpage by mapping data keys to form fields.

**Installation and Usage**

Load the Extension: <br>
Go to chrome://extensions <br>
Click "Load unpacked" and select this project folder

Configure: <br>
Click the extension icon, then the ⚙️ Settings button. <br>
Enter the published Google Sheet URL containing your JSON config.

To use: <br>
On a supported source page, click "Extract Data". <br>
On a target form page, click "Fill Form".


**Implementation**

1. Remote Configuration

Hosting: Config is a raw JSON string in a single cell of a Google Sheet, published as CSV. <br>
Fetching: Background script fetches the config to avoid CORS issues. <br>
Parsing: Handles CSV de-quoting, parses JSON, caches in memory.

2. Platform Detection

Uses detectHostnames and detectPathnames arrays in the config. <br>
Supports "*" wildcard for local files or any domain.

3. Data Flow

Extract: <br>
User clicks "Extract" on a source page. <br>
extractDataFromSource() uses config selectors to scrape data. <br>
Data is saved to chrome.storage.local as formFillerExtractedData.

Fill: <br>
User clicks "Fill" on a target page. <br>
fillGoogleForm() retrieves stored data. <br>
Maps data keys to form fields using selectors or label keywords. <br>
fillElement() sets values and dispatches events for compatibility. <br>

**New Project Flow**

Config mapping is created and tested at the Lead level. Once ready, the web address of the remote config is sent to team members who copy/paste it into their extension Settings. They can then begin using for that project.  


**Example Config Structure** (used in initial test)

{
"platforms": {
"LocalTestTarget": {
"detectHostnames": [""],
"detectPathnames": ["mock_gform.html"]
},
"LocalTestSource": {
"detectHostnames": [""],
"detectPathnames": ["mock_feather.html"],
"fields": [
{ "key": "firstPrompt", "selectors": ["div.user-prompt-selector-example"] },
{ "key": "finalResponse", "selectors": ["div.model-response-selector-example"] }
]
},
"Gemini": {
"detectHostnames": [
"gemini.google.com",
"ai.google.dev"
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


