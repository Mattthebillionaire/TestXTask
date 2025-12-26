import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { draftsKeys } from '../keys';
import type { DraftPost } from '@/types/twitter.types';

interface InspirationPost {
  content: string;
  metrics: { likes: number; retweets: number };
  structure: string;
  author: string;
}

interface GenerateDraftsRequest {
  trendId?: string;
  patternId?: string;
  topic?: string;
  inspirationPosts?: InspirationPost[];
  count?: number;
}

interface GenerateDraftsResponse {
  success: boolean;
  data: {
    drafts: DraftPost[];
    draftsGenerated: number;
  };
}

export function useGenerateDraftsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateDraftsRequest) =>
      apiClient.post<GenerateDraftsResponse>('/generate', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: draftsKeys.all });
    },
  });
}
