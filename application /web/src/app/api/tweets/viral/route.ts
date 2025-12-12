import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  searchViralByKeyword,
  getViralPostsFromSheet,
  saveViralPostsToSheet,
} from '@/lib/server/services/discovery.service';
import { handleApiError, validateCronSecret } from '@/lib/server/middleware/error-handler.middleware';

const querySchema = z.object({
  keyword: z.string().optional(),
  maxResults: z.coerce.number().min(1).max(100).optional().default(50),
  refresh: z.enum(['true', 'false']).optional().default('false'),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { keyword, maxResults, refresh, limit } = querySchema.parse(searchParams);

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

      if (!keyword) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'keyword is required when refresh=true',
              category: 'VALIDATION_ERROR',
              retryable: false,
            },
          },
          { status: 400 }
        );
      }

      const posts = await searchViralByKeyword(keyword, maxResults);
      const savedCount = await saveViralPostsToSheet(posts);

      return NextResponse.json({
        success: true,
        data: {
          posts,
          source: 'api',
          count: posts.length,
          newlySaved: savedCount,
        },
      });
    }

    if (keyword) {
      try {
        const livePosts = await searchViralByKeyword(keyword, maxResults);

        if (livePosts.length > 0) {
          await saveViralPostsToSheet(livePosts);
        }

        return NextResponse.json({
          success: true,
          data: {
            posts: livePosts.slice(0, limit),
            keyword,
            source: 'api',
            count: livePosts.length,
          },
        });
      } catch (error) {
        const cachedPosts = await getViralPostsFromSheet();
        const filteredPosts = cachedPosts.filter(post =>
          post.content.toLowerCase().includes(keyword.toLowerCase())
        );

        return NextResponse.json({
          success: true,
          data: {
            posts: filteredPosts.slice(0, limit),
            keyword,
            source: 'cache',
            count: filteredPosts.length,
            warning: error instanceof Error ? error.message : 'Search failed, showing cached results',
          },
        });
      }
    }

    const posts = await getViralPostsFromSheet();

    return NextResponse.json({
      success: true,
      data: {
        posts: posts.slice(0, limit),
        source: 'sheet',
        count: posts.length,
        totalAvailable: posts.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
