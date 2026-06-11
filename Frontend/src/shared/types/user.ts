// src/types/user.ts
export type UserRole = "student" | "teacher" | "support_agent" | "super_admin";
export type ServerRole = "STUDENT" | "OPERATION" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "BANNED";

export interface User {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}
