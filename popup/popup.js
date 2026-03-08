document.addEventListener('DOMContentLoaded', async () => {
  let aggregates = {};
  let suggestions = {};
  try {
    aggregates = await new Promise((resolve) => {
      const t = setTimeout(() => resolve({}), 5000);
      chrome.runtime.sendMessage({ type: 'GET_AGGREGATES' }, (r) => {
        clearTimeout(t);
        resolve(r || {});
      });
    });
  } catch (e) {
    console.error('MA: GET_AGGREGATES failed', e);
  }
  try {
    suggestions = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ suggestions: [] }), 8000);
      chrome.runtime.sendMessage({ type: 'GET_CREATOR_SUGGESTIONS' }, (r) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) resolve({ suggestions: [] });
        else resolve(r || { suggestions: [] });
      });
    });
  } catch (e) {
    console.error('MA: GET_CREATOR_SUGGESTIONS failed', e);
  }

  const score = aggregates?.overallScore ?? 0;
  const scoreEl = document.getElementById('scoreValue');
  const circleEl = document.getElementById('scoreCircle');
  scoreEl.textContent = aggregates?.totalItems ? score : '--';
  
  if (aggregates?.totalItems) {
    circleEl.classList.remove('low', 'med', 'high');
    if (score > 60) circleEl.classList.add('high');
    else if (score > 35) circleEl.classList.add('med');
    else circleEl.classList.add('low');
  }

  document.getElementById('itemCount').textContent = aggregates?.totalItems ?? 0;

  const warnEl = document.getElementById('manipulationWarning');
  if (warnEl) warnEl.style.display = aggregates?.manipulationWarning ? 'block' : 'none';

  const suggList = document.getElementById('suggestionsList');
  const suggBox = document.getElementById('suggestionsBox');
  const showHealthier = aggregates?.manipulationWarning && aggregates?.healthierAlternatives?.length;
  const displaySuggestions = showHealthier ? (aggregates.healthierAlternatives || []) : (Array.isArray(suggestions?.suggestions) ? suggestions.suggestions : (Array.isArray(suggestions) ? suggestions : []));
  const h4 = suggBox?.querySelector('h4');
  if (h4) h4.textContent = showHealthier ? 'Try these instead — healthier viewing' : 'Creators you might like';
  if (suggList && displaySuggestions.length > 0) {
    const platformUrls = { youtube: 'https://www.youtube.com/results?search_query=', twitter: 'https://x.com/search?q=', tiktok: 'https://www.tiktok.com/search?q=' };
    suggList.innerHTML = displaySuggestions.slice(0, showHealthier ? 4 : 3).map(s => {
      const platform = (s.platform || 'youtube');
      const searchUrl = (platformUrls[platform] || platformUrls.youtube) + encodeURIComponent(s.name || '');
      return `<div class="suggestion-item">
        <a href="${searchUrl}" target="_blank" class="sugg-link"><strong>${(s.name || '').replace(/</g, '&lt;')}</strong></a>
        <span class="platform">${platform}</span>
        <small>${(s.reason || '').replace(/</g, '&lt;')}</small>
      </div>`;
    }).join('');
  } else if (suggList) {
    suggList.innerHTML = '<small class="hint">Browse more to get suggestions</small>';
  }

  const tipsSection = document.getElementById('tipsSection');
  const tipsList = document.getElementById('tipsList');
  const tips = Array.isArray(aggregates?.tips) ? aggregates.tips : [];
  if (tipsSection && tipsList) {
    if (tips.length > 0) {
      tipsSection.style.display = 'block';
      tipsList.innerHTML = tips.slice(0, 4).map(t => `
        <div class="tip-item">
          <strong class="tip-title">${(t.title || '').replace(/</g, '&lt;')}</strong>
          <p class="tip-body">${(t.body || '').replace(/</g, '&lt;')}</p>
        </div>
      `).join('');
    } else {
      tipsSection.style.display = 'none';
    }
  }

  const prefsLine = document.getElementById('preferencesLine');
  prefsLine.textContent = aggregates?.preferencesSummary || '';
  prefsLine.style.display = aggregates?.preferencesSummary ? 'block' : 'none';

  const platformDiv = document.getElementById('platformScores');
  const byPlatform = aggregates?.byPlatform || {};
  platformDiv.innerHTML = Object.entries(byPlatform)
    .map(([name, d]) => `<div class="platform-row">
      <span>${name}</span>
      <span>${d.avgScore} avg</span>
    </div>`).join('') || '<div class="platform-row"><span>No data yet</span><span>Browse YouTube, X or TikTok</span></div>';

  const formatMins = (m) => {
    if (m < 1) return Math.round(m * 60) + ' sec';
    if (m < 60) return Math.round(m) + ' min';
    const h = Math.floor(m / 60);
    const mins = Math.round(m % 60);
    return mins ? `${h}h ${mins}m` : `${h}h`;
  };
  const minutes = aggregates?.minutesByPlatform || { youtube: 0, twitter: 0, tiktok: 0 };
  const totalMins = minutes.youtube + minutes.twitter + minutes.tiktok;
  document.getElementById('timeRows').innerHTML = [
    ['YouTube', minutes.youtube],
    ['Twitter/X', minutes.twitter],
    ['TikTok', minutes.tiktok],
  ].map(([name, m]) => `<div class="time-row"><span>${name}</span><span>${formatMins(m)}</span></div>`).join('');

  const overlayToggle = document.getElementById('overlayToggle');
  const { ma_overlay_enabled } = await chrome.storage.local.get(['ma_overlay_enabled']);
  overlayToggle.checked = ma_overlay_enabled !== false;
  overlayToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ ma_overlay_enabled: e.target.checked });
  });

  document.getElementById('dashboardLink').href = chrome.runtime.getURL('dashboard/dashboard.html');

  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  });
});
