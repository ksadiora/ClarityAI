// Twitter/X content scraper - extracts feed item metadata from DOM
window.MANIPULATION_AUDITOR_SCRAPER = {
  platform: 'twitter',
  
  getFeedItems() {
    const items = [];
    // Twitter article/tweet elements
    const articleSelectors = [
      'article[data-testid="tweet"]',
      '[data-testid="tweet"]',
      'article',
    ];
    
    let articles = [];
    for (const sel of articleSelectors) {
      articles = document.querySelectorAll(sel);
      if (articles.length > 0) break;
    }
    
    articles.forEach((el, index) => {
      const data = this.extractItem(el, index);
      if (data && data.text) {
        items.push(data);
      }
    });
    return items;
  },

  extractItem(element, position) {
    try {
      const tweetTextEl = element.querySelector('[data-testid="tweetText"], [lang]');
      const text = tweetTextEl ? tweetTextEl.textContent.trim() : '';
      
      const nameEl = element.querySelector('[data-testid="User-Name"]');
      const nameText = nameEl ? nameEl.textContent.trim() : '';
      
      const engagementEl = element.querySelector('[data-testid="app-text-transition-container"]');
      const engagement = engagementEl ? engagementEl.textContent.trim() : '';
      
      const isPromoted = element.querySelector('[data-testid="socialContext"]')?.textContent?.toLowerCase().includes('promoted') || 
                        element.querySelector('[data-testid="placementTracking"]');
      
      const fullText = [text, nameText, engagement].filter(Boolean).join(' | ');
      if (!fullText) return null;

      return {
        platform: 'twitter',
        text: fullText.substring(0, 500),
        position,
        engagement,
        contentType: 'tweet',
        isAd: !!isPromoted,
        element,
        timestamp: Date.now(),
      };
    } catch (e) {
      return null;
    }
  },
};
