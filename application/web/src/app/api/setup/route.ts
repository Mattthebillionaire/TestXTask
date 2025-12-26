import { NextResponse } from 'next/server';
import { initializeSheets } from '@/lib/server/services/sheets.service';
import { handleApiError, validateCronSecret } from '@/lib/server/middleware/error-handler.middleware';

export async function POST(request: Request) {
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

    await initializeSheets();

    return NextResponse.json({
      success: true,
      data: { message: 'Sheets initialized successfully' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
