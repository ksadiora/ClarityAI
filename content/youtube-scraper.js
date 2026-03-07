// YouTube content scraper - extracts feed item metadata from DOM
window.MANIPULATION_AUDITOR_SCRAPER = {
  platform: 'youtube',
  
  getFeedItems() {
    const items = [];
    
    // If on watch page, include the video you're actively watching (higher weight)
    if (window.location.pathname === '/watch') {
      const watchItem = this.extractWatchPageVideo();
      if (watchItem) items.push(watchItem);
    }
    
    // YouTube home feed, shorts, search results
    const selectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-reel-item-renderer',
      'ytd-compact-video-renderer',
    ];
    
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el, index) => {
        const data = this.extractItem(el, index);
        if (data && data.text) {
          items.push(data);
        }
      });
    }
    return items;
  },

  extractWatchPageVideo() {
    try {
      const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string, #title h1');
      const channelEl = document.querySelector('#channel-name a, #owner-name a');
      const descEl = document.querySelector('#description-inline-expander, #description');
      const title = titleEl ? titleEl.textContent.trim() : '';
      const channel = channelEl ? channelEl.textContent.trim() : '';
      const desc = descEl ? descEl.textContent.trim().substring(0, 300) : '';
      const fullText = [title, channel, desc].filter(Boolean).join(' | ');
      if (!fullText) return null;
      return {
        platform: 'youtube',
        text: fullText,
        position: -1,
        engagement: '',
        contentType: 'video',
        isAd: false,
        isWatching: true,
        element: null,
        timestamp: Date.now(),
      };
    } catch (e) {
      return null;
    }
  },

  extractItem(element, position) {
    try {
      const titleEl = element.querySelector('#video-title, .ytd-video-renderer #video-title, [id="video-title"]');
      const text = titleEl ? titleEl.textContent.trim() : '';
      
      const metaLine = element.querySelector('#metadata-line, .ytd-video-renderer #metadata-line');
      const metaText = metaLine ? metaLine.textContent.trim() : '';
      
      const channelEl = element.querySelector('#channel-name a, #text.ytd-channel-name');
      const channel = channelEl ? channelEl.textContent.trim() : '';
      
      const viewCount = element.querySelector('#metadata-line span')?.textContent || '';
      const isAd = element.closest('ytd-ad-slot-renderer') || element.querySelector('.ytd-display-ad-renderer');
      
      const fullText = [text, metaText, channel, viewCount].filter(Boolean).join(' | ');
      if (!fullText) return null;

      return {
        platform: 'youtube',
        text: fullText.substring(0, 500),
        position,
        engagement: viewCount,
        contentType: element.tagName.includes('REEL') ? 'short' : 'video',
        isAd: !!isAd,
        element,
        timestamp: Date.now(),
      };
    } catch (e) {
      return null;
    }
  },
};
