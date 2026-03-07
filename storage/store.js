const store = {
  async getSettings() {
    const result = await chrome.storage.local.get('clarity_settings');
    return result.clarity_settings || {
      overlayEnabled: true,
      classificationEnabled: true,
      apiKey: '',
      supportedPlatforms: ['youtube', 'twitter', 'reddit']
    };
  },

  async getItems() {
    const result = await chrome.storage.local.get('clarity_items');
    return result.clarity_items || [];
  },

  async getRecentStats(platform, minutesBack) {
    const items = await this.getItems();
    const cutoff = Date.now() - (minutesBack * 60 * 1000);
    const recent = items.filter(
      (i) =>
        i.platform === platform &&
        i.timestamp > cutoff &&
        i.classification
    );

    if (recent.length === 0) {
      return { avgManipulationIntensity: 0, count: 0 };
    }

    const avg =
      recent.reduce((sum, i) => sum + i.classification.manipulationIntensity, 0) /
      recent.length;
    return { avgManipulationIntensity: avg, count: recent.length };
  }
};
