document.addEventListener('DOMContentLoaded', async () => {
  loadOverview();
  await loadSettings();

  document.querySelectorAll('.nav-item').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      document.querySelectorAll('.nav-item').forEach((l) => l.classList.remove('active'));
      document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
      link.classList.add('active');
      const el = document.getElementById(`section-${section}`);
      if (el) el.classList.add('active');
    });
  });
});

async function loadOverview() {
  const result = await chrome.storage.local.get('clarity_items');
  const allItems = (result.clarity_items || []).filter(
    (i) => i.classification && i.timestamp > Date.now() - 7 * 86400000
  );

  document.getElementById('kpiTotalItems').textContent = allItems.length;

  if (allItems.length === 0) {
    document.getElementById('kpiAvgIntensity').textContent = '—';
    document.getElementById('kpiAlgorithmicRatio').textContent = '—';
    document.getElementById('kpiDominantMechanic').textContent = '—';
    document.getElementById('overviewNoData').style.display = 'block';
    return;
  }

  document.getElementById('overviewNoData').style.display = 'none';

  const avgIntensity =
    allItems.reduce((s, i) => s + i.classification.manipulationIntensity, 0) / allItems.length;
  const recommendedCount = allItems.filter((i) => i.isRecommended).length;
  const mechanicCounts = {};
  allItems.forEach((i) => {
    const m = i.classification.manipulationMechanic;
    mechanicCounts[m] = (mechanicCounts[m] || 0) + 1;
  });
  const dominant = Object.entries(mechanicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  document.getElementById('kpiAvgIntensity').textContent = `${Math.round(avgIntensity * 100)}%`;
  document.getElementById('kpiAlgorithmicRatio').textContent = `${Math.round((recommendedCount / allItems.length) * 100)}%`;
  document.getElementById('kpiDominantMechanic').textContent = dominant
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

async function loadSettings() {
  const result = await chrome.storage.local.get('clarity_settings');
  const s = result.clarity_settings || {};
  if (s.apiKey) document.getElementById('apiKeyInput').value = s.apiKey;

  document.getElementById('saveSettings').addEventListener('click', async () => {
    const current = (await chrome.storage.local.get('clarity_settings')).clarity_settings || {};
    current.apiKey = document.getElementById('apiKeyInput').value.trim();
    await chrome.storage.local.set({ clarity_settings: current });
    alert('Settings saved.');
  });

  document.getElementById('clearData').addEventListener('click', async () => {
    if (confirm('This will delete all your collected data. Are you sure?')) {
      await chrome.storage.local.remove(['clarity_items', 'clarity_sessions']);
      alert('Data cleared.');
      loadOverview();
    }
  });
}
