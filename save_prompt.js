document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get('pendingSave', (data) => {
      const { site, password } = data.pendingSave;
      document.getElementById('savePrompt').textContent = `Save password for ${site}?`;
      
      document.getElementById('saveYes').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'encryptAndSave', site, password }, (response) => {
          if (response.success) window.close();
        });
      });
      
      document.getElementById('saveNo').addEventListener('click', () => {
        window.close();
      });
    });
  
    // Close prompt on outside click
    document.addEventListener('click', (e) => {
      if (!document.querySelector('.container').contains(e.target)) {
        window.close();
      }
    });
  });