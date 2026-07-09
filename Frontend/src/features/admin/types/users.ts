import type { UserRole, UserStatus, TeacherApprovalState } from '@/shared/types/user';

export type { UserRole, UserStatus, TeacherApprovalState };

export interface AdminUserProfiles {
  student: boolean;
  teacher: boolean;
}

export interface AdminUserListItem {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  teacherApprovalState: TeacherApprovalState;
  createdAt: string;
  updatedAt: string;
  profiles: AdminUserProfiles;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUsersResponse {
  data: AdminUserListItem[];
  meta: PaginationMeta;
}

export interface AdminUsersQuery {
  page?: number;
  limit?: number;
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  teacherApprovalState?: TeacherApprovalState;
  sortBy?: 'createdAt' | 'fullName' | 'email' | 'status' | 'role';
  sort?: 'asc' | 'desc';
}

export interface AdminStudentProfileRef {
  id: string;
  stageId: string | null;
}

export interface AdminTeacherProfileRef {
  id: string;
  subject: string | null;
  photoUrl: string | null;
}

export interface AdminUserCounts {
  enrollmentsCount: number;
  quizAttemptsCount: number;
  paymentTransactionsCount: number;
  teacherStagesCount: number;
  teacherSubscriptionsCount: number;
}

export interface AdminAuditLogRef {
  id: string;
  action: string;
  resourceType: string;
  createdAt: string;
}

export interface AdminUserIdentity {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  teacherApprovalState: TeacherApprovalState;
  createdAt: string;
  updatedAt: string;
  profiles: AdminUserProfiles;
}

export interface AdminUserDetailResponse {
  user: AdminUserIdentity;
  studentProfile: AdminStudentProfileRef | null;
  teacherProfile: AdminTeacherProfileRef | null;
  counts: AdminUserCounts;
  recentAuditLogs: AdminAuditLogRef[];
}
