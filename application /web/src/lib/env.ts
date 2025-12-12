import { z } from 'zod';

const envSchema = z.object({
  TWITTER_API_KEY: z.string().min(1, 'TWITTER_API_KEY is required'),
  TWITTER_API_SECRET: z.string().min(1, 'TWITTER_API_SECRET is required'),
  TWITTER_ACCESS_TOKEN: z.string().min(1, 'TWITTER_ACCESS_TOKEN is required'),
  TWITTER_ACCESS_TOKEN_SECRET: z.string().min(1, 'TWITTER_ACCESS_TOKEN_SECRET is required'),
  TWITTER_BEARER_TOKEN: z.string().min(1, 'TWITTER_BEARER_TOKEN is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email('Invalid GOOGLE_SERVICE_ACCOUNT_EMAIL'),
  GOOGLE_PRIVATE_KEY: z.string().min(1, 'GOOGLE_PRIVATE_KEY is required'),
  GOOGLE_SHEET_ID: z.string().min(1, 'GOOGLE_SHEET_ID is required'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  CRON_SECRET: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

export function getPublicEnv() {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  };
}
