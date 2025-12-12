import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  generateContent,
  generateFromInspirationPosts,
  getDraftsFromSheet,
  updateDraftStatus,
  type GenerationConfig,
} from '@/lib/server/services/generation.service';
import { handleApiError, validateCronSecret } from '@/lib/server/middleware/error-handler.middleware';
import type { DraftPost } from '@/types/twitter.types';

const inspirationPostSchema = z.object({
  content: z.string(),
  metrics: z.object({
    likes: z.number(),
    retweets: z.number(),
  }),
  structure: z.string(),
  author: z.string(),
});

const postBodySchema = z.object({
  topic: z.string().min(1).max(200).optional(),
  trendId: z.string().optional(),
  patternId: z.string().optional(),
  inspirationPosts: z.array(inspirationPostSchema).optional(),
  structureType: z.enum([
    'hook_story',
    'list_format',
    'question_answer',
    'controversial_take',
    'thread_starter',
    'call_to_action',
    'educational',
    'humor',
  ]).optional(),
  variantCount: z.number().min(1).max(10).optional().default(5),
  count: z.number().min(1).max(10).optional(),
  tone: z.string().max(100).optional(),
  emojiDensity: z.enum(['none', 'low', 'medium', 'high']).optional(),
  autoApprove: z.boolean().optional().default(false),
});

const getQuerySchema = z.object({
  status: z.enum(['draft', 'approved', 'rejected', 'posted']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

const patchBodySchema = z.object({
  draftId: z.string().min(1),
  status: z.enum(['draft', 'approved', 'rejected', 'posted']),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { status, limit } = getQuerySchema.parse(searchParams);

    let drafts = await getDraftsFromSheet(status as DraftPost['status'] | undefined);

    const totalCount = drafts.length;
    drafts = drafts.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        drafts,
        count: drafts.length,
        totalAvailable: totalCount,
        filter: status || 'all',
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

    const config = postBodySchema.parse(body);

    if (config.inspirationPosts && config.inspirationPosts.length > 0) {
      const count = config.count || config.variantCount || Math.min(config.inspirationPosts.length * 2, 6);
      const result = await generateFromInspirationPosts(config.inspirationPosts, count);

      return NextResponse.json({
        success: true,
        data: {
          draftsGenerated: result.drafts.length,
          drafts: result.drafts,
          filtered: result.filtered,
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!config.topic && !config.trendId && !config.patternId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Provide inspirationPosts array or at least one of topic, trendId, patternId',
            category: 'VALIDATION_ERROR',
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const result = await generateContent(config as GenerationConfig);

    return NextResponse.json({
      success: true,
      data: {
        draftsGenerated: result.drafts.length,
        drafts: result.drafts,
        filtered: result.filtered,
        pattern: result.pattern ? {
          id: result.pattern.id,
          type: result.pattern.type,
          hookTemplate: result.pattern.hookTemplate,
        } : null,
        trend: result.trend ? {
          id: result.trend.id,
          topic: result.trend.topic,
        } : null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
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
    const { draftId, status } = patchBodySchema.parse(body);

    const updated = await updateDraftStatus(draftId, status);

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Draft not found: ${draftId}`,
            category: 'VALIDATION_ERROR',
            retryable: false,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        draftId,
        status,
        message: `Draft status updated to ${status}`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
