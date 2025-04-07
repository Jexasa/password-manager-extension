let masterKey = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'setMasterKey') {
    masterKey = msg.masterKey;
    sendResponse({ success: true });
  } else if (msg.action === 'getMasterKey') {
    sendResponse({ masterKey });
  } else if (msg.action === 'clearMasterKey') {
    masterKey = null;
    sendResponse({ success: true });
  } else if (msg.action === 'minimize') {
    sendResponse({ success: true });
  } else if (msg.action === 'promptSave') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'showSavePrompt',
        site: msg.site,
        username: msg.username,
        password: msg.password
      });
    });
  } else if (msg.action === 'saveCredentials') {
    chrome.storage.sync.get('passwords', async (data) => {
      const passwords = data.passwords || {};
      const encrypted = await encrypt(msg.password, masterKey);
      passwords[msg.site] = { encrypted: encrypted.encrypted, iv: encrypted.iv, username: msg.username };
      await chrome.storage.sync.set({ passwords });
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  } else if (msg.action === 'checkCredentials') {
    chrome.storage.sync.get('passwords', async (data) => {
      const passwords = data.passwords || {};
      if (passwords[msg.site] && masterKey) {
        const decrypted = await decrypt(passwords[msg.site].encrypted, passwords[msg.site].iv, masterKey);
        sendResponse({ credentials: { username: passwords[msg.site].username, password: decrypted } });
      } else {
        sendResponse({ credentials: null });
      }
    });
    return true; // Keep message channel open for async response
  }
});

// Reset masterKey after 1 minute of inactivity
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.sessionTimeout) {
    const timeout = changes.sessionTimeout.newValue;
    setTimeout(() => {
      chrome.storage.sync.get('sessionTimeout', (data) => {
        if (Date.now() - data.sessionTimeout >= 60000) {
          masterKey = null;
        }
      });
    }, 60000);
  }
});

// Encryption utilities
async function encrypt(text, key) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );
  return { iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)) };
}

async function decrypt(encryptedData, iv, key) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(encryptedData)
  );
  return new TextDecoder().decode(decrypted);
}