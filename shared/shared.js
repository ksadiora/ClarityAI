// Shared constants and utilities - loaded as first script
const MANIPULATION_AUDITOR = {
  CATEGORIES: {
    OUTRAGE: 'outrage',
    FEAR: 'fear',
    SOCIAL_COMPARISON: 'social_comparison',
    HUMOR: 'humor',
    INSPIRATION: 'inspiration',
    CONTROVERSY: 'controversy',
    CURIOSITY_GAP: 'curiosity_gap',
    TRIBAL_IDENTITY: 'tribal_identity',
    NEUTRAL: 'neutral',
    AD: 'ad',
  },
  STORAGE_KEYS: {
    CONTENT_HISTORY: 'manipulation_auditor_content_history',
    SETTINGS: 'manipulation_auditor_settings',
    LAST_WEEKLY_REPORT: 'manipulation_auditor_last_weekly',
  },
  CATEGORY_COLORS: {
    outrage: '#ef4444',
    fear: '#dc2626',
    social_comparison: '#f97316',
    humor: '#22c55e',
    inspiration: '#3b82f6',
    controversy: '#a855f7',
    curiosity_gap: '#eab308',
    tribal_identity: '#ec4899',
    neutral: '#6b7280',
    ad: '#14b8a6',
  },
  getClassificationPrompt: (content) => `Analyze this social media content for algorithmic manipulation. Return ONLY valid JSON, no other text.

Content to analyze:
---
${content.substring(0, 1500)}
---

Respond with this exact JSON structure:
{
  "emotional_valence": "positive" | "neutral" | "negative" | "provocative",
  "manipulation_mechanic": "outrage" | "fear" | "social_comparison" | "humor" | "inspiration" | "controversy" | "curiosity_gap" | "tribal_identity" | "neutral" | "ad",
  "urgency_signals": true | false,
  "manipulation_intensity": 0-100,
  "reasoning": "one sentence"
}`,
};
