export const draftsKeys = {
  all: ['drafts'] as const,
  lists: () => [...draftsKeys.all, 'list'] as const,
  list: (filters: { status?: string }) =>
    [...draftsKeys.lists(), filters] as const,
  detail: (id: string) => [...draftsKeys.all, 'detail', id] as const,
};
