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

  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },

  async getItems() {
    const result = await chrome.storage.local.get('clarity_items');
    return result.clarity_items || [];
  },

  async appendItems(newItems) {
    const existing = await this.getItems();
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    const filtered = existing.filter((i) => i.timestamp > cutoff);
    await this.set('clarity_items', [...filtered, ...newItems]);
  },

  async getItemById(id) {
    const items = await this.getItems();
    return items.find((i) => i.id === id) || null;
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
