function generateItemId(platform, text, position) {
  const raw = `${platform}-${position}-${(text || '').substring(0, 50)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `${platform}-${Math.abs(hash)}`;
}

function parseEngagementNumber(str) {
  if (!str) return null;
  const clean = String(str).replace(/,/g, '').trim();
  if (clean.endsWith('K')) return Math.round(parseFloat(clean) * 1000);
  if (clean.endsWith('M')) return Math.round(parseFloat(clean) * 1000000);
  return parseInt(clean, 10) || null;
}

function sendItemsToBackground(items, platform) {
  if (items.length === 0) return;
  chrome.runtime.sendMessage({ type: 'SCRAPED_ITEMS', items, platform });
}

function watchFeedForNewContent(containerSelector, callback) {
  const observer = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (hasNewNodes) callback();
  });

  const tryAttach = () => {
    const container = document.querySelector(containerSelector);
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
      return true;
    }
    return false;
  };

  const interval = setInterval(() => {
    if (tryAttach()) clearInterval(interval);
  }, 1000);
}
