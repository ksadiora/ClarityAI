# Clairity

A browser extension that reverse-engineers what social media algorithms are optimizing you for. It observes what gets served to you, classifies each item with AI, and builds a personal manipulation profile.

## Impact

Most people have no idea how much of their feed is chosen by algorithms (vs. people they follow) or how much of it is optimized for engagement rather than genuine value. Clairity makes that invisible infrastructure visible: you see at a glance what share of what you see is algorithm-driven, how manipulative your feed is (0–100), and how it changes over time. When your feed leans toward manipulation, Clairity suggests calmer alternatives and concrete tips to take back control. Built for HackTJ 2026’s **invisible infrastructure** theme — making the algorithms that shape our attention visible and actionable.

- **One number that matters:** The dashboard shows “X% of what you see is chosen by the algorithm” so you can see how much of your feed is truly from people you follow.

## Features

- **Passive monitoring** — Runs silently on YouTube and Twitter/X, extracts feed metadata
- **AI classification** — Scores each item (outrage, fear, curiosity gap, etc.) via Gemini API
- **Real-time overlay** — Color-coded tags on each feed item showing its manipulation mechanic
- **Manipulation score** — Badge shows 0–100 intensity (green → yellow → red)
- **Weekly dashboard** — Platform comparison, mechanic breakdown, drift over time

## Installation

1. **Load unpacked in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `HackTJ13` folder (or this project's root folder)

2. **Optional: Add API key for AI classification**
   - Click the extension icon → Settings
   - Add your [Google AI (Gemini)](https://aistudio.google.com/apikey) API key
   - Without it, the extension uses heuristic fallbacks (less accurate)
   - The key is saved locally and persists across reloads — you don't need to re-enter it when you reload the extension.

## Usage

1. Browse **YouTube**, **X (Twitter)**, or **TikTok** normally
2. The extension scrapes visible feed items every 5 seconds
3. Each item is classified and stored locally
4. Click the extension icon for real-time score and stats
5. Open **Full Dashboard** for weekly profile, platform comparison, drift chart

**Demo:** To show a full profile without browsing, open the dashboard and add `?demo=1` to the URL (e.g. `.../dashboard/dashboard.html?demo=1`).

## Supported platforms

- YouTube (home feed, search results, Shorts)
- Twitter / X (timeline, recommended)
- TikTok (For You feed)

## Tech stack

- Chrome Extension Manifest V3
- Content scripts for DOM scraping (no API access needed)
- Gemini API for classification
- `chrome.storage.local` for history (max 500 items)

**Privacy:** Your data stays on your device; only the AI provider (e.g. Google) sees content when you add an API key.

## Project structure

```
HackTJ13/
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
