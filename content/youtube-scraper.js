// YouTube content scraper - extracts feed item metadata from DOM
window.MANIPULATION_AUDITOR_SCRAPER = {
  platform: 'youtube',

  _getCardElements() {
    var list = [];
    var selectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-reel-item-renderer',
      'ytd-compact-video-renderer',
    ];
    for (var s = 0; s < selectors.length; s++) {
      var els = document.querySelectorAll(selectors[s]);
      for (var i = 0; i < els.length; i++) {
        var data = this.extractItem(els[i], list.length);
        if (data && data.text) list.push(els[i]);
      }
    }
    return list;
  },

  getCardElementAtPosition(position) {
    if (position < 0) return null;
    var cards = this._getCardElements();
    return cards[position] || null;
  },

  getFeedItems() {
    var items = [];
    var path = window.location.pathname || '';
    var isSubscriptionsFeed = path.indexOf('/feed/subscriptions') === 0;
    var isRecommendedFeed = !isSubscriptionsFeed;

    if (path === '/watch') {
      var watchItem = this.extractWatchPageVideo();
      if (watchItem) {
        watchItem.isRecommended = false;
        items.push(watchItem);
      }
    }
    var selectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-reel-item-renderer',
      'ytd-compact-video-renderer',
    ];
    var position = 0;
    for (var s = 0; s < selectors.length; s++) {
      var els = document.querySelectorAll(selectors[s]);
      for (var i = 0; i < els.length; i++) {
        var data = this.extractItem(els[i], position);
        if (data && data.text) {
          data.isRecommended = isRecommendedFeed;
          items.push(data);
          position++;
        }
      }
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
        title: title || undefined,
        description: [channel, desc].filter(Boolean).join('\n') || undefined,
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

  _textFrom(el, selectors) {
    if (!el) return '';
    var s = Array.isArray(selectors) ? selectors : [selectors];
    for (var i = 0; i < s.length; i++) {
      var out = this._querySelectorDeep(el, s[i]);
      if (out) return out;
    }
    return '';
  },

  _querySelectorDeep(el, selector) {
    if (!el) return '';
    var node = el.querySelector(selector);
    if (node && node.textContent) return node.textContent.trim();
    if (el.shadowRoot) {
      node = el.shadowRoot.querySelector(selector);
      if (node && node.textContent) return node.textContent.trim();
      var children = el.shadowRoot.children || [];
      for (var i = 0; i < children.length; i++) {
        var t = this._querySelectorDeep(children[i], selector);
        if (t) return t;
      }
    }
    return '';
  },

  _firstWatchLinkText(el) {
    if (!el) return '';
    var links = el.querySelectorAll ? el.querySelectorAll('a[href*="/watch"]') : [];
    for (var i = 0; i < links.length; i++) {
      var t = links[i].textContent && links[i].textContent.trim();
      if (t && t.length > 2) return t;
    }
    if (el.shadowRoot) {
      links = el.shadowRoot.querySelectorAll('a[href*="/watch"]');
      for (var i = 0; i < links.length; i++) {
        var t = links[i].textContent && links[i].textContent.trim();
        if (t && t.length > 2) return t;
      }
      var children = el.shadowRoot.children || [];
      for (var j = 0; j < children.length; j++) {
        var out = this._firstWatchLinkText(children[j]);
        if (out) return out;
      }
    }
    return '';
  },

  extractItem(element, position) {
    try {
      var text = this._textFrom(element, [
        '#video-title', '[id="video-title"]',
        'a#video-title', 'a[href*="/watch"]',
        'yt-formatted-string#video-title', 'h3 a', 'ytd-video-meta-block + a',
        '.title style-scope yt-formatted-string', '#video-title style-scope yt-formatted-string'
      ]);
      if (!text) text = this._firstWatchLinkText(element);
      var metaText = this._textFrom(element, ['#metadata-line', '.metadata-line']);
      var channel = this._textFrom(element, ['#channel-name a', '#text.ytd-channel-name', 'a[href*="/channel/"]', 'a[href*="/@"]']);
      var viewCount = this._textFrom(element, ['#metadata-line span', 'span.ytd-video-meta-block']);
      var isAd = element.closest('ytd-ad-slot-renderer') || element.querySelector('.ytd-display-ad-renderer');
      if (element.shadowRoot && !isAd) {
        isAd = element.shadowRoot.querySelector('.ytd-display-ad-renderer');
      }
      var fullText = [text, metaText, channel, viewCount].filter(Boolean).join(' | ');
      if (!fullText || fullText.length < 3) return null;
      var descPart = [channel, metaText].filter(Boolean).join(' · ') || '';

      return {
        platform: 'youtube',
        text: fullText.substring(0, 500),
        title: text ? text.substring(0, 300) : undefined,
        description: descPart ? descPart.substring(0, 300) : undefined,
        position: position,
        engagement: viewCount,
        contentType: element.tagName.indexOf('REEL') >= 0 ? 'short' : 'video',
        isAd: !!isAd,
        element: element,
        timestamp: Date.now(),
      };
    } catch (e) {
      return null;
    }
  },
};
