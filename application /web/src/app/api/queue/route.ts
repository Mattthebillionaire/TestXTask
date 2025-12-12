import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getQueueFromSheet,
  getQueueStats,
  addToQueue,
  scheduleNextAvailable,
} from '@/lib/server/services/scheduler.service';
import { handleApiError, validateCronSecret } from '@/lib/server/middleware/error-handler.middleware';
import type { QueueItem } from '@/types/twitter.types';

const getQuerySchema = z.object({
  status: z.enum(['pending', 'posting', 'posted', 'failed']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  includeStats: z.enum(['true', 'false']).optional().default('false'),
});

const postBodySchema = z.object({
  draftId: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
  scheduleNext: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { status, limit, includeStats } = getQuerySchema.parse(searchParams);

    let queue = await getQueueFromSheet(status as QueueItem['status'] | undefined);

    const totalCount = queue.length;
    queue = queue.slice(0, limit);

    const response: Record<string, unknown> = {
      success: true,
      data: {
        queue,
        count: queue.length,
        totalAvailable: totalCount,
        filter: status || 'all',
      },
    };

    if (includeStats === 'true') {
      const stats = await getQueueStats();
      response.data = {
        ...response.data as object,
        stats,
      };
    }

    return NextResponse.json(response);
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
    const { draftId, scheduledAt, scheduleNext } = postBodySchema.parse(body);

    let queueItem;

    if (scheduleNext) {
      queueItem = await scheduleNextAvailable(draftId);
    } else {
      queueItem = await addToQueue({
        draftId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        queueItem,
        message: `Draft added to queue, scheduled for ${queueItem.scheduledAt.toISOString()}`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
