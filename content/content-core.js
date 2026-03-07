// Content script core - orchestrates scraping, classification, overlay
(function() {
  const SCRAPE_INTERVAL = 5000;
  const BATCH_SIZE = 5;
  let overlayEnabled = true;
  let processedIds = new Set();

  async function scrapeAndClassify() {
    const scraper = window.MANIPULATION_AUDITOR_SCRAPER;
    if (!scraper) return;

    const items = scraper.getFeedItems();
    const newItems = items.filter((item) => {
      const id = item.isWatching ? `watch-${item.text?.substring(0, 40)}` : `${item.position}-${item.text?.substring(0, 50)}`;
      return !processedIds.has(id);
    }).slice(0, BATCH_SIZE);

    for (const item of newItems) {
      const id = item.isWatching ? `watch-${item.text?.substring(0, 40)}` : `${item.position}-${item.text?.substring(0, 50)}`;
      processedIds.add(id);
      
      const classification = await classifyContent(item);
      if (classification) {
        item.classification = classification;
        chrome.runtime.sendMessage({ type: 'STORE_CONTENT', data: item }).catch(() => {});
        if (overlayEnabled && item.element) {
          addOverlayTag(item.element, classification);
        }
      }
    }
  }

  async function classifyContent(item) {
    try {
      if (!chrome.runtime?.id) return fallbackClassify(item);
      const response = await chrome.runtime.sendMessage({
        type: 'CLASSIFY_CONTENT',
        content: item.text,
        isAd: item.isAd,
      });
      return response?.classification || fallbackClassify(item);
    } catch (e) {
      return fallbackClassify(item);
    }
  }

  function fallbackClassify(item) {
    // Client-side heuristic when API unavailable
    const text = (item.text || '').toLowerCase();
    const urgencyWords = ['breaking', 'shocking', 'you won\'t believe', 'secret', 'exposed', 'everyone is talking'];
    const hasUrgency = urgencyWords.some(w => text.includes(w));
    const cat = inferCategoryFromText(item.text);
    return {
      manipulation_mechanic: item.isAd ? 'ad' : (hasUrgency ? 'curiosity_gap' : 'neutral'),
      manipulation_intensity: item.isAd ? 80 : (hasUrgency ? 60 : 20),
      urgency_signals: hasUrgency,
      content_category: cat,
    };
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

  function addOverlayTag(element, classification) {
    if (element.querySelector('.ma-overlay-tag')) return;

    const tag = document.createElement('div');
    tag.className = 'ma-overlay-tag';
    const mechanic = classification.manipulation_mechanic || 'neutral';
    const color = MANIPULATION_AUDITOR?.CATEGORY_COLORS?.[mechanic] || '#6b7280';
    tag.style.backgroundColor = color;
    tag.textContent = mechanic.replace(/_/g, ' ');
    tag.title = `Intensity: ${classification.manipulation_intensity || 0}%`;
    
    element.style.position = 'relative';
    element.appendChild(tag);
  }

  function init() {
    chrome.storage.local.get(['ma_overlay_enabled'], (r) => {
      overlayEnabled = r.ma_overlay_enabled !== false;
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (changes.ma_overlay_enabled) {
        overlayEnabled = changes.ma_overlay_enabled.newValue !== false;
      }
    });

    scrapeAndClassify();
    setInterval(scrapeAndClassify, SCRAPE_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
