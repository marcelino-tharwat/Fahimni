export interface AdminPlanStats {
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
  stats: AdminPlanStats;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlanDetail {
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
  stats: AdminPlanStats;
  activeSubscriptionsCount: number;
  teachers: Array<{ id: string; fullName: string; email: string | null; status: string }>;
  recentPayments: Array<{ id: string; teacherId: string; teacherName: string; amount: number; currency: string; status: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlansListResponse {
  data: AdminPlanListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface AdminPlanQuery {
  page?: number;
  limit?: number;
  q?: string;
  isActive?: string;
  billingInterval?: string;
  sortBy?: 'sortOrder' | 'monthlyPrice' | 'createdAt' | 'displayName';
  sort?: 'asc' | 'desc';
}

// ── Mutation types ──

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
