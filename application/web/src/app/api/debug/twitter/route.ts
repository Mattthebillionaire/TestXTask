import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { TwitterApi } from 'twitter-api-v2';

export async function GET() {
  try {
    const env = getEnv();
    const client = new TwitterApi(env.TWITTER_BEARER_TOKEN);

    const results: Record<string, unknown> = {};

    results.step1_search = 'checking...';
    try {
      const search = await client.v2.search('startup -is:retweet lang:en', {
        max_results: 10,
        'tweet.fields': ['public_metrics', 'author_id'],
        'user.fields': ['username'],
        expansions: ['author_id'],
      });
      results.step1_search = {
        success: true,
        count: search.tweets?.length ?? 0,
        meta: search.meta,
        tweets: search.tweets?.slice(0, 3).map(t => ({
          id: t.id,
          text: t.text.slice(0, 100),
          metrics: t.public_metrics,
        })),
        rateLimit: search.rateLimit,
      };
    } catch (e: unknown) {
      const error = e as { message?: string; code?: number; data?: unknown };
      results.step1_search = {
        success: false,
        error: error.message,
        code: error.code,
        data: error.data,
      };
    }

    results.step2_trends = 'checking...';
    try {
      const trends = await client.v1.trendsByPlace(1);
      results.step2_trends = {
        success: true,
        count: trends[0]?.trends?.length ?? 0,
        sample: trends[0]?.trends?.slice(0, 5),
      };
    } catch (e: unknown) {
      const error = e as { message?: string; code?: number; data?: unknown };
      results.step2_trends = {
        success: false,
        error: error.message,
        code: error.code,
        data: error.data,
      };
    }

    return NextResponse.json({ success: true, debug: results });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
