import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  publishDraft,
  checkRateLimits,
  getPostedTweetsFromSheet,
} from '@/lib/server/services/scheduler.service';
import { handleApiError, validateCronSecret } from '@/lib/server/middleware/error-handler.middleware';

const postBodySchema = z.object({
  draftId: z.string().min(1),
});

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { limit } = getQuerySchema.parse(searchParams);

    const [postedTweets, rateLimits] = await Promise.all([
      getPostedTweetsFromSheet(),
      checkRateLimits(),
    ]);

    const limitedTweets = postedTweets.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        postedTweets: limitedTweets,
        count: limitedTweets.length,
        totalAvailable: postedTweets.length,
        rateLimits,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAuthorized = validateCronSecret(request);
    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or missing CRON_SECRET',
            category: 'AUTH_ERROR',
            retryable: false,
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { draftId } = postBodySchema.parse(body);

    const result = await publishDraft(draftId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PUBLISH_FAILED',
            message: result.error,
            category: 'CONTENT_ERROR',
            retryable: true,
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tweetId: result.tweetId,
        message: 'Tweet published successfully',
        tweetUrl: `https://twitter.com/i/web/status/${result.tweetId}`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
