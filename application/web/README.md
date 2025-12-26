# X Content Engine - Web App

Next.js dashboard for managing viral content creation workflow.

## Features

### Create Page (`/dashboard/create`)

The main workflow page combining scraping, generation, and draft management.

**Flow:**
```
Search → Scrape → Select → Generate → Review → Post
```

1. **Search**: Enter keyword to find viral posts on X
2. **Scrape**: Extension automatically opens X.com and extracts posts
3. **Select**: Click posts to use as AI inspiration (checkbox selection)
4. **Generate**: AI creates new content matching the style of selected posts
5. **Review**: Approve or reject generated drafts
6. **Post**: Schedule for later or post immediately

### AI Generation

The AI analyzes selected viral posts and generates new content that:
- Matches the exact writing style (casual, news-style, sarcastic, etc.)
- Stays on the same topic with specific names/references
- Uses similar hooks and structure
- Feels authentic, not generic

**Example:**
- Input: Casual observation about Squid Game and media literacy
- Output: Similar casual take about Squid Game, not "BREAKING: a series about..."

### Draft Management

| Status | Description |
|--------|-------------|
| Pending | Newly generated, awaiting review |
| Approved | Ready to schedule or post |
| Rejected | Discarded content |
| Posted | Published to X |

### Dashboard (`/dashboard`)

Overview showing:
- Total drafts count
- Pending drafts awaiting review
- Queue status
- Posted today count
- Rate limit status

### Queue (`/dashboard/queue`)

Scheduled posts waiting to be published.

### History (`/dashboard/history`)

Archive of all posted content.

## Extension Integration

The web app communicates with the Chrome extension via custom events:

```
Web App                          Extension
   │                                │
   │── x-scraper-start ────────────▶│ (triggers scraping)
   │                                │
   │◀── x-scraper-state ────────────│ (progress updates)
   │                                │
   │◀── x-scraper-stopped ──────────│ (results)
```

**Detection:** The app checks for `window.__X_SCRAPER_READY__` to verify extension is installed.

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/generate` | POST | Generate drafts from inspiration posts |
| `/api/generate` | GET | Get drafts by status |
| `/api/generate` | PATCH | Update draft status |
| `/api/publish` | POST | Publish a draft to X |
| `/api/queue` | GET | Get queue status and items |
| `/api/queue` | POST | Add draft to queue |

## Setup

### Environment Variables

Create `.env` file:

```env
# Required
OPENAI_API_KEY=sk-...
CRON_SECRET=your_secret_key

# Google Sheets (for storage)
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_SHEET_ID=...

# Twitter API (for posting)
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...
```

### Development

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000

### Build

```bash
npm run build
npm run start
```

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       ├── create/       # Main workflow page
│   │       ├── queue/        # Scheduled posts
│   │       ├── history/      # Posted content
│   │       └── settings/     # Configuration
│   └── api/
│       ├── generate/         # AI generation endpoint
│       ├── publish/          # Twitter posting
│       └── queue/            # Queue management
├── hooks/
│   ├── use-x-scraper.ts      # Extension communication
│   └── api/                  # React Query hooks
├── lib/
│   └── server/
│       └── services/
│           ├── openai.service.ts      # AI generation
│           ├── generation.service.ts  # Draft management
│           └── twitter.service.ts     # Twitter API
└── components/
    ├── ui/                   # Base components
    └── features/             # Feature components
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State**: TanStack React Query + Zustand
- **UI**: Radix UI primitives
- **AI**: OpenAI GPT-4o-mini
