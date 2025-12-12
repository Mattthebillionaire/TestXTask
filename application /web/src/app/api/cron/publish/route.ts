import { NextRequest, NextResponse } from 'next/server';
import { processQueue, getQueueStats } from '@/lib/server/services/scheduler.service';
import { handleApiError, validateCronSecret } from '@/lib/server/middleware/error-handler.middleware';

export async function GET(request: NextRequest) {
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

    const result = await processQueue();
    const stats = await getQueueStats();

    return NextResponse.json({
      success: true,
      data: {
        processed: result.processed,
        posted: result.posted,
        failed: result.failed,
        skipped: result.skipped,
        rateLimited: result.rateLimited,
        errors: result.errors,
        queueStats: stats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
