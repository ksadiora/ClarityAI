document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  let platform = null;
  if (url.includes('youtube.com')) platform = 'youtube';
  else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'twitter';
  else if (url.includes('reddit.com')) platform = 'reddit';

  document.getElementById('platformName').textContent = platform
    ? `Currently on ${platform.charAt(0).toUpperCase() + platform.slice(1)}`
    : 'Not on a tracked platform';

  if (platform) {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SESSION_STATS',
      platform
    }).catch(() => ({ avgManipulationIntensity: 0, count: 0 }));

    const stats = await chrome.storage.local.get('clarity_items');
    const items = (stats.clarity_items || []).filter(
      (i) =>
        i.platform === platform &&
        i.classification &&
        i.timestamp > Date.now() - 86400000
    );

    const avgIntensity = items.length
      ? items.reduce((s, i) => s + i.classification.manipulationIntensity, 0) / items.length
      : (response?.avgManipulationIntensity ?? 0);

    const breakdown = {};
    items.forEach((i) => {
      const m = i.classification.manipulationMechanic;
      breakdown[m] = (breakdown[m] || 0) + 1;
    });
    const dominant = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const recommendedCount = items.filter((i) => i.isRecommended).length;
    const recommendedRatio = items.length
      ? Math.round((recommendedCount / items.length) * 100)
      : null;

    const score = items.length ? Math.round(avgIntensity * 100) : null;
    document.getElementById('scoreNumber').textContent = score !== null ? score : '—';

    const ring = document.getElementById('scoreRing');
    ring.classList.remove('low', 'medium', 'high');
    if (score !== null) {
      if (score < 35) ring.classList.add('low');
      else if (score < 65) ring.classList.add('medium');
      else ring.classList.add('high');
    }

    document.getElementById('dominantMechanic').textContent =
      dominant === '—' ? '—' : dominant.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    document.getElementById('itemsToday').textContent = items.length;
    document.getElementById('recommendedRatio').textContent =
      recommendedRatio !== null ? `${recommendedRatio}%` : '—';
  } else {
    document.getElementById('scoreNumber').textContent = '—';
    document.getElementById('dominantMechanic').textContent = '—';
    document.getElementById('itemsToday').textContent = '0';
    document.getElementById('recommendedRatio').textContent = '—';
  }

  document.getElementById('openDashboard').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  const settings = await chrome.storage.local.get('clarity_settings');
  const s = settings.clarity_settings || {};
  document.getElementById('overlayToggle').checked = s.overlayEnabled !== false;

  document.getElementById('overlayToggle').addEventListener('change', async (e) => {
    const current = (await chrome.storage.local.get('clarity_settings')).clarity_settings || {};
    await chrome.storage.local.set({
      clarity_settings: { ...current, overlayEnabled: e.target.checked }
    });
  });
});
