// remoteConfigParser.js (for Google Sheet as CSV)
var RemoteConfigManager = (function() {
  let cachedConfig = null;
  let lastFetchTime = 0;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async function fetchAndParseConfigViaBackground(configUrl) {
    if (!configUrl) {
      console.error('[RCM_CSV] No config URL provided.');
      return null;
    }
    console.log('[RCM_CSV] Requesting background to fetch config from CSV URL:', configUrl);

    let rawCsvTextForError = "rawCsvText was not yet fetched";
    let jsonStringToParseForError = "jsonString was not yet extracted/cleaned";

    try {
      const responseFromBackground = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: "fetchRemoteConfig", url: configUrl },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(`Msg to BG error: ${chrome.runtime.lastError.message || "Unknown"}`));
            } else if (response && response.error) {
              reject(new Error(`BG script error: ${response.error}`));
            } else if (response && response.data !== undefined) {
              resolve(response);
            } else {
              reject(new Error("Invalid/missing 'data' in BG response."));
            }
          }
        );
      });

      if (responseFromBackground.data === null || responseFromBackground.data === undefined) {
          throw new Error("Data from BG (CSV content) is null/undefined.");
      }

      rawCsvTextForError = String(responseFromBackground.data);
      console.log('[RCM_CSV] rawCsvText received (first 1000 chars):', rawCsvTextForError.substring(0, 1000) + (rawCsvTextForError.length > 1000 ? "..." : ""));

      // The rawCsvText *should* be our JSON string, possibly with CSV quoting.
      // A single cell CSV containing JSON like {"key": "value, with comma"}
      // would be exported as: """{""key"": ""value, with comma""}"""
      // Or if it has newlines: """{␤""key"": ""value""␤}""" (where ␤ is newline)
      // If the JSON string has no commas, newlines, or double quotes, it might be exported as is.
      
      let jsonStringToParse = rawCsvTextForError.trim();

      // Attempt to remove CSV quoting if present (a simple case for a single cell)
      // This handles if the entire cell content was wrapped in double quotes by the CSV export.
      if (jsonStringToParse.startsWith('"') && jsonStringToParse.endsWith('"')) {
        // Remove the outer quotes
        jsonStringToParse = jsonStringToParse.substring(1, jsonStringToParse.length - 1);
        // Replace CSV-escaped double quotes ("") with a single double quote (")
        jsonStringToParse = jsonStringToParse.replace(/""/g, '"');
        console.log('[RCM_CSV] CSV content after basic de-quoting (first 500):', jsonStringToParse.substring(0,500));
      } else {
        console.log('[RCM_CSV] CSV content did not appear to be double-quoted. Using as is (first 500):', jsonStringToParse.substring(0,500));
      }
      
      jsonStringToParseForError = jsonStringToParse;
      if (!jsonStringToParse || jsonStringToParse.trim() === "") {
          throw new Error('jsonStringToParse became empty after CSV processing.');
      }
      
      console.log("[RCM_CSV] Final text being passed to JSON.parse():", jsonStringToParse);
      
      // Unicode cleaning (might still be useful if copy-pasting into Sheet cell introduced them)
      const cleanedJsonString = jsonStringToParse.replace(/[\u200B-\u200D\uFEFF]/g, '');
      if (cleanedJsonString !== jsonStringToParse) {
        console.log("[RCM_CSV] Cleaned text for JSON.parse (removed zero-width chars):", cleanedJsonString);
      }

      const parsedConfig = JSON.parse(cleanedJsonString); 
      
      cachedConfig = parsedConfig;
      lastFetchTime = Date.now();
      console.log('[RCM_CSV] Config (from CSV via background) fetched and parsed successfully!', parsedConfig);
      return parsedConfig;

    } catch (error) {
      console.error(`[RCM_CSV] Error in fetchAndParseConfigViaBackground: ${error.message}. 
Attempted to parse: [${jsonStringToParseForError.substring(0,200)}...]. 
Raw CSV received: [${rawCsvTextForError.substring(0,200)}...]`, error);
      return null;
    }
  } // End of fetchAndParseConfigViaBackground

  return {
    getConfig: async function() {
      const now = Date.now();
      if (cachedConfig && (now - lastFetchTime < CACHE_DURATION)) {
        console.log('[RCM_CSV] Returning cached config.');
        return cachedConfig;
      }
      
      const storageResult = await new Promise(resolve => {
          chrome.storage.sync.get(['formFillerConfigUrl'], result => { // Ensure key matches options.js
              if (chrome.runtime.lastError) {
                  console.error("[RCM_CSV] Error getting config URL from storage:", chrome.runtime.lastError.message);
                  resolve({ formFillerConfigUrl: null }); 
              } else {
                  resolve(result);
              }
          });
      });

      if (storageResult && storageResult.formFillerConfigUrl) {
        const config = await fetchAndParseConfigViaBackground(storageResult.formFillerConfigUrl);
        return config;
      } else {
        console.error('[RCM_CSV] Config URL not set or error retrieving from storage.');
        return null;
      }
    }
  };
})();