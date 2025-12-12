import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  runPatternAnalysis,
  getPatternsFromSheet,
  getPatternsByType,
} from '@/lib/server/services/discovery.service';
import { handleApiError, validateCronSecret } from '@/lib/server/middleware/error-handler.middleware';
import type { TweetStructureType } from '@/types/twitter.types';

const postBodySchema = z.object({
  maxPatternsPerType: z.number().min(1).max(10).optional().default(3),
  recencyHours: z.number().min(1).max(720).optional(),
});

const getQuerySchema = z.object({
  type: z.enum([
    'hook_story',
    'list_format',
    'question_answer',
    'controversial_take',
    'thread_starter',
    'call_to_action',
    'educational',
    'humor',
    'unknown',
  ]).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { type, limit } = getQuerySchema.parse(searchParams);

    let patterns;
    if (type) {
      patterns = await getPatternsByType(type as TweetStructureType);
    } else {
      patterns = await getPatternsFromSheet();
    }

    const totalCount = patterns.length;
    patterns = patterns.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        patterns,
        count: patterns.length,
        totalAvailable: totalCount,
        filter: type || 'all',
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

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { maxPatternsPerType, recencyHours } = postBodySchema.parse(body);
    const result = await runPatternAnalysis({ maxPatternsPerType, recencyHours });

    return NextResponse.json({
      success: true,
      data: {
        totalPostsAnalyzed: result.totalPostsAnalyzed,
        patternsExtracted: result.patternsExtracted,
        patternsByType: result.patternsByType,
        patterns: result.patterns,
        recencyHours: recencyHours || 72,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
