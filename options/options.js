const SETTINGS_KEY = 'manipulation_auditor_settings';

document.addEventListener('DOMContentLoaded', async () => {
  const r = await chrome.storage.local.get([SETTINGS_KEY]);
  const s = r[SETTINGS_KEY] || {};
  document.getElementById('apiKey').value = s.apiKey || '';
  document.getElementById('provider').value = s.provider || 'gemini';

  document.getElementById('save').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const provider = document.getElementById('provider').value;
    await chrome.storage.local.set({
      [SETTINGS_KEY]: { apiKey, provider },
    });
    document.getElementById('saved').style.display = 'block';
    setTimeout(() => { document.getElementById('saved').style.display = 'none'; }, 2000);
  });
});
