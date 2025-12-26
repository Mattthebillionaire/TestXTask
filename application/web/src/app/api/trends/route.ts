import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  discoverTrends,
  getTrendsFromSheet,
  saveTrendsToSheet,
} from '@/lib/server/services/discovery.service';
import { handleApiError, validateCronSecret } from '@/lib/server/middleware/error-handler.middleware';

const querySchema = z.object({
  woeid: z.coerce.number().optional().default(1),
  refresh: z.enum(['true', 'false']).optional().default('false'),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  latest: z.enum(['true', 'false']).optional().default('true'),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { woeid, refresh, limit, latest } = querySchema.parse(searchParams);

    if (refresh === 'true') {
      const isAuthorized = validateCronSecret(request);
      if (!isAuthorized) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'refresh=true requires Authorization header with CRON_SECRET',
              category: 'AUTH_ERROR',
              retryable: false,
            },
          },
          { status: 401 }
        );
      }

      const { trends, error } = await discoverTrends(woeid);

      if (error) {
        return NextResponse.json({
          success: true,
          data: {
            trends: [],
            source: 'api',
            warning: error,
          },
        });
      }

      const savedCount = await saveTrendsToSheet(trends);

      return NextResponse.json({
        success: true,
        data: {
          trends,
          source: 'api',
          count: trends.length,
          newlySaved: savedCount,
        },
      });
    }

    let trends = await getTrendsFromSheet(latest === 'true');
    const totalCount = trends.length;
    trends = trends.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        trends,
        source: 'sheet',
        count: trends.length,
        totalAvailable: totalCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
