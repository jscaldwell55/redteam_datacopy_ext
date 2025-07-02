OVERVIEW

Chrome extension that automates data transfer between two browser tabs. Designed to support rapid adaptation to new platforms via remote configuration.

Core Functionality

**Extract:** Scrapes data from a source webpage using CSS selectors defined in a remote config. Extracted key-value data is stored in chrome.storage.local.

**Fill:** Retrieves stored data and populates input fields on a target webpage (e.g., Google Form) by mapping data keys to form fields.

QUICK START

Load the Extension:
Go to chrome://extensions
Click "Load unpacked" and select this project folder

Configure:
Click the extension icon, then the ⚙️ Settings button.
Enter the published Google Sheet URL containing your JSON config.

To use:
On a supported source page, click "Extract Data".
On a target form page, click "Fill Form".


IMPLEMENTATION

Remote Configuration

**Hosting:** Config is a raw JSON string in a single cell of a Google Sheet, published as CSV.
**Fetching:** Background script fetches the config to avoid CORS issues.
**Parsing:** Handles CSV de-quoting, parses JSON, caches in memory.

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



