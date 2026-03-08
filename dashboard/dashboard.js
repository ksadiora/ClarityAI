const CATEGORY_LABELS = {
  news: 'News', entertainment: 'Entertainment', education: 'Education',
  gaming: 'Gaming', lifestyle: 'Lifestyle', comedy: 'Comedy', music: 'Music',
  sports: 'Sports', tech: 'Tech', politics: 'Politics', how_to: 'How-to',
  vlog: 'Vlog', drama: 'Drama', science: 'Science', business: 'Business', other: 'Other',
  documentary: 'Documentary', true_crime: 'True crime', reaction: 'Reaction', commentary: 'Commentary',
  review: 'Reviews', beauty: 'Beauty', fashion: 'Fashion', food: 'Food', finance: 'Finance',
  crypto: 'Crypto', motivation: 'Motivation', memes: 'Memes', dance: 'Dance', art: 'Art',
  history: 'History', philosophy: 'Philosophy', diy: 'DIY & crafts', asmr: 'ASMR',
  film: 'Film', tv: 'TV', self_improvement: 'Self-improvement', relationship: 'Relationships',
  unboxing: 'Unboxing', storytime: 'Storytime', travel: 'Travel', fitness: 'Fitness',
};
const COLORS = {
  outrage: '#ef4444', fear: '#dc2626', social_comparison: '#f97316', humor: '#22c55e',
  inspiration: '#3b82f6', controversy: '#a855f7', curiosity_gap: '#eab308',
  tribal_identity: '#ec4899', neutral: '#6b7280', informational: '#16a34a', commercial_manipulation: '#c2410c', ad: '#c2410c',
  ai_generated: '#eab308',
};

async function loadData() {
  const history = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, r));
  const minutes = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_TIME_TRACKING' }, r));
  return { history, minutes };
}

function getDemoData() {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const platforms = ['youtube', 'youtube', 'youtube', 'twitter', 'twitter', 'tiktok'];
  const mechanics = ['informational', 'neutral', 'curiosity_gap', 'outrage', 'humor', 'informational', 'neutral', 'curiosity_gap', 'fear', 'controversy'];
  const categories = ['education', 'entertainment', 'news', 'gaming', 'how_to', 'comedy', 'science', 'politics', 'lifestyle'];
  const samples = [
    { text: 'How photosynthesis works – science explained', m: 'informational', cat: 'education', i: 15 },
    { text: 'You won\'t believe what happened next', m: 'curiosity_gap', cat: 'entertainment', i: 72 },
    { text: 'Breaking: Major news event coverage', m: 'neutral', cat: 'news', i: 25 },
    { text: 'Best gaming setup 2024', m: 'neutral', cat: 'gaming', i: 30 },
    { text: 'Tutorial: Learn to code in 10 minutes', m: 'informational', cat: 'how_to', i: 10 },
    { text: 'Funny moments compilation', m: 'humor', cat: 'comedy', i: 35 },
    { text: 'Space discovery shocks scientists', m: 'curiosity_gap', cat: 'science', i: 58 },
    { text: 'Politician controversy explained', m: 'outrage', cat: 'politics', i: 78 },
    { text: 'Day in my life vlog', m: 'neutral', cat: 'lifestyle', i: 22 },
    { text: 'They don\'t want you to know this secret', m: 'curiosity_gap', cat: 'entertainment', i: 85 },
    { text: 'Calm study with me', m: 'informational', cat: 'education', i: 12 },
    { text: 'Reacting to viral video', m: 'humor', cat: 'entertainment', i: 42 },
    { text: 'Health tips from experts', m: 'informational', cat: 'lifestyle', i: 18 },
    { text: 'Outrageous take on current events', m: 'outrage', cat: 'politics', i: 82 },
    { text: 'Relaxing ASMR sounds', m: 'neutral', cat: 'entertainment', i: 20 },
  ];
  const history = [];
  // Weekly base intensity for downward trend: Week 1 (oldest) high → Week 4 (newest) low
  const weeklyBase = [38, 52, 65, 78]; // newest week (w=0) to oldest (w=3)
  for (let i = 0; i < 65; i++) {
    const w = Math.floor(i / 16) % 4;
    const t = now - (w * weekMs + (i % 16) * (weekMs / 18));
    const s = samples[i % samples.length];
    const platform = platforms[i % platforms.length];
    const baseIntensity = weeklyBase[w];
    const variance = (i % 7) - 3;
    history.push({
      platform,
      text: s.text + ' – item ' + (i + 1),
      classification: {
        manipulation_mechanic: s.m,
        manipulation_intensity: Math.min(95, Math.max(15, baseIntensity + variance)),
        content_category: categories[i % categories.length],
      },
      timestamp: t,
      isRecommended: i % 10 < 7,
    });
  }
  const minutes = { youtube: 52, twitter: 28, tiktok: 41 };
  const tips = [
    { title: 'Turn off autoplay', body: 'On YouTube and TikTok, disable autoplay so you choose what to watch next instead of the algorithm.' },
    { title: 'Use "Not interested"', body: 'Tap "Not interested" on content you don\'t want. It trains the feed over time.' },
    { title: 'Prefer Subscriptions over Home', body: 'On YouTube, open Subscriptions first. On X and TikTok, check Following before For You.' },
    { title: 'Set a daily time cap', body: 'Use a timer or phone settings to limit time per app. Even a soft limit helps you scroll more intentionally.' },
  ];
  return { history, minutes, tips };
}

function inferCategoryFromText(text) {
  const t = (text || '').toLowerCase();
  if (/\bnews\b|breaking|headline|reporter|cnn|fox|bbc|reuters/i.test(t)) return 'news';
  if (/\bgame|gaming|playthrough|walkthrough|minecraft|fortnite|gamer\b|esports|twitch/i.test(t)) return 'gaming';
  if (/\bdiy\b|craft\b|knitting|sewing\b|woodwork|handmade/i.test(t)) return 'diy';
  if (/\bhow to|tutorial|learn|step by step|guide\b/i.test(t)) return 'how_to';
  if (/\bcomedy|funny|laugh|joke\b|stand.?up|sketch\b/i.test(t)) return 'comedy';
  if (/\bmusic|song|album|lyrics|artist\b|spotify|playlist|cover\s+of|music video/i.test(t)) return 'music';
  if (/\bsport|nba|nfl|soccer|football|basketball|baseball|tennis|olympics|workout\b/i.test(t)) return 'sports';
  if (/\btech|programming|coding|software|developer\b|apple\s+event|android|gadget/i.test(t)) return 'tech';
  if (/\beducation|school|study|course\b|explained\b|learn\s+about/i.test(t)) return 'education';
  if (/\bscience\b|physics|chemistry|biology|space\s+nasa|research\b|study\s+shows/i.test(t)) return 'science';
  if (/\bpolitics|democrat|republican|election\b|congress|senate|vote\b/i.test(t)) return 'politics';
  if (/\bbusiness\b|investing|stock\s+market|ceo|startup\b|entrepreneur/i.test(t)) return 'business';
  if (/\bfinance\b|money\s+tip|budget\b|saving\s+money|invest\b/i.test(t)) return 'finance';
  if (/\bcrypto|bitcoin|ethereum|blockchain|nft\b/i.test(t)) return 'crypto';
  if (/\bdocumentary\b|doc\s+series|true\s+story|based on real/i.test(t)) return 'documentary';
  if (/\btrue\s+crime\b|murder\b|serial\s+killer|crime\s+story|unsolved/i.test(t)) return 'true_crime';
  if (/\breaction\b|react\s+to|watch(ing)?\s+with|first\s+time\s+watching/i.test(t)) return 'reaction';
  if (/\bcommentary\b|hot\s+take|my\s+opinion|rant\b|discussion\s+video/i.test(t)) return 'commentary';
  if (/\breview\b|unboxing|first\s+impression|unbox\b/i.test(t)) return 'review';
  if (/\bunboxing|unbox\s+|unboxed/i.test(t)) return 'unboxing';
  if (/\bbeauty\b|makeup|skincare|cosmetic|hair\s+tutorial|get\s+ready\s+with/i.test(t)) return 'beauty';
  if (/\bfashion\b|outfit|ootd|style\s+tip|haul\b|try\s+on/i.test(t)) return 'fashion';
  if (/\brecipe\b|cooking|food\b|chef\b|meal\b|eat\b|restaurant|baking\b/i.test(t)) return 'food';
  if (/\bmotivation\b|motivational|inspirational|grind\b|hustle\b|mindset\b/i.test(t)) return 'motivation';
  if (/\bself\s*improvement|productivity|habit\b|routine\b|morning\s+routine/i.test(t)) return 'self_improvement';
  if (/\bmeme\b|memes\b|dank\b|viral\s+video|trend\s+on/i.test(t)) return 'memes';
  if (/\bdance\b|choreography|tiktok\s+dance|dancing\b/i.test(t)) return 'dance';
  if (/\bart\b|drawing|painting|digital\s+art|artist\s+draws/i.test(t)) return 'art';
  if (/\bhistory\b|historical|ww2|world\s+war|ancient\b|medieval/i.test(t)) return 'history';
  if (/\bphilosophy|philosophical|existential|meaning\s+of\s+life/i.test(t)) return 'philosophy';
  if (/\basmr\b|whisper|satisfying\s+sound|soft\s+spoken/i.test(t)) return 'asmr';
  if (/\bfilm\b|movie\b|cinema|box\s+office|film\s+review/i.test(t)) return 'film';
  if (/\btv\s+show|series\b|netflix|episode\b|season\s+\d|recap\b/i.test(t)) return 'tv';
  if (/\brelationship\b|dating\b|breakup\b|love\s+advice|marriage\b/i.test(t)) return 'relationship';
  if (/\bstorytime\b|story\s+time|my\s+story|what\s+happened\s+to\s+me/i.test(t)) return 'storytime';
  if (/\btravel\b|vacation|trip\s+to|travel\s+vlog|backpacking/i.test(t)) return 'travel';
  if (/\bfitness\b|gym\b|workout\b|exercise\b|weight\s+loss|muscle\b/i.test(t)) return 'fitness';
  if (/\blifestyle|vlog\b|day\s+in\s+my\s+life|ootd|routine\b|recipe|cooking/i.test(t)) return 'lifestyle';
  if (/\bdrama\b|dramatic|tea\b|spill\b|scandal\b|exposed\b/i.test(t)) return 'drama';
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
    const cat = (c.content_category && c.content_category !== 'other')
      ? c.content_category
      : inferCategoryFromText(item.text);
    const i = c.manipulation_intensity || 0;
    const age = now - (item.timestamp || 0);
    const recency = age < dayMs ? 2 : age < 7 * dayMs ? 1.5 : 1;

    byPlatform[p] = byPlatform[p] || { count: 0, intensity: 0, recommended: 0 };
    byPlatform[p].count++;
    byPlatform[p].intensity += i;
    if (item.isRecommended !== false) byPlatform[p].recommended = (byPlatform[p].recommended || 0) + 1;
    byMechanic[m] = (byMechanic[m] || 0) + 1;
    byCategory[cat] = (byCategory[cat] || 0) + recency;
    totalIntensity += i;
    count++;
  });

  let totalRecommended = 0;
  Object.keys(byPlatform).forEach(p => {
    byPlatform[p].avgScore = Math.round(byPlatform[p].intensity / byPlatform[p].count);
    const total = byPlatform[p].count;
    const rec = byPlatform[p].recommended || 0;
    totalRecommended += rec;
    byPlatform[p].recommendedRatio = total ? rec / total : 0;
  });
  const algorithmShare = count ? totalRecommended / count : 0;

  const topMechanic = Object.entries(byMechanic).sort((a, b) => b[1] - a[1])[0];
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const overallScore = count ? Math.round(totalIntensity / count) : 0;

  let scoreInterpretation = '';
  if (count && overallScore >= 55) scoreInterpretation = 'Your feed is heavily optimized for engagement.';
  else if (count && overallScore >= 35) scoreInterpretation = 'Your feed mixes calm and engagement-driven content.';
  else if (count && overallScore < 35) scoreInterpretation = 'Your feed leans toward calmer, more genuine content.';

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
    algorithmShare,
    scoreInterpretation,
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
  let history = [], minutes = {}, tips = [];
  const isDemo = new URLSearchParams(window.location.search).get('demo') === '1';
  if (isDemo) {
    const data = getDemoData();
    history = data.history || [];
    minutes = data.minutes || {};
    tips = Array.isArray(data.tips) ? data.tips : [];
  } else {
    try {
      const data = await loadData();
      history = data.history || [];
      minutes = data.minutes || {};
    } catch (e) {
      console.error('MA: loadData failed', e);
    }
    try {
      const aggResponse = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_AGGREGATES' }, r));
      tips = Array.isArray(aggResponse?.tips) ? aggResponse.tips : [];
    } catch (e) {}
  }
  const agg = computeAggregates(history);
  const mins = minutes || { youtube: 0, twitter: 0, tiktok: 0 };

  const getStartedEl = document.getElementById('getStartedBlock');
  if (getStartedEl) getStartedEl.style.display = agg.totalItems < 3 ? 'block' : 'none';

  const demoBanner = document.getElementById('demoBanner');
  if (demoBanner) demoBanner.style.display = isDemo ? 'block' : 'none';

  const scoreEl = document.getElementById('overallScore');
  scoreEl.textContent = agg.totalItems ? agg.overallScore : '--';
  scoreEl.classList.remove('low', 'med', 'high');
  if (agg.totalItems) {
    if (agg.overallScore > 60) scoreEl.classList.add('high');
    else if (agg.overallScore > 35) scoreEl.classList.add('med');
    else scoreEl.classList.add('low');
  }
  const interpretationEl = document.getElementById('scoreInterpretation');
  if (interpretationEl) interpretationEl.textContent = agg.scoreInterpretation || '';
  interpretationEl?.classList.toggle('visible', !!agg.scoreInterpretation);
  const algorithmShareEl = document.getElementById('algorithmShareLine');
  if (algorithmShareEl) {
    if (agg.totalItems && typeof agg.algorithmShare === 'number') {
      const pct = Math.round(agg.algorithmShare * 100);
      algorithmShareEl.textContent = `${pct}% of what you see is chosen by the algorithm (not people you follow).`;
      algorithmShareEl.classList.add('visible');
    } else {
      algorithmShareEl.textContent = '';
      algorithmShareEl.classList.remove('visible');
    }
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

  const platformLabels = { youtube: 'YouTube', twitter: 'X', tiktok: 'TikTok' };
  const platformBars = document.getElementById('platformBars');
  platformBars.innerHTML = Object.entries(agg.byPlatform)
    .map(([key, d]) => {
      const name = platformLabels[key] || key;
      const color = d.avgScore > 60 ? '#ef4444' : d.avgScore > 35 ? '#eab308' : '#22c55e';
      return `<div class="platform-bar">
        <span class="label">${name}</span>
        <div class="bar-wrap"><div class="bar" style="width:${d.avgScore}%;background:${color}"></div></div>
        <span class="val">${d.avgScore}</span>
      </div>`;
    })
    .join('') || '<p class="hint">Browse YouTube, X, or TikTok for a few minutes to see your breakdown.</p>';

  const mechanicChart = document.getElementById('mechanicChart');
  mechanicChart.innerHTML = Object.entries(agg.byMechanic)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `<div class="mechanic-item">
      <span class="dot" style="background:${COLORS[name] || '#6b7280'}"></span>
      <span class="name">${name === 'ai_generated' ? 'AI' : name.replace(/_/g, ' ')}</span>
      <span class="count">(${count})</span>
    </div>`)
    .join('') || '<p class="hint">Browse YouTube, X, or TikTok to see which manipulation mechanics appear in your feed.</p>';

  // Preferences / categories section
  document.getElementById('preferencesSummary').textContent =
    agg.preferencesSummary || 'Browse and watch content to build your preferences profile';
  document.getElementById('categoryPills').innerHTML = (agg.topCategories || [])
    .map(({ name, count }) => `<div class="category-pill">
      <span>${CATEGORY_LABELS[name] || name.replace(/_/g, ' ')}</span>
      <span class="count">${count}</span>
    </div>`)
    .join('') || '<p class="hint">Browse for a few minutes to see your content preferences.</p>';

  const driftChart = document.getElementById('driftChart');
  const hasDrift = agg.weekly.some(w => w.score != null);
  if (!hasDrift) {
    driftChart.innerHTML = '<div class="empty">Browse for a few minutes to build history, then check back to see if your feed is drifting over time.</div>';
    driftChart.classList.add('empty');
  } else {
    driftChart.classList.remove('empty');
    const weeks = [...agg.weekly].reverse();
    const w = 420;
    const h = 180;
    const pad = { left: 36, right: 36, top: 12, bottom: 28 };
    const x0 = pad.left;
    const x1 = w - pad.right;
    const y0 = pad.top;
    const y1 = h - pad.bottom;
    const yScale = (v) => y1 - (v / 100) * (y1 - y0);
    const xScale = (i) => x0 + (i / Math.max(weeks.length - 1, 1)) * (x1 - x0);
    const points = weeks
      .map((d, i) => ({ i, x: xScale(i), score: d.score, week: d.week }))
      .filter((d) => d.score != null);
    const pathD =
      points.length > 0
        ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${yScale(p.score)}`).join(' ')
        : '';
    const xLabels = weeks.map((_, i) => `<text x="${xScale(i)}" y="${h - 6}" class="drift-x-label" text-anchor="middle">Week ${i + 1}</text>`).join('');
    driftChart.innerHTML = `
      <svg class="drift-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
        <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" class="drift-axis"/>
        <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" class="drift-axis"/>
        <text x="${x0 - 8}" y="${y0 + 4}" class="drift-y-label" text-anchor="end">100</text>
        <text x="${x0 - 8}" y="${y1 + 4}" class="drift-y-label" text-anchor="end">0</text>
        ${pathD ? `<path d="${pathD}" class="drift-line" fill="none"/>` : ''}
        ${points.map((p) => `<circle cx="${p.x}" cy="${yScale(p.score)}" r="4" class="drift-dot"/>`).join('')}
        ${xLabels}
      </svg>`;
  }

  const tipsListEl = document.getElementById('tipsList');
  if (tipsListEl) {
    if (tips.length > 0) {
      tipsListEl.innerHTML = tips.slice(0, 8).map(t => `
        <div class="tip-card">
          <strong class="tip-card-title">${(t.title || '').replace(/</g, '&lt;')}</strong>
          <p class="tip-card-body">${(t.body || '').replace(/</g, '&lt;')}</p>
        </div>
      `).join('');
    } else {
      tipsListEl.innerHTML = '<p class="hint">Browse YouTube, X or TikTok to get personalized tips</p>';
    }
  }

  // Organic vs algorithmic — per platform (graphical)
  const organicEl = document.getElementById('organicNote');
  const organicPlatformLabels = { youtube: 'YouTube', twitter: 'X', tiktok: 'TikTok' };
  const organicData = ['youtube', 'twitter', 'tiktok']
    .filter(p => agg.byPlatform[p] && agg.byPlatform[p].count > 0)
    .map(p => {
      const d = agg.byPlatform[p];
      const recPct = Math.round((d.recommendedRatio ?? 0) * 100);
      const organicPct = 100 - recPct;
      return { platform: p, name: organicPlatformLabels[p], recPct, organicPct };
    });
  if (organicEl) {
    if (organicData.length > 0) {
      organicEl.innerHTML = `
        <div class="organic-legend">
          <span class="organic-legend-item"><span class="organic-legend-swatch organic-algo"></span> Algorithm</span>
          <span class="organic-legend-item"><span class="organic-legend-swatch organic-follows"></span> From people you follow</span>
        </div>
        <div class="organic-bars">
          ${organicData.map(({ platform, name, recPct, organicPct }) => `
            <div class="organic-platform">
              <div class="organic-platform-label">${name}</div>
              <div class="organic-stack">
                <div class="organic-segment organic-algo" style="width:${recPct}%" title="Algorithm: ${recPct}%"></div>
                <div class="organic-segment organic-follows" style="width:${organicPct}%" title="From follows: ${organicPct}%"></div>
              </div>
              <div class="organic-pcts">${recPct}% / ${organicPct}%</div>
            </div>
          `).join('')}
        </div>`;
    } else {
      organicEl.innerHTML = '<p class="hint">Browse YouTube, X, or TikTok with the extension to see what share of your feed is algorithm vs. people you follow.</p>';
    }
  }
}

render();
