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

export interface PromoCode {
  id: string;
  tenantId: string;
  code: string;
  used: boolean;
  usedByStudentId?: string;
  redeemedChapterId?: string;
  generatedBy: string;
  createdAt: string;
}
