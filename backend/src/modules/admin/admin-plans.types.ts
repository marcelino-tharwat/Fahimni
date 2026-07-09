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
  features: Record<string, boolean>;
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
  features: Record<string, boolean>;
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

// ── Mutation input types ──

export interface CreatePlanInput {
  code: string;
  name: string;
  displayName: string;
  description?: string | null;
  monthlyPrice: number;
  yearlyPrice?: number | null;
  currency?: string;
  features?: Record<string, boolean>;
  limits?: Record<string, unknown>;
  isActive?: boolean;
  isRecommended?: boolean;
  sortOrder?: number;
}

export interface UpdatePlanInput {
  name?: string;
  displayName?: string;
  description?: string | null;
  monthlyPrice?: number;
  yearlyPrice?: number | null;
  features?: Record<string, boolean>;
  limits?: Record<string, unknown>;
  isActive?: boolean;
  isRecommended?: boolean;
  sortOrder?: number;
}

export interface StatusChangeInput {
  isActive: boolean;
  reason?: string;
}

export interface RecommendedChangeInput {
  isRecommended: boolean;
}

export interface ReorderItem {
  id: string;
  sortOrder: number;
}

export interface ReorderInput {
  items: ReorderItem[];
}

export interface PlanMutationResponse {
  id: string;
  code: string;
  name: string;
  displayName: string;
  monthlyPrice: number;
  currency: string;
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  features: Record<string, boolean>;
  limits: Record<string, unknown>;
}
