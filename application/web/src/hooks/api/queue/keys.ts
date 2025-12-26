export const queueKeys = {
  all: ['queue'] as const,
  lists: () => [...queueKeys.all, 'list'] as const,
  list: (filters: { status?: string }) =>
    [...queueKeys.lists(), filters] as const,
  stats: () => [...queueKeys.all, 'stats'] as const,
};
