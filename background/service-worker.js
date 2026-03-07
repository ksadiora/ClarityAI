importScripts('../classifier/classifier.js');
importScripts('../storage/store.js');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPED_ITEMS') {
    handleScrapedItems(message.items, message.platform).then(() => sendResponse({ received: true }));
    return true;
  }
  if (message.type === 'GET_SESSION_STATS') {
    store.getRecentStats(message.platform, 60).then(sendResponse);
    return true;
  }
  if (message.type === 'OPEN_DASHBOARD') {
    chrome.runtime.openOptionsPage();
  }
});

async function handleScrapedItems(items, platform) {
  const settings = await store.getSettings();
  if (!settings.classificationEnabled || !settings.apiKey) return;

  const classified = [];
  for (const item of items) {
    const existing = await store.getItemById(item.id);
    if (existing) continue;

    try {
      const classification = await classifyItem(item, settings.apiKey);
      item.classification = classification;
      classified.push(item);
    } catch (e) {
      item.classification = {
        emotionalValence: 'unknown',
        manipulationMechanic: 'unknown',
        manipulationIntensity: 0,
        urgencySignals: false,
        reasoning: 'Classification failed.',
        classifiedAt: Date.now()
      };
      classified.push(item);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (classified.length > 0) {
    await store.appendItems(classified);
    await updateBadge(platform);

    if (settings.overlayEnabled) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'CLASSIFICATIONS_READY', items: classified });
        } catch (_) {}
      }
    }
  }
}

async function updateBadge(platform) {
  const stats = await store.getRecentStats(platform, 60);
  if (stats.count === 0) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const intensity = stats.avgManipulationIntensity;
  let color = '#22c55e';
  if (intensity > 0.4) color = '#f59e0b';
  if (intensity > 0.7) color = '#ef4444';
  const score = Math.round(intensity * 100).toString();
  chrome.action.setBadgeText({ text: score });
  chrome.action.setBadgeBackgroundColor({ color });
}
