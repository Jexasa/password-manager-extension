// Detect form submission for saving credentials
document.addEventListener('submit', (e) => {
  const form = e.target;
  const usernameInput = form.querySelector('input[type="text"], input[type="email"]');
  const passwordInput = form.querySelector('input[type="password"]');
  if (usernameInput && passwordInput) {
    const site = window.location.hostname;
    const username = usernameInput.value;
    const password = passwordInput.value;
    if (username && password) {
      chrome.runtime.sendMessage({
        action: 'promptSave',
        site,
        username,
        password
      });
    }
  }
});

// Detect focus on username/password fields for autofill
document.addEventListener('focusin', (e) => {
  const input = e.target;
  if (input.type === 'text' || input.type === 'email' || input.type === 'password') {
    const site = window.location.hostname;
    chrome.runtime.sendMessage({ action: 'checkCredentials', site }, (response) => {
      if (response && response.credentials) {
        showAutofillPrompt(input, response.credentials);
      }
    });
  }
});

function showAutofillPrompt(input, credentials) {
  const prompt = document.createElement('div');
  prompt.className = 'autofill-prompt';
  prompt.innerHTML = `
    <p>Autofill credentials?</p>
    <button id="autofillYes">Yes</button>
    <button id="autofillNo">No</button>
  `;
  const rect = input.getBoundingClientRect();
  prompt.style.top = `${rect.top - 60}px`;
  prompt.style.left = `${rect.left}px`;
  document.body.appendChild(prompt);

  document.getElementById('autofillYes').addEventListener('click', () => {
    const usernameInput = document.querySelector('input[type="text"], input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    if (usernameInput) usernameInput.value = credentials.username || '';
    if (passwordInput) passwordInput.value = credentials.password;
    prompt.remove();
  });

  document.getElementById('autofillNo').addEventListener('click', () => {
    prompt.remove();
  });
}

// Handle save prompt from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'showSavePrompt') {
    const { site, username, password } = msg;
    if (confirm(`Save credentials for ${site}?\nUsername: ${username}`)) {
      chrome.runtime.sendMessage({
        action: 'saveCredentials',
        site,
        username,
        password
      });
    }
  }
});