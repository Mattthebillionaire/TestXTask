# X Content Scraper - Chrome Extension

Chrome extension that scrapes viral posts from X (Twitter) for the Content Engine web app.

## Purpose

The Twitter/X API has strict rate limits and paid tiers. This extension bypasses those limitations by scraping directly from the X.com interface, allowing unlimited collection of viral posts for content analysis.

## How It Works

### Scraping Flow

```
Web App triggers search
        │
        ▼
Extension opens x.com/explore
        │
        ▼
Types search query into search box
        │
        ▼
Navigates to search results
        │
        ▼
Scrolls page and extracts posts
        │
        ▼
Filters and scores posts
        │
        ▼
Returns results to web app
```

### Communication with Web App

The extension uses a bridge script (`webapp-bridge.js`) that runs on localhost:3000 to communicate with the web app via custom events:

| Event | Direction | Purpose |
|-------|-----------|---------|
| `x-scraper-start` | Web → Extension | Start scraping with query |
| `x-scraper-state` | Extension → Web | Progress updates |
| `x-scraper-stopped` | Extension → Web | Final results |
| `x-scraper-ready` | Extension → Web | Extension loaded signal |

## Features

### Text Prioritization

The extension prioritizes text-heavy posts over media-only content:

- **Minimum text**: Posts with < 50 characters are skipped
- **Text score**: Each post gets a score based on:
  - Content length (base score)
  - +50 if no media (text-only)
  - +30 if content > 150 characters
  - +20 if multi-line
- **Sorting**: Results sorted by text score (highest first)

**Why?** AI needs text content to analyze patterns. Posts that are mostly images/videos with captions like "Yes or No?" provide little value for content generation.

### Data Extraction

For each post, the extension extracts:

| Field | Description |
|-------|-------------|
| `id` | Tweet ID |
| `content` | Full text content |
| `author` | Handle and display name |
| `metrics` | Likes, retweets, replies, views |
| `hasMedia` | Whether post has image/video |
| `mediaType` | text, image, video, or link |
| `structure` | Classified type (educational, list, controversial, etc.) |
| `url` | Direct link to tweet |

### Structure Classification

Posts are automatically classified by structure:

| Type | Detection |
|------|-----------|
| `list_format` | Numbered or bulleted items |
| `question_answer` | Contains question mark with multiple lines |
| `thread_starter` | Contains "Thread" or "1/" |
| `hook_story` | Short first line followed by more content |
| `controversial_take` | "Unpopular opinion", "Hot take" |
| `educational` | "How to", "Quick tip", "Learn" |
| `call_to_action` | "Link in bio", "Sign up" |
| `general` | Default |

## Setup

### 1. Build Popup UI

```bash
cd apps/extension/app
npm install
npm run build
```

### 2. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `apps/extension/` folder

### 3. Verify Installation

- Extension icon should appear in Chrome toolbar
- Click icon to see popup (shows "Waiting for search...")
- Go to http://localhost:3000/dashboard/create
- You should see search input (not "Extension not detected")

## Development

### Watch Mode

```bash
cd apps/extension/app
npm run watch
```

### Reload Extension

After code changes:
1. Go to `chrome://extensions/`
2. Click refresh icon on the extension card

### Debug

- **Popup console**: Right-click extension icon → Inspect popup
- **Background script**: chrome://extensions → extension details → Inspect service worker
- **Content script**: Open DevTools on x.com → Console (filter by extension)

## File Structure

```
extension/
├── manifest.json           # Extension configuration
├── background.js           # Service worker (tab management, storage)
├── webapp-bridge.js        # Runs on localhost:3000 for communication
├── content-loader.js       # Loads content scripts on x.com
├── popup.html/css          # Extension popup UI shell
├── src/
│   ├── content-script.js   # Entry point for x.com
│   ├── manager.js          # Feature orchestrator
│   └── features/
│       ├── base.js         # Base class with utilities
│       └── x-scraper.js    # Main scraping logic
├── app/                    # React popup (MUI)
│   ├── src/
│   │   └── components/
│   │       └── XScraperPopup.js
│   └── webpack.config.js
└── build/
    └── popup.bundle.js     # Built popup
```

## Permissions

The extension requires:

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access current tab |
| `scripting` | Inject content scripts |
| `storage` | Save scraping state |
| `tabs` | Open/manage X.com tabs |
| Host: `x.com`, `twitter.com` | Run scripts on X |
| Host: `localhost:3000` | Communicate with web app |

## Troubleshooting

### "Extension not detected" in web app

1. Check extension is loaded in chrome://extensions
2. Reload the extension
3. Refresh the web app page
4. Check console for errors

### Scraping doesn't start

1. Make sure you're logged into X.com
2. Check popup for error messages
3. Look at background script console for errors

### Posts not extracting

X.com may have changed their DOM structure. Check:
1. Content script console for errors
2. Verify selectors in `x-scraper.js` match current X.com HTML
