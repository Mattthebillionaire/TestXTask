import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { trendsKeys } from '../keys';
import type { ViralPost } from '@/types/twitter.types';

interface ViralPostsResponse {
  success: boolean;
  data: {
    posts: ViralPost[];
    keyword: string;
    source: string;
  };
}

export function useViralPostsQuery(keyword: string) {
  return useQuery({
    queryKey: trendsKeys.viralByKeyword(keyword),
    queryFn: () =>
      apiClient.get<ViralPostsResponse>('/tweets/viral', { keyword }),
    select: (data) => data.data.posts,
    enabled: !!keyword,
  });
}
