import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { TwitterApi } from 'twitter-api-v2';

export async function GET() {
  try {
    const env = getEnv();

    const client = new TwitterApi({
      appKey: env.TWITTER_API_KEY,
      appSecret: env.TWITTER_API_SECRET,
      accessToken: env.TWITTER_ACCESS_TOKEN,
      accessSecret: env.TWITTER_ACCESS_TOKEN_SECRET,
    });

    const result: Record<string, unknown> = {};

    result.step1_verify = 'checking credentials...';
    try {
      const me = await client.v2.me();
      result.step1_verify = {
        success: true,
        user: me.data,
      };
    } catch (e: unknown) {
      const error = e as { message?: string; code?: number; data?: unknown };
      result.step1_verify = {
        success: false,
        error: error.message,
        code: error.code,
        data: error.data,
      };
    }

    result.step2_post = 'attempting test tweet...';
    try {
      const tweet = await client.v2.tweet(`Test post from X Content Engine - ${Date.now()}`);
      result.step2_post = {
        success: true,
        tweetId: tweet.data.id,
        message: 'Tweet posted successfully! You can delete it manually.',
      };
    } catch (e: unknown) {
      const error = e as { message?: string; code?: number; data?: unknown; errors?: unknown };
      result.step2_post = {
        success: false,
        error: error.message,
        code: error.code,
        data: error.data,
        errors: error.errors,
      };
    }

    return NextResponse.json({ success: true, debug: result });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
