import type {
  Status,
  Role,
  TeacherApprovalState,
} from "../../generated/prisma/client.js";

export interface AdminUserListItem {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  role: Role;
  status: Status;
  teacherApprovalState: TeacherApprovalState;
  createdAt: string;
  updatedAt: string;
  profiles: {
    student: boolean;
    teacher: boolean;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface UserIdentity {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  role: Role;
  status: Status;
  teacherApprovalState: TeacherApprovalState;
  createdAt: string;
  updatedAt: string;
  profiles: {
    student: boolean;
    teacher: boolean;
  };
}

export interface StudentProfileRef {
  id: string;
  stageId: string | null;
}

export interface TeacherProfileRef {
  id: string;
  subject: string | null;
  photoUrl: string | null;
}

export interface AuditLogRef {
  id: string;
  action: string;
  resourceType: string;
  createdAt: string;
}

export interface AdminUserDetailResponse {
  user: UserIdentity;
  studentProfile: StudentProfileRef | null;
  teacherProfile: TeacherProfileRef | null;
  counts: {
    enrollmentsCount: number;
    quizAttemptsCount: number;
    paymentTransactionsCount: number;
    teacherStagesCount: number;
    teacherSubscriptionsCount: number;
  };
  recentAuditLogs: AuditLogRef[];
}

export interface AdminUserMutationResponse {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string;
  role: Role;
  status: Status;
  teacherApprovalState: TeacherApprovalState;
  createdAt: string;
  updatedAt: string;
}
