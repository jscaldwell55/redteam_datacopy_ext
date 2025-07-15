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
    showPageNotification('Error: Could not load remote configuration. Check options.', 'error', 10000);
    return;
  }

  class FormFillerApp {
    constructor(config) {
      this.config = config;
      this.currentPageType = this.detectPageType();
      this.init();
    }

    detectPageType() {
      const currentHref = window.location.href.toLowerCase();
      const hostname = window.location.hostname.toLowerCase();
      const pathname = window.location.pathname.toLowerCase();

      console.log(`[FormFillerApp] detectPageType: Href="${currentHref}", Hostname="${hostname}", Pathname="${pathname}"`);

      if (hostname.includes('forms.google.com')) {
        console.log('[FormFillerApp] Detected: GoogleForm');
        return 'GoogleForm';
      }

      if (this.config && this.config.platforms) {
        for (const platformName in this.config.platforms) {
          const platformConf = this.config.platforms[platformName];
          let hostMatch = false;
          let matchedHostname = '';

          if (platformConf.detectHostnames && Array.isArray(platformConf.detectHostnames)) {
            if (platformConf.detectHostnames.includes("*")) {
              hostMatch = true;
              matchedHostname = '* (wildcard)';
            } else {
              for (const h of platformConf.detectHostnames) {
                const hLower = h.toLowerCase();
                if (window.location.protocol === "file:" && currentHref.includes(hLower)) {
                  hostMatch = true; matchedHostname = h; break;
                } else if (hostname && hostname.includes(hLower)) {
                  hostMatch = true; matchedHostname = h; break;
                }
              }
            }
          }
          
          if (hostMatch) {
            let pathMatch = true;
            if (platformConf.detectPathnames && Array.isArray(platformConf.detectPathnames) && platformConf.detectPathnames.length > 0) {
              pathMatch = platformConf.detectPathnames.some(p_conf => pathname.includes(p_conf.toLowerCase()));
              if (!pathMatch) console.log(`[FormFillerApp] ...but path "${pathname}" didn't match:`, platformConf.detectPathnames);
            }
            if (pathMatch) {
              console.log(`[FormFillerApp] Successfully detected platform: ${platformName}`);
              return platformName;
            }
          }
        }
      }
      console.log(`[FormFillerApp] No matching platform found.`);
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
      if (this.currentPageType === 'Unknown' || !this.config) return;

      const button = document.createElement('div');
      button.id = 'formfiller-float-btn';
      let buttonText = '';
      let buttonAction = null;

      if (this.currentPageType === 'GoogleForm' || this.currentPageType === 'LocalTestTarget') { 
        button.className = 'formfiller-btn-fill';
        buttonText = '📝 Fill Form';
        buttonAction = () => this.fillGoogleForm();
      } 
      else if (this.config.platforms && this.config.platforms[this.currentPageType] && this.config.platforms[this.currentPageType].fields && this.config.platforms[this.currentPageType].fields.length > 0) {
        button.className = 'formfiller-btn-extract';
        buttonText = '📥 Extract Data';
        buttonAction = () => this.extractDataFromSource();
      } else {
        return; 
      }
      
      const iconSpan = document.createElement('span');
      iconSpan.textContent = buttonText.startsWith('📝') ? '📝' : '📥';
      const textSpan = document.createElement('span');
      textSpan.textContent = buttonText.substring(buttonText.indexOf(" ") + 1).trim(); 
      button.appendChild(iconSpan);
      button.appendChild(textSpan);
      
      if (buttonAction) {
        button.addEventListener('click', buttonAction);
        document.body.appendChild(button);
        console.log("[FormFillerApp] Floating button created:", buttonText);
      }
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'ping') {
          sendResponse({ status: "ready" });
          return; 
        }
        if (!this.config) {
          sendResponse({status: "error", message: "Configuration not loaded."});
          return true;
        }
        if (request.action === 'extractData') {
          this.extractDataFromSource().then(data => sendResponse({status: "ok", data: data}));
        } else if (request.action === 'fillForm') {
          this.fillGoogleForm().then(filledCount => sendResponse({status: "ok", filledCount: filledCount}));
        } else {
          sendResponse({status: "unknown_action", message: `Unknown action: ${request.action}`});
        }
        return true;
      });
    }

     async extractDataFromSource() {
    console.log("[FormFillerApp] Attempting to extract data for platform:", this.currentPageType);
    const platformConfig = this.config.platforms[this.currentPageType];
    if (!platformConfig || !platformConfig.fields || !Array.isArray(platformConfig.fields)) {
      showPageNotification('Error: No valid extraction configuration for this platform.', 'error');
      return null;
    }

    // --- START MERGE LOGIC ---
    // 1. Get existing data from storage first
    const storageResult = await chrome.storage.local.get(['formFillerExtractedData']);
    const extractedData = storageResult.formFillerExtractedData || {}; // Start with old data, or a new object

    // 2. Add/update metadata
    extractedData._sourcePlatform = this.currentPageType;
    extractedData._extractionTimestamp = new Date().toISOString();
    extractedData._sourceUrl = window.location.href;
    // --- END MERGE LOGIC ---

    let allRequiredFound = true;

    platformConfig.fields.forEach(fieldRule => {
      let text = null;
      if (fieldRule.selectors && Array.isArray(fieldRule.selectors)) {
        for (const selector of fieldRule.selectors) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              text = (element.innerText || element.value || element.textContent || '').trim();
              if (text) break;
            }
          } catch (e) { console.warn(`[FormFillerApp] Selector error for key '${fieldRule.key}':`, e); }
        }
      }
      if (text) {
        // --- This part now adds to the object instead of creating a new one ---
        extractedData[fieldRule.key] = this.cleanText(text);
        console.log(`[FormFillerApp] Extracted/Updated for key '${fieldRule.key}': "${extractedData[fieldRule.key].substring(0,50)}..."`);
      } else {
        if(fieldRule.required) {
          allRequiredFound = false;
          console.error(`[FormFillerApp] REQUIRED field key: ${fieldRule.key} was not found!`);
        }
      }
    });
    
    if (!allRequiredFound) {
       showPageNotification('Warning: Some required fields were not extracted. Check console.', 'warning');
    }

    await chrome.storage.local.set({ 'formFillerExtractedData': extractedData });
    showPageNotification('✅ Data Extracted!', 'success');
    
    return extractedData;
  }

    async fillGoogleForm() {
      console.log("[FormFillerApp] Attempting to fill Google Form.");
      const formConfig = this.config.googleForms;
      if (!formConfig || !formConfig.fieldMappings || !Array.isArray(formConfig.fieldMappings)) {
        showPageNotification('Error: Google Forms mapping config invalid.', 'error');
        return 0;
      }

      const result = await chrome.storage.local.get(['formFillerExtractedData']);
      const sourceData = result.formFillerExtractedData;

      if (!sourceData) {
        showPageNotification('No data found to fill. Extract data first.', 'warning');
        return 0;
      }
      console.log("[FormFillerApp] Data to fill:", sourceData);

      let fieldsFilledCount = 0;
      formConfig.fieldMappings.forEach(mappingRule => {
        const valueToFill = sourceData[mappingRule.dataKey];
        if (valueToFill === undefined || valueToFill === null || String(valueToFill).trim() === "") return;

        let fieldFoundAndFilled = false;
        if (mappingRule.selectors && Array.isArray(mappingRule.selectors)) {
            for (const selector of mappingRule.selectors) {
                try {
                    const element = document.querySelector(selector);
                    if (element && (!element.value || element.type === "radio" || element.type === "checkbox")) { 
                        this.fillElement(element, String(valueToFill));
                        fieldsFilledCount++;
                        fieldFoundAndFilled = true;
                        break; 
                    }
                } catch(e) { console.warn(`[FormFillerApp] Error with selector '${selector}':`, e); }
            }
        }
        if (!fieldFoundAndFilled && mappingRule.labelKeywords && Array.isArray(mappingRule.labelKeywords)) {
            const allInputs = document.querySelectorAll('textarea, input[type="text"]'); 
            for (const inputEl of allInputs) {
                if (inputEl.value) continue; 
                const labelElement = inputEl.closest('div[role="listitem"]')?.querySelector('div[role="heading"], span:not([class])'); 
                const combinedLabelText = (labelElement?.innerText || inputEl.getAttribute('aria-label') || '').toLowerCase();
                if (combinedLabelText && mappingRule.labelKeywords.some(kw => combinedLabelText.includes(kw.toLowerCase()))) {
                    this.fillElement(inputEl, String(valueToFill));
                    fieldsFilledCount++;
                    break; 
                }
            }
        }
      });
      
      if (fieldsFilledCount > 0) {
        showPageNotification(`✅ Filled ${fieldsFilledCount} field(s)!`, 'success');
      } else {
        showPageNotification('⚠️ No matching fields found or data to fill.', 'warning');
      }
      return fieldsFilledCount;
    }

    fillElement(element, value) {
      if (!element) return;
      element.value = String(value);
      ['input', 'change', 'blur', 'focus'].forEach(eventType => {
        try { element.dispatchEvent(new Event(eventType, { bubbles: true })); } catch (e) {}
      });
      element.focus(); 
      setTimeout(() => element.blur(), 30);
    }
    
    cleanText(text) {
      if (!text) return '';
      return String(text).replace(/\s+/g, ' ').trim();
    }
  } // End of FormFillerApp class

  // --- Global Helper for Page Notifications ---
  // Must be defined globally so it can be called at the very top if config fails
  function showPageNotification(message, type = 'info', duration = 4000) {
    const existing = document.getElementById('formfiller-notification');
    if (existing) existing.remove();
    const notification = document.createElement('div');
    notification.id = 'formfiller-notification';
    notification.className = `formfiller-notification formfiller-${type}`;
    notification.innerHTML = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('formfiller-show'), 100);
    setTimeout(() => {
      notification.classList.remove('formfiller-show');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  // --- Initialize the app ---
  function main() {
    new FormFillerApp(config);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(main, 500); 
  } else {
      document.addEventListener('DOMContentLoaded', () => {
          setTimeout(main, 500);
      });
  }

})();