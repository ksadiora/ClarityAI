// Background service worker - storage, API classification, badge, time tracking
const STORAGE_KEY = 'manipulation_auditor_content_history';
const TIME_KEY = 'manipulation_auditor_minutes';
const SUGGESTIONS_KEY = 'manipulation_auditor_suggestions';
const SUGGESTIONS_TTL = 10 * 60 * 1000; // 10 min - refresh as you view
const SUGGESTIONS_MIN_NEW = 3; // regenerate if 3+ new items since last suggestion
const MAX_HISTORY = 500;
const SETTINGS_KEY = 'manipulation_auditor_settings';
const TICK_INTERVAL = 10000; // 10 seconds

function getPlatformFromUrl(url) {
  if (!url) return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('tiktok.com')) return 'tiktok';
  return null;
}

async function addMinutes(platform, mins) {
  const r = await chrome.storage.local.get([TIME_KEY]);
  const times = r[TIME_KEY] || { youtube: 0, twitter: 0, tiktok: 0 };
  times[platform] = (times[platform] || 0) + mins;
  await chrome.storage.local.set({ [TIME_KEY]: times });
}

let lastPlatform = null;
let lastTick = Date.now();

async function tick() {
  try {
    if (!chrome.tabs?.query) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url;
    const platform = getPlatformFromUrl(url);
    const now = Date.now();
    const elapsed = (now - lastTick) / 60000;

    if (lastPlatform && elapsed > 0 && elapsed < 120) {
      await addMinutes(lastPlatform, elapsed);
    }
    lastPlatform = platform;
    lastTick = now;
  } catch (e) {}
}

chrome.tabs.onActivated.addListener(() => { lastPlatform = null; tick(); });
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === 'complete') tick();
});
setInterval(tick, TICK_INTERVAL);

async function getApiKey() {
  const r = await chrome.storage.local.get([SETTINGS_KEY]);
  return r[SETTINGS_KEY]?.apiKey || '';
}

const CONTENT_CATEGORIES = ['news', 'entertainment', 'education', 'gaming', 'lifestyle', 'comedy', 'music', 'sports', 'tech', 'politics', 'how_to', 'vlog', 'drama', 'science', 'business', 'other'];

async function classifyWithAPI(content, apiKey, provider = 'anthropic') {
  const prompt = `Analyze this social media content. Return ONLY valid JSON.

Content:
---
${content.substring(0, 1500)}
---

Respond with:
{"emotional_valence":"positive|neutral|negative|provocative","manipulation_mechanic":"outrage|fear|social_comparison|humor|inspiration|controversy|curiosity_gap|tribal_identity|neutral|ad","urgency_signals":true|false,"manipulation_intensity":0-100,"content_category":"${CONTENT_CATEGORIES.join('|')}"}`;

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseClassification(text);
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
      }),
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseClassification(text);
  }

  // Anthropic
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  return parseClassification(text);
}

function parseClassification(text) {
  try {
    const json = text.replace(/```json?\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(json);
    let category = (parsed.content_category || 'other').toLowerCase().replace(/\s+/g, '_');
    if (!CONTENT_CATEGORIES.includes(category)) category = 'other';
    return {
      manipulation_mechanic: parsed.manipulation_mechanic || 'neutral',
      manipulation_intensity: Math.min(100, Math.max(0, parsed.manipulation_intensity || 0)),
      urgency_signals: !!parsed.urgency_signals,
      emotional_valence: parsed.emotional_valence || 'neutral',
      content_category: category,
    };
  } catch (e) {
    return null;
  }
}

async function storeContent(item) {
  const r = await chrome.storage.local.get([STORAGE_KEY]);
  let history = r[STORAGE_KEY] || [];
  history.unshift({
    ...item,
    id: Date.now() + '-' + Math.random().toString(36).slice(2),
  });
  history = history.slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [STORAGE_KEY]: history });
  await updateBadge(history);
}

async function updateBadge(history) {
  if (!history || history.length === 0) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const recent = history.slice(0, 50);
  const avg = recent.reduce((s, i) => s + (i.classification?.manipulation_intensity || 0), 0) / recent.length;
  const score = Math.round(avg);
  await chrome.action.setBadgeText({ text: String(score) });
  const color = score > 60 ? '#ef4444' : score > 35 ? '#eab308' : '#22c55e';
  await chrome.action.setBadgeBackgroundColor({ color });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'CLASSIFY_CONTENT') {
    getApiKey().then(async (apiKey) => {
      if (apiKey) {
        const settings = (await chrome.storage.local.get([SETTINGS_KEY]))[SETTINGS_KEY] || {};
        const provider = settings.provider || 'anthropic';
        try {
          const classification = await classifyWithAPI(msg.content, apiKey, provider);
          sendResponse({ classification });
        } catch (e) {
          sendResponse({ classification: null });
        }
      } else {
        sendResponse({ classification: null });
      }
    });
    return true;
  }
  if (msg.type === 'STORE_CONTENT') {
    storeContent(msg.data);
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'GET_HISTORY') {
    chrome.storage.local.get([STORAGE_KEY], (r) => sendResponse(r[STORAGE_KEY] || []));
    return true;
  }
  if (msg.type === 'GET_AGGREGATES') {
    chrome.storage.local.get([STORAGE_KEY, TIME_KEY], (r) => {
      const history = r[STORAGE_KEY] || [];
      const aggregates = computeAggregates(history);
      aggregates.minutesByPlatform = r[TIME_KEY] || { youtube: 0, twitter: 0, tiktok: 0 };
      sendResponse(aggregates);
    });
    return true;
  }
  if (msg.type === 'GET_TIME_TRACKING') {
    chrome.storage.local.get([TIME_KEY], (r) => sendResponse(r[TIME_KEY] || { youtube: 0, twitter: 0, tiktok: 0 }));
    return true;
  }
  if (msg.type === 'GET_CREATOR_SUGGESTIONS') {
    chrome.storage.local.get([STORAGE_KEY, SUGGESTIONS_KEY, SETTINGS_KEY], async (r) => {
      try {
        const history = r[STORAGE_KEY] || [];
        const cached = r[SUGGESTIONS_KEY];
        const historyGrew = cached?.lastHistoryCount != null && history.length - cached.lastHistoryCount >= SUGGESTIONS_MIN_NEW;
        const cacheValid = cached?.ts && Date.now() - cached.ts < SUGGESTIONS_TTL;
        if (cacheValid && !historyGrew && cached?.suggestions?.length) {
          sendResponse({ suggestions: cached.suggestions });
          return;
        }
        const agg = computeAggregates(history);
        const topCategories = Object.entries(agg.byCategory || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (topCategories.length === 0 || history.length < 3) {
          sendResponse({ suggestions: getFallbackSuggestions([['entertainment', 1]], history) });
          return;
        }
        const apiKey = r[SETTINGS_KEY]?.apiKey;
        const provider = r[SETTINGS_KEY]?.provider || 'anthropic';
        if (apiKey) {
          try {
            const suggestions = await suggestCreatorsWithAPI(history, topCategories, apiKey, provider);
            if (suggestions && suggestions.length > 0) {
              await chrome.storage.local.set({ [SUGGESTIONS_KEY]: { suggestions, ts: Date.now(), lastHistoryCount: history.length } });
              sendResponse({ suggestions });
              return;
            }
          } catch (e) {}
        }
        sendResponse({ suggestions: getFallbackSuggestions(topCategories, history) });
      } catch (err) {
        sendResponse({ suggestions: getFallbackSuggestions([['entertainment', 1]], []) });
      }
    });
    return true;
  }
});

function inferCategoryFromText(text) {
  const t = (text || '').toLowerCase();
  if (/\bnews\b|breaking|headline|reporter|cnn|fox/i.test(t)) return 'news';
  if (/\bgame|gaming|playthrough|walkthrough|minecraft|fortnite|gamer\b/i.test(t)) return 'gaming';
  if (/\bhow to|tutorial|learn|step by step|guide\b/i.test(t)) return 'how_to';
  if (/\bcomedy|funny|laugh|joke\b/i.test(t)) return 'comedy';
  if (/\bmusic|song|album|lyrics|artist\b/i.test(t)) return 'music';
  if (/\bsport|nba|nfl|soccer|football|basketball\b/i.test(t)) return 'sports';
  if (/\btech|programming|coding|software|developer\b/i.test(t)) return 'tech';
  if (/\beducation|school|study|course|science\b/i.test(t)) return 'education';
  if (/\blifestyle|fitness|recipe|cooking|travel|vlog|ootd|outfit\b/i.test(t)) return 'lifestyle';
  if (/\bpolitics|democrat|republican|election\b/i.test(t)) return 'politics';
  return 'entertainment';
}

function computeAggregates(history) {
  const byPlatform = {};
  const byMechanic = {};
  const byCategory = {};
  let totalIntensity = 0;
  let count = 0;

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
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const overallScore = count ? Math.round(totalIntensity / count) : 0;

  const preferencesSummary = topCategories.length
    ? `You're mostly seeing: ${topCategories.map(([n]) => n.replace(/_/g, ' ')).join(', ')}`
    : null;

  const manipulationWarning = overallScore >= 55 && count >= 5;
  const healthierAlternatives = manipulationWarning ? [
    { name: 'Khan Academy', platform: 'youtube', reason: 'Calm, educational content' },
    { name: 'Kurzgesagt', platform: 'youtube', reason: 'Science without hype' },
    { name: 'Nature documentaries', platform: 'youtube', reason: 'Search "nature doc"' },
    { name: 'Educational accounts', platform: 'twitter', reason: 'Follow @Wikipedia, scholars' },
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
    manipulationWarning,
    healthierAlternatives,
  };
}

const FALLBACK_SUGGESTIONS = {
  tech: [{ name: '3Blue1Brown', platform: 'youtube', reason: 'Math & CS' }, { name: 'Linus Tech Tips', platform: 'youtube', reason: 'Tech reviews' }, { name: 'Tech Twitter', platform: 'twitter', reason: 'Follow devs & builders' }],
  education: [{ name: 'Khan Academy', platform: 'youtube', reason: 'Free lessons' }, { name: 'Crash Course', platform: 'youtube', reason: 'Topic overviews' }],
  comedy: [{ name: 'Comedy creators', platform: 'tiktok', reason: 'Short humor' }, { name: 'Stand-up clips', platform: 'youtube', reason: 'Full specials' }, { name: 'Funny accounts', platform: 'twitter', reason: 'Meme accounts' }],
  gaming: [{ name: 'Your game + walkthrough', platform: 'youtube', reason: 'Search it' }, { name: 'Gaming creators', platform: 'tiktok', reason: 'Quick clips' }],
  music: [{ name: 'Indie artists', platform: 'tiktok', reason: 'New music' }, { name: 'Music channels', platform: 'youtube', reason: 'Sessions & covers' }],
  science: [{ name: 'Veritasium', platform: 'youtube', reason: 'Science' }, { name: 'Kurzgesagt', platform: 'youtube', reason: 'Science & philosophy' }],
  how_to: [{ name: 'How-to channels', platform: 'youtube', reason: 'Tutorials' }, { name: 'Skill creators', platform: 'tiktok', reason: 'Quick how-tos' }],
  lifestyle: [{ name: 'Lifestyle tags', platform: 'tiktok', reason: 'Fitness, travel, food' }, { name: 'Vloggers', platform: 'youtube', reason: 'Routines' }],
  news: [{ name: 'Multiple sources', platform: 'youtube', reason: 'Compare views' }],
  entertainment: [{ name: 'For You feed', platform: 'tiktok', reason: 'Discover creators' }, { name: 'Subscriptions', platform: 'youtube', reason: 'Your subs' }, { name: 'Follow new accounts', platform: 'twitter', reason: 'Expand timeline' }],
};

function extractSeenCreators(history) {
  const seen = new Set();
  history.slice(0, 30).forEach(item => {
    const t = (item.text || '');
    const platform = item.platform || '';
    const parts = t.split(/[|\u2022·•·–—]/).map(s => s.trim()).filter(Boolean);
    parts.forEach(p => {
      if (platform === 'youtube' && p.length > 3 && p.length < 50 && !/^\d|views|subscribers|ago/i.test(p)) {
        seen.add(p);
      }
      const at = p.match(/@[\w.]+/g);
      if (at) at.forEach(u => seen.add(u.replace('@', '')));
    });
  });
  return [...seen].slice(0, 20);
}

function extractViewingTopics(history) {
  const texts = history.slice(0, 25).map(i => i.text || '').join(' ').toLowerCase();
  const topics = [];
  const groups = [
    ['minecraft', 'fortnite', 'valorant', 'gaming'],
    ['programming', 'coding', 'python', 'javascript'],
    ['cooking', 'recipe', 'food', 'baking'],
    ['fitness', 'workout', 'gym', 'running'],
    ['travel', 'vlog', 'adventure'],
    ['comedy', 'stand-up', 'funny'],
    ['music', 'song', 'artist', 'album'],
    ['politics', 'news', 'election'],
    ['science', 'physics', 'space', 'biology'],
    ['tech', 'review', 'unboxing'],
    ['how to', 'tutorial', 'learn', 'guide'],
  ];
  groups.forEach(group => {
    if (group.some(w => texts.includes(w))) topics.push(group[0]);
  });
  return topics;
}

async function suggestCreatorsWithAPI(history, topCategories, apiKey, provider) {
  const sampleTexts = history.slice(0, 25).map((i, idx) => `[${i.platform}] ${i.text}`).join('\n---\n').substring(0, 2000);
  const seenCreators = extractSeenCreators(history);
  const viewingTopics = extractViewingTopics(history);
  const cats = topCategories.map(([n]) => n).slice(0, 4).join(', ');
  const platformsUsed = [...new Set(history.map(i => i.platform).filter(Boolean))];
  const prompt = `Analyze this user's ACTUAL viewing history. Suggest 5-6 specific people/channels they should watch - real creators they probably haven't found yet.

WHAT THEY'VE BEEN WATCHING (exact titles, channels, content):
${sampleTexts}

Creators they already see (DO NOT suggest these): ${seenCreators.slice(0, 15).join(', ') || 'none'}

Their MOST-WATCHED categories: ${cats}
Their interests: ${viewingTopics.length ? viewingTopics.join(', ') : cats}

IMPORTANT: Include creators for EACH platform they use. They use: ${platformsUsed.join(', ')}.
- YouTube: suggest 1-2 specific channels (real channel names)
- Twitter/X: suggest 1-2 specific accounts to follow (real @handles or names)
- TikTok: suggest 1-2 specific creators (real names)

Match their exact taste from the content above. Suggest real, discoverable people. Explain why each fits their viewing.

Return ONLY valid JSON:
{"suggestions":[{"name":"Creator/Channel/Account Name","platform":"youtube|twitter|tiktok","reason":"why they should watch"}]}`;

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseSuggestions(text);
  }
  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseSuggestions(text);
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 400, messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  return parseSuggestions(text);
}

function parseSuggestions(text) {
  try {
    const json = text.replace(/```json?\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(json);
    const arr = parsed.suggestions || [];
    return arr.slice(0, 6).map(s => ({
      name: s.name || 'Unknown',
      platform: ['youtube', 'twitter', 'tiktok'].includes(s.platform) ? s.platform : 'youtube',
      reason: s.reason || 'You might like this',
    }));
  } catch (e) {
    return null;
  }
}

function getFallbackSuggestions(topCategories, history) {
  const topics = extractViewingTopics(history || []);
  const platformsUsed = [...new Set((history || []).map(i => i.platform).filter(Boolean))];
  if (platformsUsed.length === 0) platformsUsed.push('youtube', 'twitter', 'tiktok');
  const results = [];
  const seen = new Set();

  if (topics.length > 0) {
    const topicSuggestions = {
      minecraft: [{ name: 'Minecraft builders & redstone', platform: 'youtube', reason: 'Based on your Minecraft viewing' }],
      fortnite: [{ name: 'Fortnite creators', platform: 'youtube', reason: 'Based on your gaming interest' }],
      programming: [{ name: 'Programming tutorials', platform: 'youtube', reason: 'Based on your coding viewing' }],
      cooking: [{ name: 'Cooking & recipe channels', platform: 'youtube', reason: 'Based on your food content' }],
      fitness: [{ name: 'Fitness creators', platform: 'youtube', reason: 'Based on your workout content' }],
      travel: [{ name: 'Travel vloggers', platform: 'youtube', reason: 'Based on your travel viewing' }],
      comedy: [{ name: 'Comedy creators', platform: 'tiktok', reason: 'Based on your humor viewing' }],
      music: [{ name: 'Music creators', platform: 'tiktok', reason: 'Based on your music interest' }],
      science: [{ name: 'Veritasium', platform: 'youtube', reason: 'Based on your science content' }],
      tech: [{ name: 'Tech reviewers', platform: 'youtube', reason: 'Based on your tech viewing' }],
      tutorial: [{ name: 'How-to channels', platform: 'youtube', reason: 'Based on your tutorial viewing' }],
    };
    for (const t of topics) {
      const key = Object.keys(topicSuggestions).find(k => t.toLowerCase() === k || t.toLowerCase().includes(k));
      if (key && topicSuggestions[key]) {
        for (const s of topicSuggestions[key]) {
          if (!seen.has(s.name)) {
            seen.add(s.name);
            results.push(s);
            if (results.length >= 6) return ensurePlatformCoverage(results, platformsUsed);
          }
        }
      }
    }
  }

  for (const [cat] of topCategories.slice(0, 3)) {
    const list = FALLBACK_SUGGESTIONS[cat] || FALLBACK_SUGGESTIONS.entertainment;
    for (const s of list) {
      const key = `${s.name}-${s.platform}`;
      if (!seen.has(key) && (!platformsUsed.length || platformsUsed.includes(s.platform))) {
        seen.add(key);
        results.push(s);
        if (results.length >= 6) return ensurePlatformCoverage(results, platformsUsed);
      }
    }
  }
  if (results.length === 0) {
    const def = FALLBACK_SUGGESTIONS.entertainment;
    return platformsUsed.length ? def.filter(s => platformsUsed.includes(s.platform)).slice(0, 4) : def.slice(0, 3);
  }
  return ensurePlatformCoverage(results, platformsUsed);
}

function ensurePlatformCoverage(results, platformsUsed) {
  const has = { youtube: results.some(r => r.platform === 'youtube'), twitter: results.some(r => r.platform === 'twitter'), tiktok: results.some(r => r.platform === 'tiktok') };
  for (const p of platformsUsed) {
    if (!has[p]) {
      const add = FALLBACK_SUGGESTIONS.entertainment.find(s => s.platform === p);
      if (add && !results.some(r => r.name === add.name)) results.push(add);
    }
  }
  return results.slice(0, 6);
}
