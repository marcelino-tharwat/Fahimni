// src/lib/api/client.ts
import axios, { type AxiosError } from "axios";
import { getToken, removeToken } from "@/features/auth/lib/token";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantId = localStorage.getItem("tenant-id");
  if (tenantId) config.headers["X-Tenant-ID"] = tenantId;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      removeToken();
      const { store } = await import("@/shared/store");
      const { logout } = await import("@/features/auth/store/authSlice");
      store.dispatch(logout());
      if (window.location.pathname !== "/auth") {
        window.location.assign("/auth");
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