import { NextRequest, NextResponse } from 'next/server';
import { runDiscovery } from '@/lib/server/services/discovery.service';
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

    const keywordsParam = request.nextUrl.searchParams.get('keywords');
    const keywords = keywordsParam ? keywordsParam.split(',').map(k => k.trim()) : undefined;

    const result = await runDiscovery({ keywords });

    return NextResponse.json({
      success: true,
      data: {
        trendsFound: result.trends.length,
        viralPostsFound: result.viralPosts.length,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
