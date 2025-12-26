import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { trendsKeys } from '../keys';
import type { TrendingTopic } from '@/types/twitter.types';

interface TrendsResponse {
  success: boolean;
  data: {
    trends: TrendingTopic[];
    source: string;
  };
}

export function useTrendsQuery() {
  return useQuery({
    queryKey: trendsKeys.lists(),
    queryFn: () => apiClient.get<TrendsResponse>('/trends'),
    select: (data) => data.data.trends,
  });
}
