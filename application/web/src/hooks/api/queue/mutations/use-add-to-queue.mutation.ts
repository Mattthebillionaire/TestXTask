import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { queueKeys } from '../keys';
import type { QueueItem } from '@/types/twitter.types';

interface AddToQueueRequest {
  draftId: string;
  scheduledAt?: string;
}

interface AddToQueueResponse {
  success: boolean;
  data: QueueItem;
}

export function useAddToQueueMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddToQueueRequest) =>
      apiClient.post<AddToQueueResponse>('/queue', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queueKeys.all });
    },
  });
}
