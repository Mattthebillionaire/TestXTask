export interface TrendsSheetRow {
  [key: string]: string;
  id: string;
  topic: string;
  keyword: string;
  tweet_count: string;
  woeid: string;
  fetched_at: string;
}

export interface ViralPostsSheetRow {
  [key: string]: string;
  id: string;
  tweet_id: string;
  author: string;
  content: string;
  likes: string;
  retweets: string;
  engagement_rate: string;
  structure_type: string;
  fetched_at: string;
}

export interface PatternsSheetRow {
  [key: string]: string;
  id: string;
  type: string;
  hook_template: string;
  cta_template: string;
  avg_length: string;
  emoji_density: string;
  example_id: string;
}

export interface DraftsSheetRow {
  [key: string]: string;
  id: string;
  content: string;
  based_on_pattern: string;
  based_on_trend: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface QueueSheetRow {
  [key: string]: string;
  id: string;
  draft_id: string;
  scheduled_at: string;
  status: string;
  retry_count: string;
  last_error: string;
  last_attempt_at: string;
}

export interface PostedSheetRow {
  [key: string]: string;
  id: string;
  tweet_id: string;
  content: string;
  posted_at: string;
  engagement_24h: string;
}

export const SHEET_NAMES = {
  TRENDS: 'Trends',
  VIRAL_POSTS: 'Viral_Posts',
  PATTERNS: 'Patterns',
  DRAFTS: 'Drafts',
  QUEUE: 'Queue',
  POSTED: 'Posted',
} as const;

export type SheetName = typeof SHEET_NAMES[keyof typeof SHEET_NAMES];
