const CATEGORY_LABELS = {
  news: 'News', entertainment: 'Entertainment', education: 'Education',
  gaming: 'Gaming', lifestyle: 'Lifestyle', comedy: 'Comedy', music: 'Music',
  sports: 'Sports', tech: 'Tech', politics: 'Politics', how_to: 'How-to',
  vlog: 'Vlog', drama: 'Drama', science: 'Science', business: 'Business', other: 'Other',
};
const COLORS = {
  outrage: '#ef4444', fear: '#dc2626', social_comparison: '#f97316', humor: '#22c55e',
  inspiration: '#3b82f6', controversy: '#a855f7', curiosity_gap: '#eab308',
  tribal_identity: '#ec4899', neutral: '#6b7280', ad: '#14b8a6',
};

async function loadData() {
  const history = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, r));
  const minutes = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_TIME_TRACKING' }, r));
  return { history, minutes };
}

function inferCategoryFromText(text) {
  const t = (text || '').toLowerCase();
  if (/\bnews\b|breaking|headline|reporter/i.test(t)) return 'news';
  if (/\bgame|gaming|playthrough|minecraft|fortnite|gamer\b/i.test(t)) return 'gaming';
  if (/\bhow to|tutorial|learn|step by step|guide\b/i.test(t)) return 'how_to';
  if (/\bcomedy|funny|laugh|joke\b/i.test(t)) return 'comedy';
  if (/\bmusic|song|album|lyrics|artist\b/i.test(t)) return 'music';
  if (/\bsport|nba|nfl|soccer|football|basketball\b/i.test(t)) return 'sports';
  if (/\btech|programming|coding|software|developer\b/i.test(t)) return 'tech';
  if (/\beducation|school|study|course|science\b/i.test(t)) return 'education';
  if (/\blifestyle|fitness|recipe|cooking|travel|vlog\b/i.test(t)) return 'lifestyle';
  if (/\bpolitics|democrat|republican|election\b/i.test(t)) return 'politics';
  return 'entertainment';
}

function computeAggregates(history) {
  const byPlatform = {};
  const byMechanic = {};
  const byCategory = {};
  let totalIntensity = 0;
  let count = 0;
  const weekly = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  history.forEach(item => {
    const p = item.platform || 'unknown';
    const c = item.classification || {};
    const m = c.manipulation_mechanic || 'neutral';
    const cat = c.content_category || inferCategoryFromText(item.text);
    const i = c.manipulation_intensity || 0;
    const age = now - (item.timestamp || 0);
    const recency = age < dayMs ? 2 : age < 7 * dayMs ? 1.5 : 1;

    byPlatform[p] = byPlatform[p] || { count: 0, intensity: 0 };
    byPlatform[p].count++;
    byPlatform[p].intensity += i;
    byMechanic[m] = (byMechanic[m] || 0) + 1;
    byCategory[cat] = (byCategory[cat] || 0) + recency;
    totalIntensity += i;
    count++;
  });

  Object.keys(byPlatform).forEach(p => {
    byPlatform[p].avgScore = Math.round(byPlatform[p].intensity / byPlatform[p].count);
  });

  const topMechanic = Object.entries(byMechanic).sort((a, b) => b[1] - a[1])[0];
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const overallScore = count ? Math.round(totalIntensity / count) : 0;

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  for (let w = 0; w < 4; w++) {
    const start = now - (w + 1) * weekMs;
    const end = now - w * weekMs;
    const weekItems = history.filter(i => i.timestamp >= start && i.timestamp < end);
    const weekAvg = weekItems.length
      ? Math.round(weekItems.reduce((s, i) => s + (i.classification?.manipulation_intensity || 0), 0) / weekItems.length)
      : null;
    weekly.push({ week: 4 - w, score: weekAvg, count: weekItems.length });
  }

  const preferencesSummary = topCategories.length
    ? `You're mostly seeing: ${topCategories.slice(0, 3).map(([n]) => CATEGORY_LABELS[n] || n).join(', ')}`
    : null;

  const manipulationWarning = overallScore >= 55 && count >= 5;
  const healthierAlternatives = manipulationWarning ? [
    { name: 'Khan Academy', platform: 'youtube', reason: 'Calm, educational content' },
    { name: 'Kurzgesagt', platform: 'youtube', reason: 'Science without hype' },
    { name: 'Nature documentaries', platform: 'youtube', reason: 'Search "nature doc"' },
    { name: 'Educational accounts', platform: 'twitter', reason: 'Follow scholars & Wikipedia' },
    { name: 'How-to & tutorials', platform: 'tiktok', reason: 'Skill-building content' },
  ] : null;

  return {
    byPlatform,
    byMechanic,
    byCategory,
    topMechanic: topMechanic ? { name: topMechanic[0], count: topMechanic[1] } : null,
    topCategories: topCategories.map(([name, count]) => ({ name, count })),
    preferencesSummary,
    overallScore,
    totalItems: count,
    weekly,
    manipulationWarning,
    healthierAlternatives,
  };
}

function formatMins(m) {
  if (m < 1) return Math.round(m * 60) + ' sec';
  if (m < 60) return Math.round(m) + ' min';
  const h = Math.floor(m / 60);
  const mins = Math.round(m % 60);
  return mins ? `${h}h ${mins}m` : `${h}h`;
}

async function render() {
  let history = [], minutes = {};
  try {
    const data = await loadData();
    history = data.history || [];
    minutes = data.minutes || {};
  } catch (e) {
    console.error('MA: loadData failed', e);
  }
  const agg = computeAggregates(history);
  const mins = minutes || { youtube: 0, twitter: 0, tiktok: 0 };

  const scoreEl = document.getElementById('overallScore');
  scoreEl.textContent = agg.totalItems ? agg.overallScore : '--';
  scoreEl.classList.remove('low', 'med', 'high');
  if (agg.totalItems) {
    if (agg.overallScore > 60) scoreEl.classList.add('high');
    else if (agg.overallScore > 35) scoreEl.classList.add('med');
    else scoreEl.classList.add('low');
  }

  const warnBanner = document.getElementById('manipulationWarningBanner');
  if (agg.manipulationWarning && agg.healthierAlternatives?.length) {
    warnBanner.style.display = 'block';
    const urls = { youtube: 'https://www.youtube.com/results?search_query=', twitter: 'https://x.com/search?q=', tiktok: 'https://www.tiktok.com/search?q=' };
    document.getElementById('healthierAlternatives').innerHTML = agg.healthierAlternatives.map(s => {
      const searchUrl = urls[s.platform] + encodeURIComponent(s.name);
      return `<a href="${searchUrl}" target="_blank" class="creator-suggestion"><div class="creator-name">${s.name}</div><span class="creator-platform">${s.platform}</span><div class="creator-reason">${s.reason}</div></a>`;
    }).join('');
  } else {
    warnBanner.style.display = 'none';
  }

  let creatorSuggestions = { suggestions: [] };
  try {
    creatorSuggestions = await new Promise((resolve, reject) => {
      const t = setTimeout(() => resolve({ suggestions: [] }), 8000);
      chrome.runtime.sendMessage({ type: 'GET_CREATOR_SUGGESTIONS' }, (r) => {
        clearTimeout(t);
        resolve(r || { suggestions: [] });
      });
    });
  } catch (e) {
    console.error('MA: GET_CREATOR_SUGGESTIONS failed', e);
  }
  const suggDiv = document.getElementById('creatorSuggestions');
  if (!agg.manipulationWarning && creatorSuggestions?.suggestions?.length > 0) {
    const urls = { youtube: 'https://www.youtube.com/results?search_query=', twitter: 'https://x.com/search?q=', tiktok: 'https://www.tiktok.com/search?q=' };
    suggDiv.innerHTML = creatorSuggestions.suggestions.map(s => {
      const searchUrl = urls[s.platform] + encodeURIComponent(s.name);
      return `<a href="${searchUrl}" target="_blank" class="creator-suggestion">
        <div class="creator-name">${s.name}</div>
        <span class="creator-platform">${s.platform}</span>
        <div class="creator-reason">${s.reason}</div>
      </a>`;
    }).join('');
  } else if (!agg.manipulationWarning) {
    suggDiv.innerHTML = '<p class="hint">Browse YouTube, X or TikTok to get personalized suggestions</p>';
  } else {
    suggDiv.innerHTML = '<p class="hint">Focus on the healthier alternatives above</p>';
  }

  const totalMins = mins.youtube + mins.twitter + mins.tiktok;
  const maxMins = Math.max(mins.youtube, mins.twitter, mins.tiktok, 1);
  document.getElementById('timeBars').innerHTML = [
    ['YouTube', mins.youtube],
    ['Twitter/X', mins.twitter],
    ['TikTok', mins.tiktok],
  ].map(([name, m]) => {
    const pct = totalMins > 0 ? (m / maxMins) * 100 : 0;
    return `<div class="time-bar">
      <span class="label">${name}</span>
      <div class="bar-wrap"><div class="bar" style="width:${pct}%"></div></div>
      <span class="val">${formatMins(m)}</span>
    </div>`;
  }).join('');

  const platformBars = document.getElementById('platformBars');
  platformBars.innerHTML = Object.entries(agg.byPlatform)
    .map(([name, d]) => {
      const color = d.avgScore > 60 ? '#ef4444' : d.avgScore > 35 ? '#eab308' : '#22c55e';
      return `<div class="platform-bar">
        <span class="label">${name}</span>
        <div class="bar-wrap"><div class="bar" style="width:${d.avgScore}%;background:${color}"></div></div>
        <span class="val">${d.avgScore}</span>
      </div>`;
    })
    .join('') || '<p class="hint">No platform data yet</p>';

  const mechanicChart = document.getElementById('mechanicChart');
  mechanicChart.innerHTML = Object.entries(agg.byMechanic)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `<div class="mechanic-item">
      <span class="dot" style="background:${COLORS[name] || '#6b7280'}"></span>
      <span class="name">${name.replace(/_/g, ' ')}</span>
      <span class="count">(${count})</span>
    </div>`)
    .join('') || '<p class="hint">No mechanic data yet</p>';

  // Preferences / categories section
  document.getElementById('preferencesSummary').textContent =
    agg.preferencesSummary || 'Browse and watch content to build your preferences profile';
  document.getElementById('categoryPills').innerHTML = (agg.topCategories || [])
    .map(({ name, count }) => `<div class="category-pill">
      <span>${CATEGORY_LABELS[name] || name.replace(/_/g, ' ')}</span>
      <span class="count">${count}</span>
    </div>`)
    .join('') || '<p class="hint">No data yet</p>';

  const driftChart = document.getElementById('driftChart');
  const hasDrift = agg.weekly.some(w => w.score != null);
  driftChart.innerHTML = hasDrift
    ? agg.weekly.map(w => `<div style="margin-bottom:8px">Week -${w.week}: ${w.score != null ? w.score + ' avg' : 'no data'} (${w.count} items)</div>`).join('')
    : '<div class="empty">Collect more data over time to see algorithmic drift</div>';
  if (!hasDrift) driftChart.classList.add('empty');
}

render();
