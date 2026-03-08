# Clairity

A browser extension that reverse-engineers what social media algorithms are optimizing you for. It observes what gets served to you, classifies each item with AI, and builds a personal manipulation profile.

## Features

- **Passive monitoring** — Runs silently on YouTube and Twitter/X, extracts feed metadata
- **AI classification** — Scores each item (outrage, fear, curiosity gap, etc.) via Anthropic or OpenAI API
- **Real-time overlay** — Color-coded tags on each feed item showing its manipulation mechanic
- **Manipulation score** — Badge shows 0–100 intensity (green → yellow → red)
- **Weekly dashboard** — Platform comparison, mechanic breakdown, drift over time

## Installation

1. **Load unpacked in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `Hacktj` folder

2. **Optional: Add API key for AI classification**
   - Click the extension icon → Settings
   - Add your [Anthropic](https://console.anthropic.com/) or [OpenAI](https://platform.openai.com/api-keys) API key
   - Without it, the extension uses heuristic fallbacks (less accurate)

## Usage

1. Browse **YouTube** or **X (Twitter)** normally
2. The extension scrapes visible feed items every 5 seconds
3. Each item is classified and stored locally
4. Click the extension icon for real-time score and stats
5. Open **Full Dashboard** for weekly profile, platform comparison, drift chart

## Supported platforms

- YouTube (home feed, search results, Shorts)
- Twitter / X (timeline, recommended)
- TikTok (For You feed)

## Tech stack

- Chrome Extension Manifest V3
- Content scripts for DOM scraping (no API access needed)
- Anthropic Claude or OpenAI GPT-4o-mini for classification
- `chrome.storage.local` for history (max 500 items)

## Project structure

```
Hacktj/
├── manifest.json
├── background/background.js    # Storage, API calls, badge
├── content/
│   ├── youtube-scraper.js
│   ├── twitter-scraper.js
│   ├── content-core.js         # Scraping loop, overlay
│   └── overlay.css
├── popup/
├── dashboard/
├── options/
├── shared/
└── icons/
```

## HackTJ 2026

Built for the invisible infrastructure theme — making algorithms visible.
