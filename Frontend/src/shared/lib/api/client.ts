// src/lib/api/client.ts
import axios, { type AxiosError } from "axios";
import { getRefreshToken, saveRefreshToken, removeRefreshToken } from "@/features/auth/lib/token";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

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

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        const { store } = await import("@/shared/store");
        const { logout } = await import("@/features/auth/store/authSlice");
        store.dispatch(logout());
        return Promise.reject(normalizeError(error));
      }

      try {
        const { data } = await apiClient.post("/v1/auth/refresh", { refreshToken });
        saveRefreshToken(data.data.refreshToken);

        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        removeRefreshToken();
        const { store } = await import("@/shared/store");
        const { logout } = await import("@/features/auth/store/authSlice");
        store.dispatch(logout());
        return Promise.reject(refreshError);
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
  code?: string;
}

function normalizeError(error: AxiosError): ApiError {
  const data = error.response?.data as { message?: string | string[]; code?: string } | undefined;
  const raw = data?.message;
  const message = Array.isArray(raw) ? raw[0] : (raw ?? "حصل خطأ، حاول تاني.");
  return { statusCode: error.response?.status ?? 0, message, code: data?.code };
}