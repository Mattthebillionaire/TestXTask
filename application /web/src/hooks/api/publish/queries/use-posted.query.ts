import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { publishKeys } from '../keys';
import type { PostedTweet } from '@/types/twitter.types';
import type { RateLimitStatus } from '@/lib/server/services/scheduler.service';

interface PostedResponse {
  success: boolean;
  data: {
    postedTweets: PostedTweet[];
    count: number;
    totalAvailable: number;
    rateLimits: RateLimitStatus;
  };
}

export function usePostedQuery() {
  return useQuery({
    queryKey: publishKeys.history(),
    queryFn: () => apiClient.get<PostedResponse>('/publish'),
    select: (data) => data.data.postedTweets,
  });
}
