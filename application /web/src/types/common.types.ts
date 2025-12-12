export type ErrorCategory =
  | 'RATE_LIMIT'
  | 'AUTH_ERROR'
  | 'CONTENT_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  category: ErrorCategory;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export type QueueStatus = 'pending' | 'posting' | 'posted' | 'failed';
export type DraftStatus = 'draft' | 'approved' | 'rejected' | 'posted';

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}
