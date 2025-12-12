import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { publishKeys } from '../keys';
import { queueKeys } from '../../queue/keys';
import { draftsKeys } from '../../drafts/keys';

interface PublishRequest {
  draftId: string;
}

interface PublishResponse {
  success: boolean;
  data: {
    tweetId: string;
    content: string;
  };
}

export function usePublishMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PublishRequest) =>
      apiClient.post<PublishResponse>('/publish', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: publishKeys.all });
      queryClient.invalidateQueries({ queryKey: queueKeys.all });
      queryClient.invalidateQueries({ queryKey: draftsKeys.all });
    },
  });
}
