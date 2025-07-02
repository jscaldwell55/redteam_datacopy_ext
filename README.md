**Overview**

Chrome extension that automates data transfer between two browser tabs. Designed to support rapid adaptation to new platforms via remote configuration.

Core Functionality

Extract: Scrapes data from a source webpage using CSS selectors defined in a remote config. Extracted key-value data is stored in chrome.storage.local. <br>

Fill: Retrieves stored data and populates input fields on a target webpage (e.g., Google Form) by mapping data keys to form fields.

**Quick Start**

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

Remote Configuration

Hosting: Config is a raw JSON string in a single cell of a Google Sheet, published as CSV. <br>
Fetching: Background script fetches the config to avoid CORS issues. <br>
Parsing: Handles CSV de-quoting, parses JSON, caches in memory.

Platform Detection

Uses detectHostnames and detectPathnames arrays in the config. <br>
Supports "*" wildcard for local files or any domain.

Data Flow

Extract: <br>
User clicks "Extract" on a source page. <br>
extractDataFromSource() uses config selectors to scrape data. <br>
Data is saved to chrome.storage.local as formFillerExtractedData.

Fill: <br>
User clicks "Fill" on a target page. <br>
fillGoogleForm() retrieves stored data. <br>
Maps data keys to form fields using selectors or label keywords. <br>
fillElement() sets values and dispatches events for compatibility. <br>



