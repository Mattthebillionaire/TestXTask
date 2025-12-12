# X Content Engine

A viral content creation system that scrapes high-performing posts from X (Twitter) and generates AI-inspired content based on their patterns.

## Overview

This project solves the problem of creating engaging social media content by:
1. **Scraping viral posts** from X using a Chrome extension (bypasses API rate limits)
2. **Analyzing patterns** that make content successful (hooks, structure, tone)
3. **Generating new content** inspired by those patterns using AI
4. **Managing drafts** through approval workflow and scheduling

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Chrome        │     │   Next.js       │     │   OpenAI        │
│   Extension     │────▶│   Web App       │────▶│   API           │
│                 │     │                 │     │                 │
│ Scrapes X.com   │     │ Manages flow    │     │ Generates       │
│ Extracts posts  │     │ Shows UI        │     │ content         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Flow

1. **Search** - Enter a keyword in the web app (e.g., "AI", "startups")
2. **Scrape** - Extension opens X.com, searches, scrolls, and extracts viral posts
3. **Select** - Choose which posts to use as inspiration
4. **Generate** - AI analyzes patterns and creates new content in the same style
5. **Review** - Approve, reject, schedule, or post immediately

## Project Structure

```
x-posting-app/
├── apps/
│   ├── web/              # Next.js dashboard (port 3000)
│   └── extension/        # Chrome extension for X scraping
├── package.json          # Monorepo root
└── README.md
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
cd apps/extension/app && npm install
```

### 2. Setup Environment

Create `apps/web/.env`:
```env
OPENAI_API_KEY=your_openai_key
CRON_SECRET=your_secret_for_api_auth
```

### 3. Start Web App

```bash
npm run dev
```

### 4. Load Chrome Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `apps/extension/` folder

### 5. Use the App

1. Go to `http://localhost:3000/dashboard/create`
2. Enter a search term and click "Search"
3. Extension will scrape viral posts from X
4. Select posts and click "Generate"
5. Review and approve generated drafts

## Features

### Extension
- Scrapes X.com search results without API limits
- Prioritizes text-heavy posts (filters short/media-only content)
- Extracts metrics (likes, retweets, views)
- Classifies tweet structure (educational, controversial, list, etc.)

### Web App
- Real-time scraping progress
- Post selection for AI inspiration
- AI content generation matching source style
- Draft management (pending, approved, rejected, posted)
- Queue scheduling and direct posting

## Tech Stack

| Component | Technology |
|-----------|------------|
| Web App | Next.js 15, React 19, TypeScript, Tailwind CSS |
| State | TanStack Query, Zustand |
| Extension | Chrome Manifest V3, Vanilla JS |
| AI | OpenAI GPT-4o-mini |
| Storage | Google Sheets (as database) |

## Documentation

- [Web App Documentation](apps/web/README.md)
- [Extension Documentation](apps/extension/README.md)
