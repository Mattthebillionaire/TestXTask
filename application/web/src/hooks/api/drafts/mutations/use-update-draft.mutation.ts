import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { draftsKeys } from '../keys';
import { queueKeys } from '../../queue/keys';

interface UpdateDraftRequest {
  id: string;
  status: 'approved' | 'rejected';
}

interface UpdateDraftResponse {
  success: boolean;
  message: string;
}

export function useUpdateDraftMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateDraftRequest) =>
      apiClient.patch<UpdateDraftResponse>('/generate', {
        draftId: data.id,
        status: data.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: draftsKeys.all });
      queryClient.invalidateQueries({ queryKey: queueKeys.all });
    },
  });
}
