// TikTok content scraper - tiktok.com For You feed
window.MANIPULATION_AUDITOR_SCRAPER = {
  platform: 'tiktok',

  getCardElementAtPosition(position) {
    if (position < 0) return null;
    const items = this.getFeedItems();
    const item = items[position];
    return item?.element || null;
  },

  getFeedItems() {
    const items = [];
    const seen = new Set();

    // Strategy 1: Links to videos - /video/ or /@user/video/
    const videoLinks = document.querySelectorAll('a[href*="/video/"]');
    videoLinks.forEach((link, index) => {
      const href = (link.getAttribute('href') || '').split('?')[0];
      if (!href || seen.has(href)) return;
      seen.add(href);

      let container = link;
      for (let i = 0; i < 10 && container; i++) {
        container = container.parentElement;
        if (!container) break;
        const txt = (container.textContent || '').trim();
        if (txt.length > 30 && txt.length < 3000) break;
      }
      container = container || link.parentElement || link;

      const fullText = (container?.textContent || '').trim();
      if (fullText.length < 15) return;

      const isAd = fullText.toLowerCase().includes('sponsored') || fullText.toLowerCase().includes('ad');

      const isFollowing = (window.location.pathname || '').indexOf('/following') === 0;
      items.push({
        platform: 'tiktok',
        text: fullText.substring(0, 500),
        position: items.length,
        engagement: '',
        contentType: 'video',
        isAd,
        isRecommended: !isFollowing,
        element: container,
        timestamp: Date.now(),
      });
    });

    // Strategy 2: divs with data-e2e (TikTok uses these)
    if (items.length === 0) {
      const blocks = document.querySelectorAll('[data-e2e="browse-video-desc"], [data-e2e="video-desc"], [data-e2e="recommend-list-item"]');
      blocks.forEach((el, index) => {
        const txt = (el.textContent || '').trim();
        if (txt.length >= 20 && txt.length <= 2000) {
          const link = el.querySelector('a[href*="/video/"]');
          const href = link?.getAttribute('href') || `block-${index}`;
          if (seen.has(href)) return;
          seen.add(href);

          const isFollowing = (window.location.pathname || '').indexOf('/following') === 0;
          items.push({
            platform: 'tiktok',
            text: txt.substring(0, 500),
            position: items.length,
            engagement: '',
            contentType: 'video',
            isAd: txt.toLowerCase().includes('sponsored'),
            isRecommended: !isFollowing,
            element: el,
            timestamp: Date.now(),
          });
        }
      });
    }

    // Strategy 3: Any div containing substantial text near video context
    if (items.length === 0) {
      const allDivs = document.querySelectorAll('div[class*="DivItemContainer"], div[class*="ItemContainer"]');
      allDivs.forEach((el, index) => {
        const txt = (el.textContent || '').trim();
        if (txt.length >= 40 && txt.length <= 2500) {
          const id = `div-${index}-${txt.substring(0, 30)}`;
          if (seen.has(id)) return;
          seen.add(id);

          const isFollowing = (window.location.pathname || '').indexOf('/following') === 0;
          items.push({
            platform: 'tiktok',
            text: txt.substring(0, 500),
            position: items.length,
            engagement: '',
            contentType: 'video',
            isAd: false,
            isRecommended: !isFollowing,
            element: el,
            timestamp: Date.now(),
          });
        }
      });
    }

    return items.slice(0, 25);
  },
};
