// src/lib/api/endpoints/auth.ts
import { apiClient } from "@/shared/lib/api/client";
import type { AuthResponse, RegisterPayload } from "@/shared/types/user";

export const authApi = {
  login(email: string, password: string): Promise<AuthResponse> {
    return apiClient
      .post<{ message: string; data: AuthResponse }>("/v1/auth/login", { email, password })
      .then((res) => res.data.data);
  },

  register(data: RegisterPayload): Promise<AuthResponse> {
    return apiClient
      .post<{ message: string; data: AuthResponse }>("/v1/auth/register", data)
      .then((res) => res.data.data);
  },

  forgotPassword(email: string): Promise<{ message: string }> {
    return apiClient
      .post<{ message: string }>("/v1/auth/forgot-password", { email })
      .then((res) => res.data);
  },

  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return apiClient
      .post<{ message: string }>("/v1/auth/reset-password", { token, password })
      .then((res) => res.data);
  },
};