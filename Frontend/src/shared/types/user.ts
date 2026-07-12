// src/types/user.ts
// Single source of truth for roles — matches the backend payload exactly.
// "OPERATION" is the teacher role on the data layer; the UI displays it as
// "Teacher"/"مُعلم" via i18n (see `roles.*` in common.json). Never add "TEACHER"
// here — the backend does not send it.
export type UserRole = "ADMIN" | "OPERATION" | "STUDENT";
export type UserStatus = "ACTIVE" | "INACTIVE" | "BANNED";

export type TeacherApprovalState = 'NONE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  teacherApprovalState?: TeacherApprovalState;
  locale?: 'ar' | 'en';
  emailVerified?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  refreshToken?: string;
  // accessToken removed — delivered via httpOnly cookie
}
