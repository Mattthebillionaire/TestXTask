import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError, ErrorCategory } from '@/types/common.types';
import { RETRY_CONFIG } from '@/constants/rate-limits.constants';
import { TwitterApiTierError } from '@/lib/server/services/twitter.service';

export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof ZodError) {
    return 'VALIDATION_ERROR';
  }

  if (error instanceof TwitterApiTierError) {
    return 'AUTH_ERROR';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'RATE_LIMIT';
    }

    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('authentication') ||
      message.includes('invalid token')
    ) {
      return 'AUTH_ERROR';
    }

    if (
      message.includes('duplicate content') ||
      message.includes('content policy') ||
      message.includes('character limit')
    ) {
      return 'CONTENT_ERROR';
    }

    if (
      name.includes('fetch') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('timeout')
    ) {
      return 'NETWORK_ERROR';
    }
  }

  return 'UNKNOWN_ERROR';
}

export function isRetryable(category: ErrorCategory, statusCode?: number): boolean {
  if (statusCode && RETRY_CONFIG.retryableCodes.includes(statusCode as 429 | 500 | 503)) {
    return true;
  }

  return category === 'RATE_LIMIT' || category === 'NETWORK_ERROR';
}

export function createApiError(
  error: unknown,
  statusCode?: number
): ApiError {
  const category = classifyError(error);

  if (error instanceof ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      category,
      retryable: false,
      details: { errors: error.flatten().fieldErrors },
    };
  }

  if (error instanceof TwitterApiTierError) {
    return {
      code: 'API_TIER_ERROR',
      message: error.message,
      category,
      retryable: false,
    };
  }

  if (error instanceof Error) {
    return {
      code: category,
      message: error.message,
      category,
      retryable: isRetryable(category, statusCode),
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    category: 'UNKNOWN_ERROR',
    retryable: false,
  };
}

export function getStatusCode(category: ErrorCategory, error?: unknown): number {
  if (error instanceof TwitterApiTierError) {
    return 403;
  }

  switch (category) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'AUTH_ERROR':
      return 401;
    case 'RATE_LIMIT':
      return 429;
    case 'CONTENT_ERROR':
      return 422;
    case 'NETWORK_ERROR':
      return 502;
    default:
      return 500;
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  const apiError = createApiError(error);
  const statusCode = getStatusCode(apiError.category, error);

  return NextResponse.json(
    {
      success: false,
      error: apiError,
    },
    { status: statusCode }
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    onRetry?: (attempt: number, error: Error) => void;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? RETRY_CONFIG.maxRetries;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const category = classifyError(error);

      if (!isRetryable(category)) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw error;
      }

      const backoffMs = RETRY_CONFIG.backoffMs[attempt] || RETRY_CONFIG.backoffMs[RETRY_CONFIG.backoffMs.length - 1];

      options?.onRetry?.(attempt + 1, lastError);

      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError || new Error('Retry failed');
}

export function validateCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    console.warn('CRON_SECRET not configured - rejecting request');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export function withErrorHandling<T>(
  handler: (request: Request) => Promise<NextResponse<T>>
) {
  return async (request: Request): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
