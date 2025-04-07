// Global variables
let masterKey = null;
let username = null;
let isMinimized = false;

// Initialize extension on popup load
document.addEventListener('DOMContentLoaded', async () => {
  const { masterHash, storedUsername, sessionToken, sessionTimeout } = await chrome.storage.sync.get(['masterHash', 'storedUsername', 'sessionToken', 'sessionTimeout']);
  
  // Check background for persisted masterKey
  chrome.runtime.sendMessage({ action: 'getMasterKey' }, (response) => {
    if (response && response.masterKey) {
      masterKey = response.masterKey;
    }
    initializeUI(masterHash, storedUsername, sessionToken, sessionTimeout);
  });

  // Minimize on outside click
  document.addEventListener('click', (e) => {
    const container = document.querySelector('.container');
    if (!container.contains(e.target) && !isMinimized) {
      minimizePopup();
    }
  });

  // Minimize button
  document.getElementById('minimizeBtn').addEventListener('click', minimizePopup);

  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', () => {
    document.getElementById('logoutConfirm').style.display = 'flex';
  });

  // Back button for passwords page
  document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('passwordsPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
  });
});

function initializeUI(masterHash, storedUsername, sessionToken, sessionTimeout) {
  if (!masterHash || !storedUsername) {
    document.getElementById('masterSetup').style.display = 'block';
  } else {
    username = storedUsername;
    document.getElementById('usernameDisplay').textContent = username;
    const now = Date.now();
    if (sessionToken && sessionTimeout && now - sessionTimeout < 60000 && masterKey) {
      showMainContent();
    } else {
      document.getElementById('loginSection').style.display = 'block';
      document.getElementById('loginUsername').textContent = `Welcome back, ${username}`;
      document.getElementById('minimizeBtn').style.display = 'inline-block';
    }
  }
}

function minimizePopup() {
  if (!isMinimized) {
    isMinimized = true;
    document.body.classList.add('minimized');
    document.querySelector('.container').style.display = 'none';
    chrome.storage.sync.set({ sessionTimeout: Date.now() });
    chrome.runtime.sendMessage({ action: 'minimize' });
  }
}

function restorePopup() {
  isMinimized = false;
  document.body.classList.remove('minimized');
  document.querySelector('.container').style.display = 'block';
}

// Set initial username and master password
document.getElementById('setMasterBtn').addEventListener('click', async () => {
  try {
    const newUsername = document.getElementById('usernameInput').value;
    const masterPassword = document.getElementById('masterInput').value;
    if (!newUsername || !masterPassword) {
      document.getElementById('masterError').textContent = 'Username and master password cannot be empty.';
      return;
    }
    const hash = await hashPassword(masterPassword);
    masterKey = await deriveKey(masterPassword);
    username = newUsername;
    const sessionToken = await encryptSessionToken('SESSION_ACTIVE');
    await chrome.storage.sync.set({ masterHash: hash, storedUsername: newUsername, sessionToken, sessionTimeout: Date.now() });
    chrome.runtime.sendMessage({ action: 'setMasterKey', masterKey });
    document.getElementById('masterSetup').style.display = 'none';
    showMainContent();
  } catch (e) {
    document.getElementById('masterError').textContent = 'Error setting credentials.';
    console.error('Set Master Error:', e);
  }
});

// Auto-login with live password validation
document.getElementById('loginMasterInput').addEventListener('input', async (e) => {
  const masterPassword = e.target.value;
  const status = document.getElementById('passwordStatus');
  const input = document.getElementById('loginMasterInput');
  const { masterHash, sessionToken } = await chrome.storage.sync.get(['masterHash', 'sessionToken']);
  
  if (!masterPassword) {
    status.textContent = '';
    input.classList.remove('valid', 'invalid');
    return;
  }

  try {
    const hash = await hashPassword(masterPassword);
    if (hash === masterHash) {
      masterKey = await deriveKey(masterPassword);
      const now = Date.now();
      let isSessionValid = false;
      if (sessionToken && sessionToken.iv && sessionToken.encrypted) {
        const decryptedToken = await decryptSessionToken(sessionToken);
        const { sessionTimeout } = await chrome.storage.sync.get('sessionTimeout');
        isSessionValid = decryptedToken === 'SESSION_ACTIVE' && now - sessionTimeout < 60000;
      }
      status.textContent = '\u2714';
      input.classList.remove('invalid');
      input.classList.add('valid');
      setTimeout(async () => {
        if (!isSessionValid) {
          const newSessionToken = await encryptSessionToken('SESSION_ACTIVE');
          await chrome.storage.sync.set({ sessionToken: newSessionToken, sessionTimeout: now });
        }
        chrome.runtime.sendMessage({ action: 'setMasterKey', masterKey });
        document.getElementById('loginSection').style.display = 'none';
        showMainContent();
      }, 300);
    } else {
      status.textContent = '\u2718';
      input.classList.remove('valid');
      input.classList.add('invalid');
    }
  } catch (e) {
    console.error('Login Error:', e);
    input.classList.add('invalid');
    status.textContent = '\u2718';
  }
});

// Display main content after login
function showMainContent() {
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('usernameDisplay').textContent = username;
  document.getElementById('minimizeBtn').style.display = 'inline-block';
  document.getElementById('logoutBtn').style.display = 'inline-block';
  if (isMinimized) restorePopup();
}

// Handle logout confirmation
document.getElementById('confirmLogout').addEventListener('click', async () => {
  masterKey = null;
  await chrome.storage.sync.remove(['sessionToken', 'sessionTimeout']);
  chrome.runtime.sendMessage({ action: 'clearMasterKey' });
  document.getElementById('mainContent').style.display = 'none';
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('logoutConfirm').style.display = 'none';
  document.getElementById('loginMasterInput').value = '';
  document.getElementById('passwordStatus').textContent = '';
  document.getElementById('loginMasterInput').classList.remove('valid', 'invalid');
  document.getElementById('logoutBtn').style.display = 'none';
});

document.getElementById('cancelLogout').addEventListener('click', () => {
  document.getElementById('logoutConfirm').style.display = 'none';
});

// Live password strength checker
document.getElementById('checkInput').addEventListener('input', (e) => {
  const password = e.target.value;
  const feedback = checkPassword(password);
  updateFeedbackUI(feedback);
});

function checkPassword(password) {
  const feedback = [];
  if (password.length < 12) feedback.push('Needs 12+ characters');
  else feedback.push('Length: 12+ characters');
  if (!/[A-Z]/.test(password)) feedback.push('Needs an uppercase letter');
  else feedback.push('Has uppercase letter');
  if (!/[0-9]/.test(password)) feedback.push('Needs a number');
  else feedback.push('Has number');
  if (!/[!@#$%^&*]/.test(password)) feedback.push('Needs a special character (!@#$%^&*)');
  else feedback.push('Has special character');
  return feedback;
}

function updateFeedbackUI(feedback) {
  const list = document.getElementById('checkFeedback');
  list.innerHTML = '';
  feedback.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    li.className = item.startsWith('Needs') ? '' : 'pass';
    list.appendChild(li);
  });
}

// Generate and copy password
document.getElementById('generateBtn').addEventListener('click', async () => {
  try {
    const password = await generatePassword(16);
    document.getElementById('generatedPassword').textContent = password;
    const copyBtn = document.getElementById('copyBtn');
    copyBtn.style.display = 'inline-block';
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(password).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 1000);
      }).catch(e => {
        console.error('Copy Error:', e);
        copyBtn.textContent = 'Copy Failed';
      });
    };
  } catch (e) {
    document.getElementById('generatedPassword').textContent = 'Error generating password.';
    console.error('Generate Error:', e);
  }
});

async function generatePassword(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

// Encryption and decryption utilities
async function deriveKey(password) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(text) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    encoder.encode(text)
  );
  return { iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)) };
}

async function decrypt(encryptedData, iv) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    masterKey,
    new Uint8Array(encryptedData)
  );
  return new TextDecoder().decode(decrypted);
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Session token management
async function encryptSessionToken(text) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    encoder.encode(text)
  );
  return { iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)) };
}

async function decryptSessionToken(token) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(token.iv) },
    masterKey,
    new Uint8Array(token.encrypted)
  );
  return new TextDecoder().decode(decrypted);
}

// Save new password
document.getElementById('saveBtn').addEventListener('click', async () => {
  try {
    const site = document.getElementById('siteInput').value;
    const password = document.getElementById('saveInput').value;
    if (!site || !password || !masterKey) {
      document.getElementById('saveResult').textContent = 'Enter site and password!';
      document.getElementById('saveResult').classList.remove('success');
      return;
    }
    const encrypted = await encrypt(password);
    const data = await chrome.storage.sync.get('passwords');
    const passwords = data.passwords || {};
    passwords[site] = { encrypted: encrypted.encrypted, iv: encrypted.iv };
    await chrome.storage.sync.set({ passwords });
    const saveResult = document.getElementById('saveResult');
    saveResult.textContent = 'Password saved!';
    saveResult.classList.add('success');
    setTimeout(() => {
      saveResult.textContent = '';
      saveResult.classList.remove('success');
    }, 2000);
    if (document.getElementById('passwordsPage').style.display === 'block') {
      loadSavedPasswords();
    }
  } catch (e) {
    document.getElementById('saveResult').textContent = 'Error saving password.';
    document.getElementById('saveResult').classList.remove('success');
    console.error('Save Error:', e);
  }
});

// Toggle saved passwords display
document.getElementById('showPasswordsBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  document.getElementById('mainContent').style.display = 'none';
  document.getElementById('passwordsPage').style.display = 'block';
  await loadSavedPasswords();
});

// Load and manage saved passwords
async function loadSavedPasswords() {
  if (!masterKey) return;
  try {
    const data = await chrome.storage.sync.get('passwords');
    const passwords = data.passwords || {};
    const list = document.getElementById('passwordList');
    list.innerHTML = '<tr><th>Site</th><th>Password</th><th>Actions</th></tr>';

    for (const site in passwords) {
      const { encrypted, iv } = passwords[site];
      try {
        const decrypted = await decrypt(encrypted, iv);
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${site}</td>
          <td>${decrypted}</td>
          <td class="password-actions">
            <button class="edit-btn">Edit</button>
            <button class="delete-btn">Delete</button>
          </td>`;
        list.appendChild(row);

        row.querySelector('.edit-btn').addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const editRow = document.createElement('tr');
          editRow.innerHTML = `
            <td><input type="text" class="edit-site" value="${site}"></td>
            <td><input type="text" class="edit-password" value="${decrypted}"></td>
            <td class="password-actions">
              <button class="save-edit">Save</button>
              <button class="cancel-edit">Cancel</button>
            </td>`;
          list.replaceChild(editRow, row);
          
          editRow.querySelector('.save-edit').addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              const newSite = editRow.querySelector('.edit-site').value;
              const newPassword = editRow.querySelector('.edit-password').value;
              if (newSite && newPassword) {
                const newEncrypted = await encrypt(newPassword);
                delete passwords[site];
                passwords[newSite] = { encrypted: newEncrypted.encrypted, iv: newEncrypted.iv };
                await chrome.storage.sync.set({ passwords });
                await loadSavedPasswords();
              }
            } catch (err) {
              console.error('Edit Error:', err);
              alert('Failed to save edited password.');
            }
          });
          
          editRow.querySelector('.cancel-edit').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            loadSavedPasswords();
          });
        });
        
        row.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          row.querySelector('.password-actions').innerHTML = `
            <button class="confirm-delete">Confirm</button>
            <button class="cancel-delete">Cancel</button>`;
          
          row.querySelector('.confirm-delete').addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              delete passwords[site];
              await chrome.storage.sync.set({ passwords });
              await loadSavedPasswords();
            } catch (err) {
              console.error('Delete Error:', err);
              alert('Failed to delete password.');
            }
          });
          
          row.querySelector('.cancel-delete').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            loadSavedPasswords();
          });
        });
      } catch (e) {
        console.error(`Decryption failed for ${site}:`, e);
      }
    }
  } catch (e) {
    console.error('Error loading passwords:', e);
    document.getElementById('passwordList').innerHTML = '<tr><td colspan="3">Error loading passwords.</td></tr>';
  }
}