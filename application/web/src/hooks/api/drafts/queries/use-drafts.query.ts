import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { draftsKeys } from '../keys';
import type { DraftPost } from '@/types/twitter.types';

interface DraftsResponse {
  success: boolean;
  data: {
    drafts: DraftPost[];
  };
}

export function useDraftsQuery(status?: string) {
  return useQuery({
    queryKey: draftsKeys.list({ status }),
    queryFn: () =>
      apiClient.get<DraftsResponse>('/generate', status ? { status } : undefined),
    select: (data) => data.data.drafts,
  });
}
