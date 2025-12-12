export const trendsKeys = {
  all: ['trends'] as const,
  lists: () => [...trendsKeys.all, 'list'] as const,
  viral: () => [...trendsKeys.all, 'viral'] as const,
  viralByKeyword: (keyword: string) =>
    [...trendsKeys.viral(), keyword] as const,
};
