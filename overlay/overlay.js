chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CLASSIFICATIONS_READY') {
    renderOverlayTags(message.items);
  }
});

const MECHANIC_COLORS = {
  outrage: { bg: '#ef4444', label: '⚡ Outrage' },
  fear: { bg: '#f97316', label: '😰 Fear' },
  social_comparison: { bg: '#a855f7', label: '👁 Comparison' },
  tribal_identity: { bg: '#ec4899', label: '⚔️ Tribal' },
  curiosity_gap: { bg: '#3b82f6', label: '🪤 Curiosity Gap' },
  compulsive_reward: { bg: '#f59e0b', label: '🎰 Reward Loop' },
  controversy: { bg: '#ef4444', label: '🔥 Controversy' },
  inspiration: { bg: '#22c55e', label: '✨ Inspiration' },
  humor: { bg: '#22c55e', label: '😄 Humor' },
  information: { bg: '#6b7280', label: 'ℹ️ Info' },
  unknown: { bg: '#374151', label: '? Unknown' }
};

function renderOverlayTags(items) {
  items.forEach((item) => {
    if (!item.classification || item.classification.manipulationMechanic === 'information') return;
    if (item.classification.manipulationIntensity < 0.3) return;

    const mechanic = item.classification.manipulationMechanic;
    const config = MECHANIC_COLORS[mechanic] || MECHANIC_COLORS.unknown;

    const selectors = {
      youtube: 'ytd-rich-item-renderer, ytd-compact-video-renderer',
      twitter: 'article[data-testid="tweet"]',
      reddit: 'div[data-testid="post-container"], shreddit-post'
    };

    const cards = document.querySelectorAll(selectors[item.platform] || selectors.youtube);
    const card = cards[item.feedPosition];
    if (!card || card.querySelector('.clarity-tag')) return;

    const tag = document.createElement('div');
    tag.className = 'clarity-tag';
    tag.style.backgroundColor = config.bg;
    tag.setAttribute('title', `Clarity: ${item.classification.reasoning || ''}`);
    tag.textContent = config.label;

    const intensity = Math.round(item.classification.manipulationIntensity * 100);
    const intensityDot = document.createElement('span');
    intensityDot.className = 'clarity-intensity';
    intensityDot.textContent = ` ${intensity}%`;
    tag.appendChild(intensityDot);

    if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
    card.appendChild(tag);
  });
}
