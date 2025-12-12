import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { queueKeys } from '../keys';
import type { QueueItem } from '@/types/twitter.types';

interface QueueResponse {
  success: boolean;
  data: {
    queue: QueueItem[];
    count: number;
    totalAvailable: number;
    filter: string;
    stats: {
      pending: number;
      posting: number;
      posted: number;
      failed: number;
      totalPostedToday: number;
      rateLimits: {
        canPost: boolean;
        tweetsIn24h: number;
        tweetsIn15min: number;
        remainingIn24h: number;
        remainingIn15min: number;
      };
    };
  };
}

export function useQueueQuery(status?: string) {
  return useQuery({
    queryKey: queueKeys.list({ status }),
    queryFn: () =>
      apiClient.get<QueueResponse>('/queue', {
        includeStats: 'true',
        ...(status ? { status } : {}),
      }),
    select: (data) => data.data,
  });
}
