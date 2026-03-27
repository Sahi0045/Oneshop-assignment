export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

export enum ApiErrorCode {
  // Auth
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_MISSING = 'TOKEN_MISSING',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  ACCOUNT_NOT_VERIFIED = 'ACCOUNT_NOT_VERIFIED',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  PASSWORD_MISMATCH = 'PASSWORD_MISMATCH',

  // Resources
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_FORBIDDEN = 'RESOURCE_FORBIDDEN',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Payment
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  PAYMENT_GATEWAY_ERROR = 'PAYMENT_GATEWAY_ERROR',

  // Business Logic
  BID_ALREADY_PLACED = 'BID_ALREADY_PLACED',
  BID_NOT_ACCEPTED = 'BID_NOT_ACCEPTED',
  PROJECT_NOT_OPEN = 'PROJECT_NOT_OPEN',
  CONTRACT_ALREADY_EXISTS = 'CONTRACT_ALREADY_EXISTS',
  MILESTONE_INVALID_STATE = 'MILESTONE_INVALID_STATE',
  REVIEW_ALREADY_SUBMITTED = 'REVIEW_ALREADY_SUBMITTED',
  DISPUTE_ALREADY_OPEN = 'DISPUTE_ALREADY_OPEN',
  SELF_ACTION_FORBIDDEN = 'SELF_ACTION_FORBIDDEN',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // General
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ApiError {
  code: ApiErrorCode | string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface ValidationFieldError {
  field: string;
  message: string;
  code?: string;
}

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ApiError[];
  timestamp: string;
  requestId?: string;
}

export interface ApiSuccessResponse<T> extends ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse extends ApiResponse<never> {
  success: false;
  errors: ApiError[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: SortOrder;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginatedResponse<T> {
  success: boolean;
  data: T[];
  nextCursor?: string;
  previousCursor?: string;
  hasMore: boolean;
  total?: number;
  timestamp: string;
}

export interface SearchParams extends PaginationParams {
  search?: string;
  [key: string]: unknown;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptime: number;
  timestamp: string;
  services: Record<
    string,
    {
      status: 'ok' | 'degraded' | 'down';
      latency?: number;
      message?: string;
    }
  >;
}

export interface FileUploadResponse {
  url: string;
  key: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface BatchOperationResult<T> {
  succeeded: T[];
  failed: Array<{
    item: unknown;
    error: ApiError;
  }>;
  totalSucceeded: number;
  totalFailed: number;
}

export interface RequestMetadata {
  requestId: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  path: string;
  method: string;
  timestamp: string;
  duration?: number;
}

/**
 * Utility type: unwraps the data type from an ApiResponse
 */
export type UnwrapApiResponse<T> = T extends ApiResponse<infer U> ? U : never;

/**
 * Utility type: unwraps the item type from a PaginatedResponse
 */
export type UnwrapPaginatedResponse<T> = T extends PaginatedResponse<infer U>
  ? U
  : never;

/**
 * Helper to create a typed success response shape (for use in tests / mocks).
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to create a typed error response shape (for use in tests / mocks).
 */
export function createErrorResponse(
  errors: ApiError[],
  message?: string,
): ApiErrorResponse {
  return {
    success: false,
    errors,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to build PaginationMeta from raw counts.
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
