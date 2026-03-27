import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
  code?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Extend InternalAxiosRequestConfig to track retries
interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// ─── Lazy store access (avoids circular deps at module load time) ─────────────

function getAuthState() {
  // Dynamically imported to avoid circular dependency between api.ts ↔ auth.store.ts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useAuthStore } = require('@/store/auth.store') as {
    useAuthStore: {
      getState: () => {
        accessToken: string | null;
        refreshToken: string | null;
        setTokens: (access: string, refresh: string) => void;
        logout: () => void;
      };
    };
  };
  return useAuthStore.getState();
}

// ─── Axios Instance ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30_000, // 30 seconds
  withCredentials: false,
});

// ─── Request Interceptor ──────────────────────────────────────────────────────

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    try {
      const { accessToken } = getAuthState();
      if (accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch {
      // Store not yet initialized — proceed without auth header
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(normalizeError(error)),
);

// ─── Token refresh tracking ───────────────────────────────────────────────────

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeToRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function notifyRefreshSubscribers(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

function rejectRefreshSubscribers(error: unknown) {
  refreshSubscribers.forEach((cb) => {
    // Call with empty string to signal failure; callers reject themselves
    void cb;
  });
  refreshSubscribers = [];
  void error;
}

// ─── Response Interceptor ─────────────────────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;

    // Only attempt refresh on 401, when we have a config to retry,
    // and haven't already retried this request.
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      // Mark to avoid infinite retry loops
      originalRequest._retry = true;

      let authState: ReturnType<typeof getAuthState>;
      try {
        authState = getAuthState();
      } catch {
        return Promise.reject(normalizeError(error));
      }

      const { refreshToken, setTokens, logout } = authState;

      if (!refreshToken) {
        logout();
        return Promise.reject(normalizeError(error));
      }

      // If a refresh is already in-flight, queue this request
      if (isRefreshing) {
        return new Promise<ReturnType<typeof api.request>>((resolve, reject) => {
          subscribeToRefresh((newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(api(originalRequest));
          });

          // If the refresh fails (we get rejected), propagate the error
          const originalSubscribers = refreshSubscribers;
          refreshSubscribers = originalSubscribers.map((cb) => {
            const wrapped = (token: string) => {
              if (!token) {
                reject(new Error('Token refresh failed'));
              } else {
                cb(token);
              }
            };
            return wrapped;
          });
        });
      }

      isRefreshing = true;

      try {
        const response = await axios.post<
          ApiResponse<{ accessToken: string; refreshToken: string }>
        >(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } },
        );

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          response.data.data;

        setTokens(newAccessToken, newRefreshToken);

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        notifyRefreshSubscribers(newAccessToken);

        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — log out and clear queue
        rejectRefreshSubscribers(refreshError);
        try {
          getAuthState().logout();
        } catch {
          // ignore
        }
        return Promise.reject(normalizeError(refreshError as AxiosError));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

// ─── Error normalizer ─────────────────────────────────────────────────────────

export function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{
      message?: string;
      error?: string;
      statusCode?: number;
      errors?: Record<string, string[]>;
      code?: string;
    }>;

    if (axiosErr.response) {
      const { data, status } = axiosErr.response;
      return {
        message:
          data?.message ??
          data?.error ??
          axiosErr.message ??
          'An unexpected error occurred',
        statusCode: data?.statusCode ?? status,
        errors: data?.errors,
        code: data?.code,
      };
    }

    if (axiosErr.request) {
      return {
        message: 'No response from server. Please check your connection.',
        statusCode: 0,
        code: 'NETWORK_ERROR',
      };
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: 500,
      code: 'CLIENT_ERROR',
    };
  }

  return {
    message: 'An unexpected error occurred',
    statusCode: 500,
    code: 'UNKNOWN_ERROR',
  };
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

export async function apiGet<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  const response = await api.get<ApiResponse<T>>(url, config);
  return response.data;
}

export async function apiPost<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  const response = await api.post<ApiResponse<T>>(url, data, config);
  return response.data;
}

export async function apiPut<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  const response = await api.put<ApiResponse<T>>(url, data, config);
  return response.data;
}

export async function apiPatch<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  const response = await api.patch<ApiResponse<T>>(url, data, config);
  return response.data;
}

export async function apiDelete<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  const response = await api.delete<ApiResponse<T>>(url, config);
  return response.data;
}

export async function apiGetPaginated<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<T>> {
  const response = await api.get<PaginatedResponse<T>>(url, config);
  return response.data;
}

export default api;
