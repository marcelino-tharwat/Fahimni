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
  features: string[];
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
  features: string[];
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
