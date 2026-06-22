// src/lib/api/endpoints/auth.ts
import { apiClient } from "@/shared/lib/api/client";
import type { AuthResponse, RegisterPayload, User } from "@/shared/types/user";

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

  sendOtp(email: string): Promise<{ message: string }> {
    return apiClient
      .post<{ message: string }>("/v1/auth/forgot-password", { email })
      .then((res) => res.data);
  },

  verifyOtp(email: string, otp: string): Promise<{ message: string }> {
    return apiClient
      .post<{ message: string }>("/v1/auth/verify-otp", { email, otp })
      .then((res) => res.data);
  },

  resetPasswordWithOtp(email: string, otp: string, password: string): Promise<{ message: string }> {
    return apiClient
      .post<{ message: string }>("/v1/auth/reset-password", { email, otp, newPassword: password })
      .then((res) => res.data);
  },

  getMe(): Promise<{ message: string; data: { user: User } }> {
    return apiClient
      .get<{ message: string; data: { user: User } }>("/v1/auth/me")
      .then((res) => res.data);
  },

  logout(): Promise<{ message: string }> {
    return apiClient.post("/v1/auth/logout").then((res) => res.data);
  },
};