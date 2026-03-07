function scrapeYouTubeFeed() {
  const items = [];
  const videoCards = document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer');

  videoCards.forEach((card, index) => {
    const titleEl = card.querySelector('#video-title, #title');
    const channelEl = card.querySelector('#channel-name, .ytd-channel-name');
    const viewsEl = card.querySelector('#metadata-line span:first-child, .inline-metadata-item');
    const isRecommendedBadge = card.querySelector('[aria-label*="Recommended"]');

    const title = titleEl?.textContent?.trim();
    if (!title || title.length < 3) return;

    const channel = channelEl?.textContent?.trim() || '';
    const views = viewsEl?.textContent?.trim() || '';

    const item = {
      id: generateItemId('youtube', title, index),
      platform: 'youtube',
      timestamp: Date.now(),
      text: `${title}. Channel: ${channel}`,
      contentType: 'video',
      isRecommended: !!isRecommendedBadge || index > 3,
      engagementMetrics: {
        likes: null,
        comments: null,
        shares: null,
        views: parseEngagementNumber(views)
      },
      feedPosition: index,
      classification: null
    };

    items.push(item);
  });

  sendItemsToBackground(items.slice(0, 20), 'youtube');
}

scrapeYouTubeFeed();
watchFeedForNewContent('ytd-browse, ytd-page-manager', scrapeYouTubeFeed);
