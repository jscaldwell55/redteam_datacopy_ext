// content.js
(async function() {
  'use strict';

  // Wait for RemoteConfigManager to be available (loaded by manifest)
  await new Promise(resolve => {
    const interval = setInterval(() => {
      if (typeof RemoteConfigManager !== 'undefined') {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
  
  const config = await RemoteConfigManager.getConfig();

  if (!config) {
    // Make sure showPageNotification is defined or call it after FormFillerApp is potentially defined
    // For now, console.error is safest if it's called before class methods are available
    console.error('[FormFillerApp_EarlyError] Could not load remote configuration. Extension functionality limited. Please check options.');
    // Attempt to show a visual notification if possible, but it might fail if DOM isn't ready
    // or if showPageNotification is part of the class not yet instantiated.
    try {
        showPageNotification('Error: Could not load remote configuration. Extension functionality limited. Please check options.', 'error', 10000);
    } catch(e) {
        // console.error("Could not show page notification for config load error immediately.");
    }
    return;
  }

  class FormFillerApp {
    constructor(config) {
      this.config = config;
      this.currentPageType = this.detectPageType(); // Call detectPageType
      this.init();
    }

    detectPageType() {
      const currentHref = window.location.href.toLowerCase();
      const hostname = window.location.hostname.toLowerCase(); // Will be "" for file:///
      const pathname = window.location.pathname.toLowerCase(); // Includes leading slash

      console.log(`[FormFillerApp] detectPageType: Href="${currentHref}", Hostname="${hostname}", Pathname="${pathname}"`);

      // Specific check for Google Forms first
      if (hostname.includes('forms.google.com')) {
        console.log('[FormFillerApp] Detected: GoogleForm');
        return 'GoogleForm';
      }

      // Iterate through configured platforms
      if (this.config && this.config.platforms) {
        // The order of platforms in your JSON config might matter if multiple could match
        for (const platformName in this.config.platforms) { 
          const platformConf = this.config.platforms[platformName];
          let hostMatch = false;

          if (platformConf.detectHostnames && Array.isArray(platformConf.detectHostnames)) {
            if (platformConf.detectHostnames.includes("*")) {
              hostMatch = true; // Wildcard matches any host
              console.log(`[FormFillerApp] Platform ${platformName} matched host via wildcard "*" for Href: ${currentHref}`);
            } else {
              // Check for file protocol specifically or standard hostnames
              if (window.location.protocol === "file:") {
                 // For file URLs, hostname is empty. Match against currentHref if specific filenames are in detectHostnames
                 if (platformConf.detectHostnames.some(h => currentHref.includes(h.toLowerCase()))) {
                    hostMatch = true;
                    console.log(`[FormFillerApp] Platform ${platformName} matched file Href: ${currentHref} against configured host/path: ${h}`);
                 }
              } else if (hostname) { // For http/https URLs
                if (platformConf.detectHostnames.some(h => hostname.includes(h.toLowerCase()))) {
                    hostMatch = true;
                    console.log(`[FormFillerApp] Platform ${platformName} matched hostname: ${hostname} against configured host: ${h}`);
                }
              }
            }
          } else {
            // If detectHostnames is not defined for a platform, it cannot match by hostname.
            // Consider this a non-match for this iteration or a config error.
            // console.warn(`[FormFillerApp] Platform ${platformName} has no detectHostnames configured.`);
            continue; 
          }
          
          if (hostMatch) {
            let pathMatch = true; // Default to true if detectPathnames is not defined or empty
            if (platformConf.detectPathnames && Array.isArray(platformConf.detectPathnames) && platformConf.detectPathnames.length > 0) {
              pathMatch = platformConf.detectPathnames.some(p_conf => pathname.includes(p_conf.toLowerCase()));
              if (!pathMatch) {
                console.log(`[FormFillerApp] Host for ${platformName} matched, but path "${pathname}" didn't match configured paths:`, platformConf.detectPathnames);
              } else {
                console.log(`[FormFillerApp] Platform ${platformName} matched path: "${pathname}" against configured paths:`, platformConf.detectPathnames);
              }
            }

            if (pathMatch) { // Both host (or wildcard) and path (if specified) must match
              console.log(`[FormFillerApp] Successfully detected platform: ${platformName}`);
              return platformName;
            }
          }
        }
      }
      console.log(`[FormFillerApp] No matching platform found for Href: "${currentHref}"`);
      return 'Unknown';
    }


    init() {
      console.log(`[FormFillerApp] Initialized on page type: ${this.currentPageType}`);
      this.createFloatingButton();
      this.setupMessageListener();
    }

    createFloatingButton() {
      const existingBtn = document.getElementById('formfiller-float-btn');
      if (existingBtn) existingBtn.remove();

      if (this.currentPageType === 'Unknown' || !this.config) {
          console.log("[FormFillerApp] No floating button: page type Unknown or no config.");
          return;
      }

      const button = document.createElement('div');
      button.id = 'formfiller-float-btn';
      let buttonText = '';
      let buttonAction = null;

      // Check for form target types first
      // "MyMockFormTarget" is the key from your JSON config for the mock gform page
      if (this.currentPageType === 'GoogleForm' || this.currentPageType === 'MyMockFormTarget') { 
        button.className = 'formfiller-btn-fill'; // Use styles.css
        buttonText = '📝 Fill Form';
        buttonAction = () => this.fillGoogleForm();
      } 
      // Then, check if it's a known source platform that has 'fields' defined for extraction
      else if (this.config.platforms && 
               this.config.platforms[this.currentPageType] && 
               this.config.platforms[this.currentPageType].fields &&
               Array.isArray(this.config.platforms[this.currentPageType].fields) && // Ensure 'fields' is an array
               this.config.platforms[this.currentPageType].fields.length > 0) {
        button.className = 'formfiller-btn-extract'; // Use styles.css
        buttonText = '📥 Extract Data';
        buttonAction = () => this.extractDataFromSource();
      } else {
        console.log("[FormFillerApp] No appropriate floating button action for page type:", this.currentPageType, "Does it have fields for extraction or is it a known form target?");
        return; 
      }
      
      const iconSpan = document.createElement('span');
      iconSpan.textContent = buttonText.startsWith('📝') ? '📝' : '📥';
      const textSpan = document.createElement('span');
      const textPart = buttonText.substring(buttonText.indexOf(" ") + 1).trim(); 
      textSpan.textContent = textPart;

      button.appendChild(iconSpan);
      button.appendChild(textSpan);
      
      if (buttonAction) {
        button.addEventListener('click', buttonAction);
        document.body.appendChild(button);
        console.log("[FormFillerApp] Floating button created:", buttonText);
      } else {
        console.error("[FormFillerApp] No buttonAction defined for type:", this.currentPageType);
      }
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (!this.config) {
          sendResponse({status: "error", message: "Configuration not loaded."});
          return true; // Keep channel open
        }
        if (request.action === 'extractData') {
          this.extractDataFromSource().then(data => {
            if (data) {
              sendResponse({status: "ok", data: data, message: "Data extracted."});
            } else {
              sendResponse({status: "error", message: "Extraction failed or no data."});
            }
          });
        } else if (request.action === 'fillForm') {
          this.fillGoogleForm().then(filledCount => {
            sendResponse({status: "ok", filledCount: filledCount, message: `Filled ${filledCount} fields.`});
          });
        } else {
          sendResponse({status: "unknown_action", message: `Unknown action: ${request.action}`});
        }
        return true; // Indicates async response
      });
    }

    async extractDataFromSource() {
      console.log("[FormFillerApp] Attempting to extract data for platform:", this.currentPageType);
      const platformConfig = this.config.platforms[this.currentPageType];
      if (!platformConfig || !platformConfig.fields || !Array.isArray(platformConfig.fields)) {
        showPageNotification('Error: No valid extraction configuration for this platform.', 'error');
        console.error("[FormFillerApp] Extraction failed: Invalid platform config for", this.currentPageType, platformConfig);
        return null;
      }

      const extractedData = {
        _sourcePlatform: this.currentPageType,
        _extractionTimestamp: new Date().toISOString(),
        _sourceUrl: window.location.href
      };
      let allRequiredFound = true;

      platformConfig.fields.forEach(fieldRule => {
        let text = null;
        if (fieldRule.selectors && Array.isArray(fieldRule.selectors)) {
            for (const selector of fieldRule.selectors) {
              try {
                const element = document.querySelector(selector);
                if (element) {
                  text = (element.innerText || element.value || element.textContent || '').trim(); // Added element.textContent
                  if (text) break; 
                }
              } catch (e) { console.warn(`[FormFillerApp] Selector error for key '${fieldRule.key}' with selector '${selector}':`, e); }
            }
        }
        if (text) {
          extractedData[fieldRule.key] = this.cleanText(text);
          console.log(`[FormFillerApp] Extracted for key '${fieldRule.key}': "${extractedData[fieldRule.key].substring(0,50)}..."`);
        } else {
          console.warn(`[FormFillerApp] Data not found for key: ${fieldRule.key} (Selectors: ${fieldRule.selectors.join(', ')})`);
          extractedData[fieldRule.key] = ""; 
          if(fieldRule.required) {
            allRequiredFound = false;
            console.error(`[FormFillerApp] REQUIRED field key: ${fieldRule.key} was not found!`);
          }
        }
      });
      
      if (!allRequiredFound) {
         showPageNotification('Warning: Some required fields were not extracted. Check console.', 'warning', 5000);
      }

      await chrome.storage.local.set({ 'formFillerExtractedData': extractedData });
      showPageNotification('✅ Data extracted and saved!', 'success');
      
      if (this.config.copyToClipboardOnExtract) {
        // ... (clipboard logic as before) ...
      }
      return extractedData;
    }

    async fillGoogleForm() {
      console.log("[FormFillerApp] Attempting to fill Google Form.");
      const formConfig = this.config.googleForms;
      if (!formConfig || !formConfig.fieldMappings || !Array.isArray(formConfig.fieldMappings)) {
        showPageNotification('Error: Google Forms mapping configuration not found or invalid.', 'error');
        console.error("[FormFillerApp] Fill failed: Invalid googleForms config", formConfig);
        return 0;
      }

      const result = await chrome.storage.local.get(['formFillerExtractedData']);
      const sourceData = result.formFillerExtractedData;

      if (!sourceData) {
        showPageNotification('No data found to fill. Extract data from a source page first.', 'warning');
        return 0;
      }
      console.log("[FormFillerApp] Data to fill:", sourceData);

      let fieldsFilledCount = 0;
      formConfig.fieldMappings.forEach(mappingRule => {
        // ... (fillGoogleForm logic for fieldMappings as you had it, seems mostly okay) ...
        // Ensure mappingRule.selectors and mappingRule.labelKeywords are checked if they exist and are arrays
        // Ensure String(valueToFill) is used before .toLowerCase()
        // ...
        const valueToFill = sourceData[mappingRule.dataKey];
        if (valueToFill === undefined || valueToFill === null || String(valueToFill).trim() === "") {
            console.log(`[FormFillerApp] No data or empty data for key: ${mappingRule.dataKey}`);
            return; 
        }

        let fieldFoundAndFilled = false;
        // Try specific selectors first
        if (mappingRule.selectors && Array.isArray(mappingRule.selectors) && mappingRule.selectors.length > 0) {
            for (const selector of mappingRule.selectors) {
                try {
                    const element = document.querySelector(selector);
                    if (element && (!element.value || element.type === "radio" || element.type === "checkbox")) { 
                        console.log(`[FormFillerApp] Filling by specific selector '${selector}' for dataKey '${mappingRule.dataKey}'`);
                        this.fillElement(element, String(valueToFill));
                        fieldsFilledCount++;
                        fieldFoundAndFilled = true;
                        break; 
                    }
                } catch(e) { console.warn(`[FormFillerApp] Error with selector '${selector}' for dataKey '${mappingRule.dataKey}':`, e); }
            }
        }
        // Try label keywords if not filled by specific selector
        if (!fieldFoundAndFilled && mappingRule.labelKeywords && Array.isArray(mappingRule.labelKeywords) && mappingRule.labelKeywords.length > 0) {
            const allInputs = document.querySelectorAll('textarea, input[type="text"], input[type="radio"], input[type="checkbox"]'); 
            for (const inputEl of allInputs) {
                if (inputEl.value && inputEl.type !== "radio" && inputEl.type !== "checkbox") continue; 

                const labelElement = inputEl.closest('div[role="listitem"]')?.querySelector('div[role="heading"], span:not([class])'); 
                const ariaLabel = inputEl.getAttribute('aria-label');
                const placeholder = inputEl.getAttribute('placeholder');
                let combinedLabelText = (labelElement?.innerText || ariaLabel || placeholder || '').toLowerCase();
                
                if (combinedLabelText && mappingRule.labelKeywords.some(kw => combinedLabelText.includes(kw.toLowerCase()))) {
                    console.log(`[FormFillerApp] Filling by keyword '${mappingRule.labelKeywords.find(kw => combinedLabelText.includes(kw.toLowerCase()))}' for dataKey '${mappingRule.dataKey}'`);
                    this.fillElement(inputEl, String(valueToFill));
                    fieldsFilledCount++;
                    fieldFoundAndFilled = true; // Mark as filled
                    break; 
                }
            }
        }
      });

      // Fallback logic
      if (fieldsFilledCount < Object.keys(sourceData).filter(k => !k.startsWith("_") && sourceData[k] !== "").length && 
          formConfig.enableFallbackFilling && 
          formConfig.fallbackSelectors && 
          Array.isArray(formConfig.fallbackSelectors)) {
          
          console.log("[FormFillerApp] Attempting fallback filling.");
          // Simplified fallback: find UNFILLED configured dataKeys and try to map them to remaining empty fallbackSelectors
          const alreadyMappedDataKeys = new Set(formConfig.fieldMappings.map(m => m.dataKey));
          const unmappedSourceData = {};
          Object.keys(sourceData).forEach(key => {
              if (!key.startsWith("_") && !alreadyMappedDataKeys.has(key) && sourceData[key] !== "") {
                  unmappedSourceData[key] = sourceData[key];
              }
          });

          const unmappedValues = Object.values(unmappedSourceData);
          let valueIdx = 0;
          const fallbackInputs = document.querySelectorAll(formConfig.fallbackSelectors.join(','));

          fallbackInputs.forEach(inputEl => {
              if (valueIdx < unmappedValues.length && (!inputEl.value || inputEl.type === "radio" || inputEl.type === "checkbox")) {
                  console.log(`[FormFillerApp] Fallback filling with value: "${String(unmappedValues[valueIdx]).substring(0,30)}..."`);
                  this.fillElement(inputEl, String(unmappedValues[valueIdx]));
                  fieldsFilledCount++;
                  valueIdx++;
              }
          });
      }

      if (fieldsFilledCount > 0) {
        showPageNotification(`✅ Filled ${fieldsFilledCount} field(s)!`, 'success');
      } else {
        showPageNotification('⚠️ No matching fields found or data to fill/already present.', 'warning');
      }
      return fieldsFilledCount;
    }

    fillElement(element, value) {
      // ... (fillElement logic as you had it, seems okay - ensure String(value) is used for comparisons) ...
      // Added check for null element
      if (!element) {
          console.warn("[FormFillerApp] fillElement called with null element for value:", value);
          return;
      }
      const SValue = String(value); // Work with string value

      if (element.type === "radio" || element.type === "checkbox") {
          const elementValue = element.value?.toLowerCase();
          const labelText = (element.closest('label')?.innerText || element.parentElement?.innerText || '').toLowerCase();
          const valueToMatch = SValue.toLowerCase();

          let matchFound = false;
          if (element.type === "radio") { // Radio buttons often need exact value match or specific label part
              if (elementValue === valueToMatch) matchFound = true;
              // For radio, sometimes label directly corresponds, or a part of it for boolean-like choices
              else if (labelText.includes(valueToMatch) && (valueToMatch === "true" || valueToMatch === "false" || valueToMatch === "yes" || valueToMatch === "no")) matchFound = true;
          } else { // Checkbox
              if (labelText.includes(valueToMatch) || elementValue === valueToMatch) matchFound = true;
              // For boolean checkboxes, often just need to check based on true/false string
              if (!matchFound && (valueToMatch === "true" || valueToMatch === "yes")) {
                  matchFound = true; // Assume we just need to check it
              } else if (!matchFound && (valueToMatch === "false" || valueToMatch === "no")) {
                  // If value is "false" for a checkbox, we usually want to uncheck it or leave it.
                  // For simplicity, we'll only *check* if a match indicates true.
                  // To uncheck: element.checked = false;
                  return; // Don't fill/check if the value implies "false" for a checkbox
              }
          }
          
          if (matchFound && element.checked !== true) {
            element.checked = true;
            element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('change', { bubbles: true })); // Ensure change event fires
          }
      } else { // For text inputs, textareas
        element.value = SValue;
      }

      ['input', 'change'].forEach(eventType => { // Focus on essential data events
        try {
          element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
        } catch (e) { /* console.warn(`Error dispatching ${eventType} event:`, e); */ }
      });
      // Blur/focus for reactivity, especially for frameworks
      if (element.type !== "radio" && element.type !== "checkbox") {
        element.focus(); 
        setTimeout(() => element.blur(), 30);
      }
    }
    
    cleanText(text) {
      if (!text) return '';
      return String(text).replace(/\s+/g, ' ').trim(); // Consolidate whitespace then trim
    }
  } // End of FormFillerApp class

  // --- Global Helper for Page Notifications ---
  function showPageNotification(message, type = 'info', duration = 4000) {
    // ... (showPageNotification function as you had it) ...
  }

  // --- Initialize the app ---
  // Ensure DOM is ready and then give a slight delay for SPAs
  function main() {
    if (typeof RemoteConfigManager !== 'undefined' && config) { // Ensure config is truly loaded
        console.log("[FormFillerApp] Initializing main app with config:", config);
        new FormFillerApp(config);
    } else if (typeof RemoteConfigManager !== 'undefined' && !config) {
        // This case was handled at the top, but as a fallback if that was missed
        showPageNotification('Critical Error: Configuration was not loaded. Extension disabled.', 'error', 15000);
        console.error("[FormFillerApp] Main initialization: Config object is null or undefined even after initial check.");
    } else {
        // This case should not be hit if manifest loads scripts in order
        showPageNotification('Critical Error: RemoteConfigManager not available. Extension cannot start.', 'error', 15000);
        console.error("[FormFillerApp] Main initialization: RemoteConfigManager is undefined.");
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(main, 500); 
  } else {
      document.addEventListener('DOMContentLoaded', () => {
          setTimeout(main, 500);
      });
  }

})();