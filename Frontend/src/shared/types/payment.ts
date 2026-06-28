export type PaymentStatus = 'pending' | 'success' | 'failed';

export interface Payment {
  id: string;
  studentId: string;
  chapterId: string;
  tenantId: string;
  amount: number;
  currency: 'EGP';
  status: PaymentStatus;
  paymobTransactionId?: string;
  createdAt: string;
}

// NOTE: the promo-code types moved to `./promoCode` to match the real backend
// wire shape (see docs/promo-code-api-report.md). The old mock-shaped `PromoCode`
// that lived here (`used`/`tenantId`/`generatedBy`) was removed to avoid a
// name collision in the `@/shared/types` barrel.
