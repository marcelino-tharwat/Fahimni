export interface PlanStats {
  freeEntitlementsCount: number;
  activePaidSubscriptionsCount: number;
  pendingPaymentsCount: number;
  successfulPaymentsCount: number;
  confirmedRevenue: number;
}

export interface AdminPlanListItem {
  id: string;
  code: string;
  name: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number | null;
  currency: string;
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  features: string[];
  limits: Record<string, unknown>;
  stats: PlanStats;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlanTeacher {
  id: string;
  fullName: string;
  email: string | null;
  status: string;
}

export interface AdminPlanPayment {
  id: string;
  teacherId: string;
  teacherName: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface AdminPlanDetailResponse {
  id: string;
  code: string;
  name: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number | null;
  currency: string;
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  features: string[];
  limits: Record<string, unknown>;
  stats: PlanStats;
  activeSubscriptionsCount: number;
  teachers: AdminPlanTeacher[];
  recentPayments: AdminPlanPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlansListResponse {
  data: AdminPlanListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListPlansQuery {
  q?: string;
  isActive?: string;
  billingInterval?: string;
  page: number;
  limit: number;
  sortBy: string;
  sort: "asc" | "desc";
}
