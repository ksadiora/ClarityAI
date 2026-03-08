// Twitter/X content scraper - extracts feed item metadata from DOM (posts + videos)
window.MANIPULATION_AUDITOR_SCRAPER = {
  platform: 'twitter',

  _getCardElements() {
    const selectors = [
      'article[data-testid="tweet"]',
      '[data-testid="tweet"]',
      'div[data-testid="tweet"]',
    ];
    for (const sel of selectors) {
      const list = document.querySelectorAll(sel);
      if (list.length > 0) return Array.from(list);
    }
    return [];
  },

  getCardElementAtPosition(position) {
    if (position < 0) return null;
    const cards = this._getCardElements();
    return cards[position] || null;
  },

  _isFollowingFeed() {
    const followingLink = document.querySelector('a[href="/following"], a[href*="following"]');
    return !!(followingLink && (followingLink.getAttribute('aria-selected') === 'true' || followingLink.getAttribute('aria-current')));
  },

  getFeedItems() {
    const cards = this._getCardElements();
    const items = [];
    const isRecommendedFeed = !this._isFollowingFeed();
    for (let i = 0; i < cards.length; i++) {
      const data = this.extractItem(cards[i], i);
      if (data && data.text) {
        data.isRecommended = isRecommendedFeed;
        items.push(data);
      }
    }
    return items;
  },

  _textFrom(el, selectors) {
    if (!el) return '';
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      const node = el.querySelector(sel);
      if (node && node.textContent) return node.textContent.trim();
    }
    return '';
  },

  extractItem(element, position) {
    try {
      const tweetText = this._textFrom(element, [
        '[data-testid="tweetText"]',
        '[data-testid="tweetText"] span',
        '[lang]',
        'div[dir="auto"][lang]',
      ]);
      const nameText = this._textFrom(element, [
        '[data-testid="User-Name"]',
        '[data-testid="User-Name"] span',
        'a[role="link"] span[dir="ltr"]',
      ]);
      const engagement = this._textFrom(element, [
        '[data-testid="app-text-transition-container"]',
        '[data-testid="reply"]',
        '[data-testid="retweet"]',
        '[data-testid="like"]',
      ]);
      const hasVideo = element.querySelector('video, [data-testid="videoPlayer"], a[href*="/i/status/"]');
      const isPromoted =
        (element.querySelector('[data-testid="socialContext"]')?.textContent?.toLowerCase() || '').includes('promoted') ||
        !!element.querySelector('[data-testid="placementTracking"]');

      let fullText = [tweetText, nameText, engagement].filter(Boolean).join(' | ');
      if (!fullText) {
        fullText = element.textContent.trim().substring(0, 500);
      }
      if (!fullText || fullText.length < 2) return null;

      return {
        platform: 'twitter',
        text: fullText.substring(0, 500),
        title: tweetText ? tweetText.substring(0, 500) : undefined,
        description: [nameText, engagement].filter(Boolean).join(' · ') || undefined,
        position,
        engagement,
        contentType: hasVideo ? 'video' : 'tweet',
        isAd: !!isPromoted,
        element,
        timestamp: Date.now(),
      };
    } catch (e) {
      return null;
    }
  },
};
