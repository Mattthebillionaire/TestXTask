export const publishKeys = {
  all: ['publish'] as const,
  history: () => [...publishKeys.all, 'history'] as const,
};
