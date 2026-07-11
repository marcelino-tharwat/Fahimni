// src/lib/api/client.ts
import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";
const REFRESH_TIMEOUT_MS = 10_000;

/** Per-request retry flag (single retry after a refresh). */
type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Endpoints whose 401s must NOT trigger a refresh (avoids recursion/loops). */
function isAuthFlow(url: string | undefined): boolean {
  const u = url ?? "";
  return (
    u.includes("/auth/me") ||
    u.includes("/auth/google") ||
    u.includes("/auth/refresh") ||
    u.includes("/auth/login") ||
    u.includes("/auth/logout") ||
    u.includes("/auth/register")
  );
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// So the backend can localize validation/business error messages to match
// whatever language the UI is currently rendering in. Imported lazily (like
// `forceLogout` below) so merely importing this module — e.g. from a
// non-DOM unit test — never eagerly initializes the i18n singleton.
apiClient.interceptors.request.use(async (config) => {
  const { default: i18n } = await import("@/shared/lib/i18n");
  config.headers.set("Accept-Language", i18n.language ?? "en");
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(undefined);
  });
  failedQueue = [];
};

/** Clear auth state once when refresh is impossible (no backend call needed). */
async function forceLogout() {
  const { store } = await import("@/shared/store");
  const { logout } = await import("@/features/auth/store/authSlice");
  store.dispatch(logout());
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    // 403 — structured rejection without redirect or logout. The message is
    // translated by the caller via `translateApiError` (code-driven), not
    // hardcoded here, so it renders in whatever language the UI is in.
    if (error.response?.status === 403) {
      return Promise.reject(normalizeError(error));
    }

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthFlow(originalRequest.url)
    ) {
      // Single-flight: concurrent 401s wait for the one in-flight refresh.
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // The refresh token rides as an HttpOnly cookie — no body, no storage.
        await Promise.race([
          apiClient.post("/v1/auth/refresh"),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error("refresh_timeout")),
              REFRESH_TIMEOUT_MS,
            );
          }),
        ]);
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        await forceLogout();
        return Promise.reject(normalizeError(error));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

/** A single field-level validation error, keyed by a stable, translatable code. */
export interface ApiFieldError {
  field: string;
  code: string;
  message: string;
}

export interface ApiError {
  statusCode: number;
  /** Raw backend message — a fallback only; prefer translating by `code`. */
  message?: string;
  errors?: ApiFieldError[];
  code?: string;
  reason?: string;
  details?: string;
  suggestion?: string;
  attemptId?: string;
}

function normalizeError(error: AxiosError): ApiError {
  const data = error.response?.data as {
    message?: string | string[];
    errors?: ApiFieldError[];
    code?: string;
    reason?: string;
    details?: string;
    suggestion?: string;
    attemptId?: string;
  } | undefined;
  const raw = data?.message;
  const message = Array.isArray(raw) ? raw[0] : raw;
  return {
    statusCode: error.response?.status ?? 0,
    message,
    errors: data?.errors,
    code: data?.code,
    reason: data?.reason,
    details: data?.details,
    suggestion: data?.suggestion,
    attemptId: typeof data?.attemptId === 'string' ? data.attemptId : undefined,
  };
}