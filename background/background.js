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

function buildContentBlock(title, description, content) {
  const parts = [];
  if (title) parts.push('Title: ' + title.substring(0, 600));
  if (description) parts.push('Description: ' + description.substring(0, 600));
  if (!title && !description && content) parts.push('Content: ' + content.substring(0, 1500));
  else if (content && (title || description)) parts.push('Full text: ' + content.substring(0, 800));
  return parts.length ? parts.join('\n\n') : content.substring(0, 1500);
}

async function classifyWithAPI(content, apiKey, provider = 'gemini', context = {}) {
  const { isAdSlot = false, title: contextTitle, description: contextDesc } = context;
  const contentBlock = buildContentBlock(contextTitle || '', contextDesc || '', content || '');

  const geminiPrompt = `Classify this social media content. Use the title and description below.

${contentBlock}
${isAdSlot ? '\n(This is in a promoted slot; still classify by the content itself.)' : ''}

You MUST choose one: either EDUCATIONAL/INFORMATIONAL or MANIPULATIVE. Use the full scale. Do NOT default to neutral for clearly manipulative or clearly educational content.

MANIPULATIVE (answer manipulative: true, mechanic NOT neutral, manipulation_intensity 55-100):
- Scams, get-rich-quick, "make money fast", "free money", crypto/forex schemes, "act now", "limited time", "don't miss out", "you won't believe", "secret", "exposed", "they don't want you to know" → "curiosity_gap" or "commercial_manipulation", intensity 65-90
- AI-generated content, "made by AI", "ChatGPT", "deepfake", synthetic media used to mislead or bait engagement → "curiosity_gap", intensity 60-85
- Government conspiracies, "cover-up", "false flag", "deep state", "they're hiding", "mainstream media lying", "wake up", conspiracy framing, us-vs-them → "tribal_identity" or "outrage" or "fear", intensity 65-95
- Manipulative ads (urgency, FOMO, fake scarcity) → "commercial_manipulation", intensity 60-90
- Clickbait, sensationalism, outrage bait, fear-mongering → "curiosity_gap" or "outrage" or "fear", intensity 55-95

EDUCATIONAL (answer educational: true, mechanic "informational", manipulation_intensity 0-25):
- Teaching, science, facts, how-to, calm explainer, STEM, medical/biology explainer, tutorials, research, documentaries. Only if it is calm and factual.

NEUTRAL (only when truly neither):
- Bland entertainment, vague posts, normal vlogs with no pressure or sensationalism. Use neutral only when content has no clear educational value AND no manipulation signals.

Return ONLY this JSON, no other text:
{"educational": true or false, "manipulative": true or false, "mechanic": "informational" or "neutral" or "curiosity_gap" or "outrage" or "fear" or "controversy" or "commercial_manipulation" or "tribal_identity" or "humor" or "inspiration", "manipulation_intensity": 0-100}`;

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: geminiPrompt }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.1, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error('Gemini API ' + res.status);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseGeminiClassification(typeof text === 'string' ? text : '');
  }

  const prompt = `You are an expert at detecting algorithmic manipulation, propaganda, engagement bait, and misinformation in social media content. Your job is to classify how strongly this content is designed to manipulate the viewer—not to be conservative. Use the full scale.

CONTENT TO ANALYZE:
---
${contentBlock}
---
${isAdSlot ? "(The platform placed this in a promoted slot—classify by the content itself; most promoted content is not commercial_manipulation.)" : ""}

CRITICAL - WHEN TO USE "commercial_manipulation":
- Use "commercial_manipulation" ONLY when the content is unambiguously a paid advertisement (selling a product, service, or brand) AND it uses psychological manipulation (urgency, FOMO, targeting, emotional hooks). This term signals high manipulation: paid content designed to persuade. If the content is just informational or low-key commercial, use curiosity_gap or neutral instead.
- Do NOT use "commercial_manipulation" for: recommended/viral videos, promoted posts that are normal news/drama/entertainment, boosted organic content. Classify those by their actual mechanic (outrage, curiosity_gap, controversy, humor, etc.). When in doubt, use curiosity_gap, controversy, or neutral—not commercial_manipulation.

WHEN TO USE "informational" (green label; show as "Informational"):
- Use "informational" when the content is genuinely useful: factual, educational, how-to, explainer, news without sensationalism, science, tutorials, or calm explanatory content with no emotional manipulation or engagement bait. manipulation_intensity should be 0–25. This is the green, positive category.
- STEM and educational: If the content is about Science, Technology, Engineering, or Mathematics (physics, chemistry, biology, coding, math, engineering, research, experiments, STEM, explainers, lessons, courses, learning, education, tutorial, how it works, documentary, facts), classify as "informational" with manipulation_intensity 0–25. Only use something else if it is obviously sensationalized or engagement-bait. Anything STEM-related or educational must be "informational" and green.
- Medical and biology: Content about health, medicine, anatomy, how the body works, patient stories, clinical topics, or biology (e.g. cartilage, ligaments, conditions, treatments) is "informational" with 0–25 intensity unless it is clearly sensationalized or engagement-bait. Do NOT label calm educational science/medical posts as manipulation.

OTHER RULES:
- Use "neutral" for content that is neither clearly manipulative nor clearly informational (e.g. bland entertainment, vague posts).
- Do NOT default to "neutral" when the content is clearly educational or factual—use "informational" instead.
- Propaganda, misinformation, and engagement bait: use outrage, fear, tribal_identity, controversy, or curiosity_gap with intensity 50–100 when the content uses emotional triggers, us-vs-them framing, sensationalism, or clearly seeks viral engagement.
- manipulation_intensity: 0–25 = informational or benign; 30–50 = neutral or light pull; 40–60 = some emotional pull or engagement bait; 70–100 = strong propaganda or heavy engagement bait.
- urgency_signals: true if the content uses urgency language ("breaking", "you won't believe", "before it's too late", "everyone is talking", "secret", "exposed", "finally", "they're hiding").

Return ONLY this JSON, no other text:
{"emotional_valence":"positive|neutral|negative|provocative","manipulation_mechanic":"outrage|fear|social_comparison|humor|inspiration|controversy|curiosity_gap|tribal_identity|neutral|informational|commercial_manipulation","urgency_signals":true|false,"manipulation_intensity":0-100,"content_category":"${CONTENT_CATEGORIES.join('|')}"}`;

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

function extractJsonObject(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.replace(/```json?\s*|\s*```/g, '').trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  let jsonStr = trimmed.slice(first, last + 1);
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  return jsonStr;
}

function parseGeminiClassification(text) {
  const defaultClassification = {
    manipulation_mechanic: 'neutral',
    manipulation_intensity: 30,
    urgency_signals: false,
    emotional_valence: 'neutral',
    content_category: 'other',
  };
  try {
    let jsonStr = (text || '').trim();
    if (!jsonStr) return defaultClassification;
    const extracted = extractJsonObject(text);
    if (extracted) jsonStr = extracted;
    else jsonStr = jsonStr.replace(/```json?\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    let mechanic = String(parsed.mechanic || 'neutral').toLowerCase().replace(/\s+/g, '_');
    if (mechanic === 'ad') mechanic = 'commercial_manipulation';
    if (mechanic === 'information') mechanic = 'informational';
    if (parsed.educational === true) mechanic = 'informational';
    const intensity = Math.min(100, Math.max(0, parseInt(parsed.manipulation_intensity, 10) || 0));
    return {
      manipulation_mechanic: mechanic,
      manipulation_intensity: parsed.educational === true ? Math.min(intensity, 25) : intensity,
      urgency_signals: false,
      emotional_valence: 'neutral',
      content_category: 'other',
    };
  } catch (e) {
    return defaultClassification;
  }
}

function parseClassification(text) {
  const defaultClassification = {
    manipulation_mechanic: 'neutral',
    manipulation_intensity: 30,
    urgency_signals: false,
    emotional_valence: 'neutral',
    content_category: 'other',
  };
  try {
    const jsonStr = extractJsonObject(text) || (text || '').replace(/```json?\s*|\s*```/g, '').trim();
    if (!jsonStr) return defaultClassification;
    const parsed = JSON.parse(jsonStr);
    let category = (parsed.content_category || 'other').toLowerCase().replace(/\s+/g, '_');
    if (!CONTENT_CATEGORIES.includes(category)) category = 'other';
    let mechanic = (parsed.manipulation_mechanic || 'neutral').toLowerCase().replace(/\s+/g, '_');
    if (mechanic === 'ad') mechanic = 'commercial_manipulation';
    if (mechanic === 'information') mechanic = 'informational';
    return {
      manipulation_mechanic: mechanic,
      manipulation_intensity: Math.min(100, Math.max(0, parseInt(parsed.manipulation_intensity, 10) || 0)),
      urgency_signals: !!parsed.urgency_signals,
      emotional_valence: parsed.emotional_valence || 'neutral',
      content_category: category,
    };
  } catch (e) {
    return defaultClassification;
  }
}

const STEM_EDU_KEYWORDS = /\b(stem|science|math|physics|chemistry|biology|biological|engineering|medical|medicine|medicinal|anatomy|physiology|physiological|coding|programming|tutorial|lesson|course|learn|education|educational|how it works|explainer|documentary|facts|research|experiment|khan|crash course|ted\b|tedx|algebra|calculus|organic chemistry|introduction to|veritasium|numberphile|3blue1brown|cartilage|ligament|tendon|parkinson|tremor|clinical|patient)\b/i;
const STEM_EDU_SUBSTRING = /interestingstem|\bstem\b|stem\s/; // @InterestingSTEM and "stem" as word or before space

function ensureInformationalForStemEdu(content, classification) {
  if (!classification || !content) return classification;
  const text = (typeof content === 'string' ? content : '').toLowerCase();
  const match = STEM_EDU_KEYWORDS.test(text) || STEM_EDU_SUBSTRING.test(text);
  if (!match) return classification;
  return {
    ...classification,
    manipulation_mechanic: 'informational',
    manipulation_intensity: Math.min(classification.manipulation_intensity || 0, 25),
  };
}

const MANIPULATION_SIGNALS = (function () {
  const scam = /\b(scam|scams|scamming|act now|limited time|only \d+ left|don't miss out|everyone is talking|you won't believe|secret|exposed|make money fast|free money|get rich|crypto scheme|forex scam|click here|last chance|expires soon|order now|buy now|limited offer|exclusive deal|risk.?free|guaranteed results|earn \d+|they're hiding|before it's too late|breaking.*shocking|urgent|instant cash|instant money|million in|no credit card|free trial|\d+%\s*off)\b/i;
  const aiGenerated = /\b(ai generated|ai.?generated|generated by ai|made by ai|ai made|ai created|chatgpt|openai|deepfake|deep fake|ai.?created|created by ai|written by ai|this is ai|fake.*ai|ai.*fake)\b/i;
  const conspiracy = /\b(conspiracy|conspiracies|government cover|govt cover|cover.?up|false flag|they're lying|mainstream (media )?lying|mainstream (media )?hiding|media blackout|they don't want you to know|wake up|open your eyes|sheeple|truth they hide|hidden truth|narrative|the narrative|controlled (media|narrative)|deep state|new world order|illuminati|they're hiding|wake.?up)\b/i;
  return function (text) {
    const t = (text || '').toLowerCase();
    return scam.test(t) || aiGenerated.test(t) || conspiracy.test(t);
  };
})();

function ensureManipulativeWhenSignals(content, classification) {
  if (!classification || !content) return classification;
  if (classification.manipulation_mechanic === 'informational') return classification;
  if (classification.manipulation_mechanic !== 'neutral') return classification;
  const text = (typeof content === 'string' ? content : '').toLowerCase();
  if (!MANIPULATION_SIGNALS(text)) return classification;
  const isAd = /\b(ad|promoted|sponsored)\b/i.test(text);
  const isConspiracy = /\b(conspiracy|cover.?up|false flag|deep state|they're (lying|hiding)|wake.?up|mainstream (media )?(lying|hiding))\b/i.test(text);
  const isAi = /\b(ai generated|generated by ai|made by ai|chatgpt|deepfake|ai.?created|created by ai)\b/i.test(text);
  let mechanic = 'curiosity_gap';
  if (isAd) mechanic = 'commercial_manipulation';
  else if (isConspiracy) mechanic = 'tribal_identity';
  else if (isAi) mechanic = 'ai_generated';
  return {
    ...classification,
    manipulation_mechanic: mechanic,
    manipulation_intensity: Math.max(classification.manipulation_intensity || 0, 72),
  };
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
      const defaultClassification = {
        manipulation_mechanic: 'neutral',
        manipulation_intensity: 30,
        urgency_signals: false,
        emotional_valence: 'neutral',
        content_category: 'other',
      };
      const contentForFallback = [msg.title, msg.description, msg.content].filter(Boolean).join(' ');
      if (!apiKey) {
        const fallback = ensureInformationalForStemEdu(contentForFallback, defaultClassification);
        sendResponse({ classification: fallback });
        return;
      }
      const settings = (await chrome.storage.local.get([SETTINGS_KEY]))[SETTINGS_KEY] || {};
      const provider = settings.provider || 'gemini';
      const opts = { isAdSlot: !!msg.isAd, title: msg.title, description: msg.description };
      let classification = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          classification = await classifyWithAPI(msg.content || contentForFallback, apiKey, provider, opts);
          if (classification) break;
        } catch (e) {
          if (attempt === 3) classification = defaultClassification;
          else await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
      if (!classification) classification = defaultClassification;
      classification = ensureInformationalForStemEdu(contentForFallback || msg.content, classification);
      classification = ensureManipulativeWhenSignals(contentForFallback || msg.content, classification);
      sendResponse({ classification });
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
      aggregates.tips = getTipsForUser(aggregates);
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

const TIPS = [
  { id: 'autoplay', title: 'Turn off autoplay', body: 'On YouTube and TikTok, disable autoplay so you choose what to watch next instead of the algorithm.', category: 'reduce_manipulation' },
  { id: 'not_interested', title: 'Use "Not interested"', body: 'Tap "Not interested" or "Don\'t recommend channel" on content you don\'t want. It trains the feed over time.', category: 'reduce_manipulation' },
  { id: 'subscriptions_first', title: 'Prefer Subscriptions over Home', body: 'On YouTube, open Subscriptions first. On X and TikTok, check Following before For You so you see people you chose.', category: 'reduce_manipulation' },
  { id: 'mute_words', title: 'Mute words and topics', body: 'On X, use muted words to hide triggering or low-value topics. Fewer outrage hooks means a calmer feed.', category: 'reduce_manipulation' },
  { id: 'time_cap', title: 'Set a daily time cap', body: 'Use a timer or phone settings to limit time per app. Even a soft limit helps you scroll more intentionally.', category: 'productive_use' },
  { id: 'short_breaks', title: 'Take a 5‑minute break after 30 min', body: 'Step away from the feed every 30 minutes. Short breaks reduce endless scroll and help you notice when you\'re done.', category: 'productive_use' },
  { id: 'follow_educational', title: 'Follow more educational accounts', body: 'Add a few STEM, how‑to, or news accounts you trust. They balance out viral and sensational content.', category: 'productive_use' },
  { id: 'block_learning_time', title: 'Block time for learning vs. entertainment', body: 'Decide in advance: "This 20 min is for learning" vs. "This is for fun." It reduces guilt and overuse.', category: 'productive_use' },
  { id: 'review_history', title: 'Review your watch history weekly', body: 'Skim what you actually watched. It makes algorithm influence visible and helps you adjust what you click.', category: 'productive_use' },
  { id: 'focus_mode', title: 'Use focus mode or site blockers', body: 'During work or study, use Do Not Disturb or a blocker for social apps so feeds don\'t pull you in.', category: 'productive_use' },
];

function getTipsForUser(aggregates) {
  const mins = aggregates.minutesByPlatform || { youtube: 0, twitter: 0, tiktok: 0 };
  const byMechanic = aggregates.byMechanic || {};
  const totalMins = (mins.youtube || 0) + (mins.twitter || 0) + (mins.tiktok || 0);
  const topPlatform = totalMins > 0
    ? [['youtube', mins.youtube], ['twitter', mins.twitter], ['tiktok', mins.tiktok]].sort((a, b) => (b[1] || 0) - (a[1] || 0))[0][0]
    : null;
  const highEngagement = (byMechanic.curiosity_gap || 0) + (byMechanic.outrage || 0) > (aggregates.totalItems || 0) / 2;
  const reduceFirst = !!aggregates.manipulationWarning;

  const ordered = [...TIPS];
  if (reduceFirst) {
    ordered.sort((a, b) => (a.category === 'reduce_manipulation' ? 0 : 1) - (b.category === 'reduce_manipulation' ? 0 : 1));
  }
  if (highEngagement) {
    const autoplay = ordered.find(t => t.id === 'autoplay');
    const notInt = ordered.find(t => t.id === 'not_interested');
    if (autoplay) ordered.splice(ordered.indexOf(autoplay), 1), ordered.unshift(autoplay);
    if (notInt) ordered.splice(ordered.indexOf(notInt), 1), ordered.splice(1, 0, notInt);
  }
  if (topPlatform) {
    const timeCap = ordered.find(t => t.id === 'time_cap');
    if (timeCap) ordered.splice(ordered.indexOf(timeCap), 1), ordered.splice(Math.min(2, ordered.length), 0, timeCap);
  }
  return ordered.slice(0, 8);
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
