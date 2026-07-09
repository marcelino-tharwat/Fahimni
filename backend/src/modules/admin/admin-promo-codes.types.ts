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

export type PromoScope = "COURSE_PURCHASE" | "TEACHER_PLAN";
export type PromoDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type PromoBillingScope = "MONTHLY" | "YEARLY" | "ALL";

/** Derived status for the UI badge (active / inactive / expired). */
export type PromoDisplayStatus = "ACTIVE" | "INACTIVE" | "EXPIRED";

export interface AdminPromoCodeDTO {
  id: string;
  code: string;
  scope: PromoScope;
  discountType: PromoDiscountType;
  discountValue: number;
  currency: string;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number | null;
  applicablePlanIds: string[];
  billingInterval: PromoBillingScope;
  displayStatus: PromoDisplayStatus;
  createdAt: string;
  updatedAt: string;
}
