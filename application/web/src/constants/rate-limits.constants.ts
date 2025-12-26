export const RATE_LIMITS = {
  TWEETS_PER_24H: 50,
  TWEETS_PER_15MIN: 5,
  API_CALLS_PER_15MIN: 450,
  OPENAI_RPM: 60,
} as const;

export const RETRY_CONFIG = {
  maxRetries: 3,
  backoffMs: [1000, 5000, 30000] as const,
  retryableCodes: [429, 500, 503] as const,
} as const;

export const CRON_INTERVALS = {
  DISCOVERY_HOURS: 4,
  PUBLISH_MINUTES: 30,
} as const;

export const CONTENT_LIMITS = {
  MAX_TWEET_LENGTH: 280,
  AI_VARIANTS_COUNT: 5,
  MIN_VIRAL_ENGAGEMENT_RATE: 0.05,
} as const;

export type RateLimits = typeof RATE_LIMITS;
export type RetryConfig = typeof RETRY_CONFIG;
