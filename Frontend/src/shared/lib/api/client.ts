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

export interface ApiError {
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
  attemptId?: string;
}

function normalizeError(error: AxiosError): ApiError {
  const data = error.response?.data as {
    message?: string | string[];
    errors?: Record<string, string[]>;
    code?: string;
    attemptId?: string;
  } | undefined;
  const raw = data?.message;
  const message = Array.isArray(raw) ? raw[0] : (raw ?? "حصل خطأ، حاول تاني.");
  return {
    statusCode: error.response?.status ?? 0,
    message,
    errors: data?.errors,
    code: data?.code,
    attemptId: typeof data?.attemptId === 'string' ? data.attemptId : undefined,
  };
}